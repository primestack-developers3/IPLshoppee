(() => {
  const ORDERS_API_BASE = (window.REYVAL_API_BASE || '').replace(/\/$/, '');
  const HANDLED_CUSTOMERS_KEY = 'reyvalHandledCustomers';
  const ORDER_STATUSES = ['pending', 'placed', 'shipped', 'delivered', 'cancelled'];
  const ORDER_STATUS_PRIORITY = {
    pending: 0,
    placed: 1,
    shipped: 2,
    delivered: 3,
    cancelled: 4
  };
  const PORTAL_PASSWORD = 'reyvalstaff';
  const PORTAL_SESSION_KEY = 'reyval_orders_portal_access';

  const portalState = {
    orders: [],
    searchTerm: '',
    statusFilter: 'all',
    sourceMode: 'shared-api',
    storageMode: 'local-file',
    firebaseEnabled: false,
    customersVisible: false
  };

  function resolvePortalApiUrl(path) {
    if (ORDERS_API_BASE) {
      return `${ORDERS_API_BASE}${path}`;
    }
    return path;
  }

  async function requestPortalData(path, options = {}) {
    const response = await fetch(resolvePortalApiUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed to load ${path}`);
    }

    return response.json();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderCurrency(value) {
    if (window.ReyvalOrderTools?.formatCurrency) {
      return window.ReyvalOrderTools.formatCurrency(value || 0);
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function normalizeOrderStatus(value) {
    return ORDER_STATUSES.includes(value) ? value : 'pending';
  }

  function formatOrderStatus(value) {
    return normalizeOrderStatus(value).replace(/_/g, ' ');
  }

  function formatPaymentStatus(value) {
    return String(value || 'pending').replace(/_/g, ' ');
  }

  function formatDateTime(value) {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString('en-IN');
  }

  function normalizeSearchTerm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function buildProductPhoto(product) {
    if (product.imageUrl) {
      return `<img class="product-line-image" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name || 'Product photo')}" loading="lazy">`;
    }

    return '<div class="product-line-image-empty">No photo</div>';
  }

  function isPortalUnlocked() {
    return sessionStorage.getItem(PORTAL_SESSION_KEY) === 'granted';
  }

  function getHandledCustomers() {
    try {
      return JSON.parse(localStorage.getItem(HANDLED_CUSTOMERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function getCustomerKey(order) {
    return String(
      order.customerId ||
      order.customer?.phone ||
      order.customer?.email ||
      order.orderId
    );
  }

  function buildCustomerRecords(orders) {
    const customerMap = new Map();

    orders.forEach(order => {
      const key = getCustomerKey(order);
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          key,
          name: order.customer?.name || 'Customer',
          phone: order.customer?.phone || '',
          email: order.customer?.email || '',
          ordersCount: 0,
          revenue: 0,
          lastOrderAt: order.createdAt || '',
          latestOrderId: order.orderId || ''
        });
      }

      const record = customerMap.get(key);
      record.ordersCount += 1;
      record.revenue += Number(order.totals?.revenue || 0);

      const currentTime = new Date(order.createdAt || 0).getTime();
      const previousTime = new Date(record.lastOrderAt || 0).getTime();
      if (currentTime >= previousTime) {
        record.lastOrderAt = order.createdAt || record.lastOrderAt;
        record.latestOrderId = order.orderId || record.latestOrderId;
      }
    });

    return Array.from(customerMap.values()).sort((left, right) => {
      return new Date(right.lastOrderAt || 0).getTime() - new Date(left.lastOrderAt || 0).getTime();
    });
  }

  function splitCustomers(orders) {
    const handledKeys = new Set(getHandledCustomers());
    const customers = buildCustomerRecords(orders);

    return {
      pendingCustomers: customers.filter(customer => !handledKeys.has(customer.key)),
      handledCustomers: customers.filter(customer => handledKeys.has(customer.key))
    };
  }

  function getTotals(orders) {
    return orders.reduce((totals, order) => {
      totals.orders += 1;
      totals.revenue += Number(order.totals?.revenue || 0);
      totals.grossProfit += Number(order.totals?.grossProfit || 0);
      return totals;
    }, {
      orders: 0,
      revenue: 0,
      grossProfit: 0
    });
  }

  function sortOrders(orders) {
    return [...orders].sort((left, right) => {
      const leftStatus = ORDER_STATUS_PRIORITY[normalizeOrderStatus(left.fulfillment?.status)] ?? 99;
      const rightStatus = ORDER_STATUS_PRIORITY[normalizeOrderStatus(right.fulfillment?.status)] ?? 99;

      if (leftStatus !== rightStatus) {
        return leftStatus - rightStatus;
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }

  function orderMatchesFilters(order) {
    const status = normalizeOrderStatus(order.fulfillment?.status);
    if (portalState.statusFilter !== 'all' && status !== portalState.statusFilter) {
      return false;
    }

    if (!portalState.searchTerm) {
      return true;
    }

    const productNames = (order.products || []).map(product => product.name).join(' ');
    const haystack = [
      order.orderId,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.email,
      order.customer?.address,
      order.customer?.pincode,
      order.fulfillment?.trackingId,
      order.fulfillment?.supplierOrderRef,
      order.fulfillment?.cancelReason,
      status,
      order.payment?.status,
      productNames
    ].join(' ').toLowerCase();

    return haystack.includes(portalState.searchTerm);
  }

  function updateCustomerToggle() {
    const button = document.getElementById('portal-customer-toggle');
    if (!button) return;

    button.textContent = portalState.customersVisible ? 'Hide Customers' : 'Show Customers';
  }

  function renderStorageBanner() {
    const banner = document.getElementById('portal-storage-banner');
    if (!banner) return;

    const usingSharedApi = portalState.sourceMode === 'shared-api';
    const storageLabel = usingSharedApi
      ? String(portalState.storageMode || 'shared').replace(/-/g, ' ')
      : 'browser local';
    const pillClass = usingSharedApi ? 'live' : 'local';
    const title = usingSharedApi
      ? 'Shared Reyval orders feed connected.'
      : 'Shared API unavailable. Showing browser-local orders only.';
    const copy = usingSharedApi
      ? 'This independent staff page is reading the same backend as the store, so all customer orders are available here.'
      : 'To see all customers across devices, keep the Reyval server running with shared storage such as Firebase or the local orders file.';

    banner.innerHTML = `
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="subtle" style="margin-top: 6px;">${escapeHtml(copy)}</div>
      </div>
      <div class="storage-pill ${pillClass}">${escapeHtml(storageLabel)}</div>
    `;
  }

  function renderKpis(filteredOrders) {
    const totals = getTotals(filteredOrders);
    const customers = buildCustomerRecords(filteredOrders);

    document.getElementById('portal-kpi-orders').textContent = String(totals.orders);
    document.getElementById('portal-kpi-customers').textContent = String(customers.length);
    document.getElementById('portal-kpi-revenue').textContent = renderCurrency(totals.revenue);
    document.getElementById('portal-kpi-profit').textContent = renderCurrency(totals.grossProfit);
  }

  function buildCustomerCard(customer) {
    return `
      <article class="customer-card">
        <strong>${escapeHtml(customer.name)}</strong>
        <small>${escapeHtml([customer.phone, customer.email].filter(Boolean).join(' | ') || 'No contact saved')}</small>
        <small>${customer.ordersCount} order(s) | ${renderCurrency(customer.revenue)}</small>
        <small>Latest order ${escapeHtml(customer.latestOrderId || '--')} on ${escapeHtml(formatDateTime(customer.lastOrderAt))}</small>
      </article>
    `;
  }

  function renderCustomers(filteredOrders) {
    const pendingContainer = document.getElementById('portal-pending-customers');
    const handledContainer = document.getElementById('portal-handled-customers');
    const customerCount = document.getElementById('portal-customer-count');
    const pendingCount = document.getElementById('portal-pending-customer-count');
    const handledCount = document.getElementById('portal-handled-customer-count');
    const status = document.getElementById('portal-customer-status');

    if (!pendingContainer || !handledContainer) return;

    const { pendingCustomers, handledCustomers } = splitCustomers(filteredOrders);
    const totalCustomers = pendingCustomers.length + handledCustomers.length;

    if (customerCount) {
      customerCount.textContent = `${totalCustomers} customer${totalCustomers === 1 ? '' : 's'}`;
    }
    if (pendingCount) {
      pendingCount.textContent = `${pendingCustomers.length} pending`;
    }
    if (handledCount) {
      handledCount.textContent = `${handledCustomers.length} handled`;
    }

    updateCustomerToggle();

    if (!portalState.customersVisible) {
      if (status) {
        status.textContent = 'Customers stay hidden until you open them.';
      }
      pendingContainer.innerHTML = '<p class="empty-state">Pending customers are hidden until you choose Show Customers.</p>';
      handledContainer.innerHTML = '<p class="empty-state">Handled customers are hidden until you choose Show Customers.</p>';
      return;
    }

    if (status) {
      status.textContent = totalCustomers
        ? `Showing all ${totalCustomers} customers from the current order results.`
        : 'No customers matched the current filters.';
    }

    pendingContainer.innerHTML = pendingCustomers.length
      ? pendingCustomers.map(buildCustomerCard).join('')
      : '<p class="empty-state">No pending customers matched the current filters.</p>';

    handledContainer.innerHTML = handledCustomers.length
      ? handledCustomers.map(buildCustomerCard).join('')
      : '<p class="empty-state">No handled customers matched the current filters.</p>';
  }

  function buildProductLines(order) {
    return (order.products || []).map(product => `
      <div class="product-line">
        <div class="product-line-main">
          <div class="product-line-media">
            ${buildProductPhoto(product)}
          </div>
          <div>
            <strong>${escapeHtml(product.name)} x ${product.quantity || 0}</strong>
            <small>${escapeHtml(product.category || 'General')} | Supplier ${renderCurrency(product.sourceUnitPrice || 0)} each | Revenue ${renderCurrency(product.lineRevenue || 0)}</small>
            <small>${product.sourceUrl ? `<a href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">Open supplier link</a>` : 'No supplier link saved'}</small>
          </div>
        </div>
        <div>
          <strong>${renderCurrency(product.lineProfit || 0)}</strong>
          <small>profit</small>
        </div>
      </div>
    `).join('');
  }

  function buildOrderCard(order) {
    const status = normalizeOrderStatus(order.fulfillment?.status);
    const cancelledAt = order.fulfillment?.cancelledAt || '';
    const cancelReason = order.fulfillment?.cancelReason || '';

    return `
      <article class="order-card">
        <div class="order-head">
          <div>
            <div class="order-kicker">${escapeHtml(order.orderId || '--')}</div>
            <div class="order-title">${escapeHtml(order.customer?.name || 'Customer')}</div>
            <p>${escapeHtml([order.customer?.phone, order.customer?.email].filter(Boolean).join(' | ') || 'No contact saved')}</p>
          </div>
          <div class="status-badge ${status}">${escapeHtml(formatOrderStatus(status))}</div>
        </div>

        <div class="meta-grid">
          <div><span>Revenue</span><strong>${renderCurrency(order.totals?.revenue || 0)}</strong></div>
          <div><span>Gross Profit</span><strong>${renderCurrency(order.totals?.grossProfit || 0)}</strong></div>
          <div><span>Items</span><strong>${order.totals?.units || 0}</strong></div>
          <div><span>Created</span><strong>${escapeHtml(formatDateTime(order.createdAt))}</strong></div>
        </div>

        <div class="payment-grid">
          <div><span>Payment Status</span><strong>${escapeHtml(formatPaymentStatus(order.payment?.status))}</strong></div>
          <div><span>Payment Mode</span><strong>${escapeHtml(order.payment?.mode || 'manual')}</strong></div>
          <div><span>Gateway Ref</span><strong>${escapeHtml(order.payment?.providerPaymentId || order.payment?.providerOrderId || '--')}</strong></div>
          <div><span>Supplier Ref</span><strong>${escapeHtml(order.fulfillment?.supplierOrderRef || '--')}</strong></div>
        </div>

        <div class="shipping-grid">
          <div><span>Shipping Address</span><strong>${escapeHtml(order.customer?.address || order.shipping?.address || '--')}</strong></div>
          <div><span>Pincode</span><strong>${escapeHtml(order.customer?.pincode || order.shipping?.pincode || '--')}</strong></div>
          <div><span>Tracking</span><strong>${escapeHtml(order.fulfillment?.trackingId || '--')}</strong></div>
          <div><span>Carrier</span><strong>${escapeHtml(order.fulfillment?.carrier || '--')}</strong></div>
        </div>

        ${cancelledAt || cancelReason ? `
          <div class="order-note cancelled">
            <strong>${escapeHtml(cancelledAt ? `Cancelled ${formatDateTime(cancelledAt)}` : 'Cancelled')}</strong>
            <span>${escapeHtml(cancelReason || 'This order was cancelled before the supplier order was placed.')}</span>
          </div>
        ` : ''}

        <div class="product-lines">
          ${buildProductLines(order)}
        </div>
      </article>
    `;
  }

  function renderOrders(filteredOrders) {
    const container = document.getElementById('portal-orders');
    const count = document.getElementById('portal-orders-count');
    const status = document.getElementById('portal-search-status');
    if (!container) return;

    if (count) {
      count.textContent = `${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`;
    }

    if (status) {
      if (!portalState.orders.length) {
        status.textContent = 'No orders are available yet.';
      } else if (!filteredOrders.length) {
        status.textContent = 'No orders matched the current search and status filter.';
      } else {
        status.textContent = `Showing ${filteredOrders.length} separate order${filteredOrders.length === 1 ? '' : 's'}. Pending orders appear first, and repeated customer names stay as separate orders.`;
      }
    }

    if (!filteredOrders.length) {
      container.innerHTML = '<p class="empty-state">No orders matched the current filters.</p>';
      return;
    }

    container.innerHTML = filteredOrders.map(buildOrderCard).join('');
  }

  function renderPortal() {
    const filteredOrders = sortOrders(portalState.orders.filter(order => orderMatchesFilters(order)));

    renderStorageBanner();
    renderKpis(filteredOrders);
    renderCustomers(filteredOrders);
    renderOrders(filteredOrders);
  }

  async function loadPortalContext() {
    try {
      const config = await requestPortalData('/api/config');
      portalState.storageMode = config.storageMode || 'local-file';
      portalState.firebaseEnabled = Boolean(config.firebaseEnabled);
    } catch (error) {
      portalState.storageMode = 'local-file';
      portalState.firebaseEnabled = false;
    }
  }

  async function loadOrders() {
    try {
      const response = await requestPortalData('/api/orders');
      portalState.orders = response.orders || [];
      portalState.sourceMode = 'shared-api';
    } catch (error) {
      portalState.orders = window.ReyvalOrderTools?.getLocalOrders?.() || [];
      portalState.sourceMode = 'browser-local';
    }
  }

  async function refreshPortal() {
    await Promise.all([
      loadPortalContext(),
      loadOrders()
    ]);
    renderPortal();
  }

  function showPortalAuth(message = '') {
    const authShell = document.getElementById('portal-auth');
    const appShell = document.getElementById('portal-app');
    const error = document.getElementById('portal-auth-error');
    const input = document.getElementById('portal-password-input');

    if (authShell) {
      authShell.hidden = false;
    }
    if (appShell) {
      appShell.hidden = true;
    }
    if (error) {
      if (message) {
        error.textContent = message;
        error.hidden = false;
      } else {
        error.hidden = true;
      }
    }
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  async function unlockPortal() {
    sessionStorage.setItem(PORTAL_SESSION_KEY, 'granted');

    const authShell = document.getElementById('portal-auth');
    const appShell = document.getElementById('portal-app');
    const error = document.getElementById('portal-auth-error');

    if (authShell) {
      authShell.hidden = true;
    }
    if (appShell) {
      appShell.hidden = false;
    }
    if (error) {
      error.hidden = true;
    }

    await refreshPortal();
  }

  function lockPortal() {
    sessionStorage.removeItem(PORTAL_SESSION_KEY);
    portalState.customersVisible = false;
    updateCustomerToggle();
    showPortalAuth();
  }

  function bindAuthForm() {
    const form = document.getElementById('portal-auth-form');
    const input = document.getElementById('portal-password-input');
    if (!form || form.dataset.bound === 'true') return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = String(input?.value || '');

      if (password !== PORTAL_PASSWORD) {
        showPortalAuth('Incorrect password. Please try again.');
        return;
      }

      await unlockPortal();
    });

    form.dataset.bound = 'true';
  }

  function bindPortalControls() {
    const form = document.getElementById('portal-search-form');
    const input = document.getElementById('portal-search-input');
    const clear = document.getElementById('portal-search-clear');
    const statusFilter = document.getElementById('portal-status-filter');
    const refresh = document.getElementById('portal-refresh');
    const lock = document.getElementById('portal-lock');
    const customerToggle = document.getElementById('portal-customer-toggle');

    if (form && form.dataset.bound !== 'true') {
      form.addEventListener('submit', event => {
        event.preventDefault();
        portalState.searchTerm = normalizeSearchTerm(input?.value);
        portalState.statusFilter = statusFilter?.value || 'all';
        renderPortal();
      });
      form.dataset.bound = 'true';
    }

    if (statusFilter && statusFilter.dataset.bound !== 'true') {
      statusFilter.addEventListener('change', () => {
        portalState.statusFilter = statusFilter.value || 'all';
        renderPortal();
      });
      statusFilter.dataset.bound = 'true';
    }

    if (clear && clear.dataset.bound !== 'true') {
      clear.addEventListener('click', () => {
        if (input) {
          input.value = '';
        }
        if (statusFilter) {
          statusFilter.value = 'all';
        }
        portalState.searchTerm = '';
        portalState.statusFilter = 'all';
        renderPortal();
      });
      clear.dataset.bound = 'true';
    }

    if (refresh && refresh.dataset.bound !== 'true') {
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        refresh.textContent = 'Refreshing...';
        await refreshPortal();
        refresh.disabled = false;
        refresh.textContent = 'Refresh';
      });
      refresh.dataset.bound = 'true';
    }

    if (lock && lock.dataset.bound !== 'true') {
      lock.addEventListener('click', () => {
        lockPortal();
      });
      lock.dataset.bound = 'true';
    }

    if (customerToggle && customerToggle.dataset.bound !== 'true') {
      customerToggle.addEventListener('click', () => {
        portalState.customersVisible = !portalState.customersVisible;
        renderPortal();
      });
      customerToggle.dataset.bound = 'true';
    }
  }

  async function loadPage() {
    bindAuthForm();
    bindPortalControls();

    if (isPortalUnlocked()) {
      await unlockPortal();
      return;
    }

    showPortalAuth();
  }

  window.ReyvalOrdersPortal = {
    loadPage
  };

  window.addEventListener('DOMContentLoaded', loadPage);
})();
