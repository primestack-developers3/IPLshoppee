const ADMIN_API_BASE = (window.REYVAL_API_BASE || '').replace(/\/$/, '');
const HANDLED_CUSTOMERS_KEY = 'reyvalHandledCustomers';
const ORDER_STATUSES = ['pending', 'placed', 'shipped', 'delivered', 'cancelled'];
const PRODUCT_RESULT_LIMIT = 6;
const CUSTOMER_RESULT_LIMIT = 6;

const adminState = {
  analytics: {
    totals: {},
    topProducts: [],
    procurementQueue: [],
    recentOrders: [],
    statusBreakdown: {}
  },
  searchTerm: '',
  productCatalog: [],
  productSearchTerm: '',
  storageMode: 'local-file',
  firebaseEnabled: false
};

function resolveAdminApiUrl(path) {
  if (ADMIN_API_BASE) {
    return `${ADMIN_API_BASE}${path}`;
  }
  return path;
}

async function requestAdminData(path, options = {}) {
  const response = await fetch(resolveAdminApiUrl(path), {
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
  return ReyvalOrderTools.formatCurrency(value || 0);
}

function normalizeSearchTerm(value) {
  return (value || '').trim().toLowerCase();
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

function parseMoneyInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeProductRecord(product = {}) {
  const salePrice = parseMoneyInput(product.price);
  const supplierPrice = parseMoneyInput(product.supplierPrice ?? product.originalPrice);

  return {
    ...product,
    id: product.id || '',
    name: product.name || 'Untitled product',
    category: product.category || product.categoryLabel || 'general',
    categoryLabel: product.categoryLabel || product.category || 'General',
    imageUrl: product.imageUrl || '',
    price: salePrice,
    supplierPrice,
    originalPrice: supplierPrice,
    sourceLabel: product.sourceLabel || product.sourceName || 'Manual sourcing',
    sourceUrl: product.sourceUrl || product.supplierUrl || '',
    updatedAt: product.updatedAt || ''
  };
}

function getProductMargin(product) {
  return parseMoneyInput(product.price) - parseMoneyInput(product.supplierPrice ?? product.originalPrice);
}

function buildProductPhoto(product, options = {}) {
  const altText = escapeHtml(product.name || 'Product photo');
  const imageUrl = escapeHtml(product.imageUrl || '');

  if (product.imageUrl) {
    return `
      <img
        class="${options.imageClass || 'product-photo'}"
        src="${imageUrl}"
        alt="${altText}"
        loading="lazy"
        ${options.previewAttr || ''}
      >
    `;
  }

  return `
    <div class="${options.placeholderClass || 'product-photo-empty'}" ${options.placeholderAttr || ''}>
      No photo saved
    </div>
  `;
}

function buildOrderPhoto(product) {
  return `
    <div class="order-line-media">
      ${buildProductPhoto(product, {
        imageClass: 'order-line-image',
        placeholderClass: 'order-line-image-empty'
      })}
    </div>
  `;
}

function productMatchesSearch(product, searchTerm) {
  if (!searchTerm) return true;

  const haystack = [
    product.id,
    product.name,
    product.category,
    product.categoryLabel,
    product.sourceLabel,
    product.sourceUrl
  ].join(' ').toLowerCase();

  return haystack.includes(searchTerm);
}

function getHandledCustomers() {
  try {
    return JSON.parse(localStorage.getItem(HANDLED_CUSTOMERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function setHandledCustomers(keys) {
  localStorage.setItem(HANDLED_CUSTOMERS_KEY, JSON.stringify(keys));
}

function getCustomerKey(order) {
  return String(
    order.customerId ||
    order.customer?.phone ||
    order.customer?.email ||
    order.orderId
  );
}

function customerMatchesSearch(order, searchTerm) {
  if (!searchTerm) return true;

  const haystack = [
    order.orderId,
    order.customer?.name,
    order.customer?.phone,
    order.customer?.email,
    order.customer?.address,
    order.customer?.pincode,
    order.fulfillment?.trackingId
  ].join(' ').toLowerCase();

  return haystack.includes(searchTerm);
}

function buildCustomerRecords(orders) {
  const customerMap = new Map();

  orders.forEach(order => {
    const key = getCustomerKey(order);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        key,
        customerId: order.customerId,
        name: order.customer?.name || 'Customer',
        phone: order.customer?.phone || '',
        email: order.customer?.email || '',
        orderIds: [],
        ordersCount: 0,
        revenue: 0,
        lastOrderAt: order.createdAt || '',
        latestOrderId: order.orderId || ''
      });
    }

    const record = customerMap.get(key);
    record.orderIds.push(order.orderId || '');
    record.ordersCount += 1;
    record.revenue += Number(order.totals?.revenue || 0);

    const orderTime = new Date(order.createdAt || 0).getTime();
    const lastKnown = new Date(record.lastOrderAt || 0).getTime();
    if (orderTime >= lastKnown) {
      record.lastOrderAt = order.createdAt || record.lastOrderAt;
      record.latestOrderId = order.orderId || record.latestOrderId;
    }
  });

  return Array.from(customerMap.values()).sort((left, right) => {
    return new Date(right.lastOrderAt || 0).getTime() - new Date(left.lastOrderAt || 0).getTime();
  });
}

function renderKpis(totals, statusBreakdown) {
  document.getElementById('kpi-orders').textContent = String(totals.orders || 0);
  document.getElementById('kpi-pending-orders').textContent = String(statusBreakdown.pending || 0);
  document.getElementById('kpi-revenue').textContent = renderCurrency(totals.revenue || 0);
  document.getElementById('kpi-profit').textContent = renderCurrency(totals.grossProfit || 0);
}

function renderTopProducts(products) {
  const table = document.getElementById('top-products');
  if (!table) return;

  if (!products.length) {
    table.innerHTML = '<p class="empty-state">No orders yet.</p>';
    return;
  }

  table.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Revenue</th>
          <th>Supplier Cost</th>
          <th>Profit</th>
          <th>Supplier Link</th>
        </tr>
      </thead>
      <tbody>
        ${products.slice(0, 12).map(product => `
          <tr>
            <td>
              <strong>${escapeHtml(product.name)}</strong>
              <div class="subtle">${escapeHtml(product.category)}</div>
            </td>
            <td>${product.quantity}</td>
            <td>${renderCurrency(product.revenue)}</td>
            <td>${renderCurrency(product.sourceCost)}</td>
            <td>${renderCurrency(product.grossProfit)}</td>
            <td>${product.sourceUrl ? `<a href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">Open supplier</a>` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderProcurementQueue(products) {
  const container = document.getElementById('procurement-queue');
  if (!container) return;

  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No pending supplier purchases right now.</p>';
    return;
  }

  container.innerHTML = products.slice(0, 12).map(product => `
    <article class="queue-card">
      <div>
        <div class="queue-kicker">Pending supplier order</div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>Buy <strong>${product.quantity}</strong> unit(s) from the supplier to fulfill current Reyval demand.</p>
      </div>
      <div class="queue-meta">
        <div><span>Expected spend</span><strong>${renderCurrency(product.sourceCost)}</strong></div>
        <div><span>Expected revenue</span><strong>${renderCurrency(product.revenue)}</strong></div>
        <div><span>Gross profit</span><strong>${renderCurrency(product.grossProfit)}</strong></div>
        ${product.sourceUrl ? `<a class="queue-link" href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">Buy on supplier</a>` : ''}
      </div>
    </article>
  `).join('');
}

function renderProductStorageStatus() {
  const container = document.getElementById('product-storage-status');
  if (!container) return;

  const isFirebaseLive = adminState.firebaseEnabled;
  const storageLabel = String(adminState.storageMode || 'local-file').replace(/-/g, ' ');
  const statusClass = isFirebaseLive ? 'status-live' : 'status-readonly';
  const heading = isFirebaseLive
    ? 'Firebase product database connected.'
    : 'Product editor is in read-only mode.';
  const copy = isFirebaseLive
    ? 'Supplier links, supplier cost, and selling price save directly to Firestore and will be used for future orders.'
    : 'Orders still work, but product edits will not persist until Firebase Admin credentials are added in `.env.local`.';

  container.innerHTML = `
    <div>
      <strong>${escapeHtml(heading)}</strong>
      <div class="subtle" style="margin-top: 6px;">${escapeHtml(copy)}</div>
    </div>
    <div class="storage-pill ${statusClass}">${escapeHtml(storageLabel)}</div>
  `;
}

function buildProductCard(product) {
  const margin = getProductMargin(product);
  const canSave = adminState.firebaseEnabled;
  const saveLabel = canSave ? 'Save Product' : 'Read Only';
  const saveNote = canSave
    ? `Updated ${formatDateTime(product.updatedAt)}`
    : 'Add Firebase Admin credentials to enable product saving.';

  return `
    <article class="product-card">
      <div class="product-preview-block">
        ${product.imageUrl
          ? `<img class="product-preview-image" data-product-preview src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
          : '<img class="product-preview-image" data-product-preview src="" alt="" hidden>'}
        <div class="product-preview-empty" data-product-preview-empty ${product.imageUrl ? 'hidden' : ''}>No product photo saved yet.</div>
      </div>

      <div class="product-card-head">
        <div>
          <div class="queue-kicker">${escapeHtml(product.categoryLabel || 'General')}</div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="subtle">${escapeHtml(product.id || '--')}</p>
        </div>
        <div class="product-profit" data-product-profit-badge>Profit ${renderCurrency(margin)}</div>
      </div>

      <form class="product-actions" data-product-id="${escapeHtml(product.id)}">
        <div class="product-field-grid">
          <label class="order-field">
            <span>Selling Price</span>
            <input name="price" type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}">
          </label>
          <label class="order-field">
            <span>Supplier Price</span>
            <input name="supplierPrice" type="number" min="0" step="1" value="${escapeHtml(String(product.supplierPrice || 0))}">
          </label>
          <label class="order-field">
            <span>Supplier Name</span>
            <input name="sourceLabel" type="text" value="${escapeHtml(product.sourceLabel || '')}" placeholder="Meesho, IndiaMart, Manual sourcing">
          </label>
          <label class="order-field">
            <span>Supplier Link</span>
            <input name="sourceUrl" type="url" value="${escapeHtml(product.sourceUrl || '')}" placeholder="https://supplier.com/product">
          </label>
          <label class="order-field">
            <span>Product Photo URL</span>
            <input name="imageUrl" type="url" value="${escapeHtml(product.imageUrl || '')}" placeholder="https://images.meesho.com/...">
          </label>
        </div>

        <div class="product-meta-row">
          <span>Live margin: <strong data-margin-output>${renderCurrency(margin)}</strong></span>
          ${product.sourceUrl ? `<a class="queue-link" data-source-link href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">Open supplier page</a>` : '<span data-source-link-label>No supplier link saved yet.</span>'}
        </div>

        <div class="order-form-row">
          <button class="product-save-btn" type="submit" ${canSave ? '' : 'disabled'}>${saveLabel}</button>
          <div class="order-save-note product-save-note">${escapeHtml(saveNote)}</div>
        </div>
      </form>
    </article>
  `;
}

function renderProductCatalog(products) {
  const container = document.getElementById('product-catalog');
  const count = document.getElementById('product-count');
  const searchStatus = document.getElementById('product-search-status');
  if (!container) return;

  const normalizedProducts = (products || []).map(product => normalizeProductRecord(product));

  if (!adminState.productSearchTerm) {
    if (count) {
      count.textContent = '0 products';
    }
    if (searchStatus) {
      searchStatus.textContent = `Search to reveal up to ${PRODUCT_RESULT_LIMIT} matching products.`;
    }
    container.innerHTML = `<p class="empty-state">Product details stay hidden until you search by name, category, or product ID.</p>`;
    return;
  }

  const filteredProducts = normalizedProducts
    .filter(product => productMatchesSearch(product, adminState.productSearchTerm));
  const visibleProducts = filteredProducts.slice(0, PRODUCT_RESULT_LIMIT);

  if (count) {
    count.textContent = filteredProducts.length > PRODUCT_RESULT_LIMIT
      ? `${visibleProducts.length} of ${filteredProducts.length} products`
      : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`;
  }

  if (searchStatus) {
    searchStatus.textContent = !filteredProducts.length
      ? `No products found for "${adminState.productSearchTerm}".`
      : filteredProducts.length > PRODUCT_RESULT_LIMIT
      ? `Found ${filteredProducts.length} products for "${adminState.productSearchTerm}". Showing the first ${visibleProducts.length}.`
      : `Showing product matches for "${adminState.productSearchTerm}".`;
  }

  if (!visibleProducts.length) {
    container.innerHTML = '<p class="empty-state">No products matched the current search.</p>';
    return;
  }

  container.innerHTML = visibleProducts.map(buildProductCard).join('');
  attachProductActionHandlers();
}

function buildStatusOptions(selectedStatus) {
  const current = normalizeOrderStatus(selectedStatus);
  return ORDER_STATUSES.map(status => `
    <option value="${status}" ${status === current ? 'selected' : ''}>${formatOrderStatus(status)}</option>
  `).join('');
}

function buildOrderLines(order) {
  return (order.products || []).map(product => `
    <div class="order-line order-line-detailed">
      <div class="order-line-primary">
        ${buildOrderPhoto(product)}
        <div class="order-line-main">
          <strong>${escapeHtml(product.name)} x ${product.quantity}</strong>
          <div class="order-line-sub">${escapeHtml(product.category || 'General')} | Supplier ${renderCurrency(product.sourceUnitPrice || 0)} each | Revenue ${renderCurrency(product.lineRevenue || 0)}</div>
          <div class="order-line-links">
            ${product.sourceUrl ? `<a class="queue-link" href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">Open supplier link</a>` : '<span>No supplier link</span>'}
          </div>
        </div>
      </div>
      <div class="order-line-profit">${renderCurrency(product.lineProfit || 0)} profit</div>
    </div>
  `).join('');
}

function buildOrderStatusPills(order) {
  const fulfillment = order.fulfillment || {};
  const paymentStatus = formatPaymentStatus(order.payment?.status);
  const trackingId = fulfillment.trackingId || '';
  const supplierOrderRef = fulfillment.supplierOrderRef || '';
  const cancelledAt = fulfillment.cancelledAt || '';
  const cancelReason = fulfillment.cancelReason || '';

  return `
    <div class="order-status-line">
      <span class="order-pill">Payment ${escapeHtml(paymentStatus)}</span>
      <span class="order-pill">Updated ${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</span>
      ${supplierOrderRef ? `<span class="order-pill">Supplier Ref ${escapeHtml(supplierOrderRef)}</span>` : ''}
      ${trackingId ? `<span class="order-pill">Tracking ${escapeHtml(trackingId)}</span>` : ''}
      ${cancelledAt ? `<span class="order-pill order-pill-alert">Cancelled ${escapeHtml(formatDateTime(cancelledAt))}</span>` : ''}
      ${cancelReason ? `<span class="order-pill order-pill-alert">${escapeHtml(cancelReason)}</span>` : ''}
    </div>
  `;
}

function buildShippingBlock(order) {
  const shipping = order.shipping || {};
  const customer = order.customer || {};

  return `
    <div class="shipping-block">
      <h4>Customer Shipping Details</h4>
      <p>${escapeHtml(customer.address || shipping.address || 'No shipping address saved')}</p>
      <div class="shipping-meta">
        <span>Pincode: ${escapeHtml(customer.pincode || shipping.pincode || '--')}</span>
        <span>Phone: ${escapeHtml(customer.phone || '--')}</span>
        <span>Email: ${escapeHtml(customer.email || '--')}</span>
      </div>
    </div>
  `;
}

function buildOrderActionForm(order) {
  const fulfillment = order.fulfillment || {};

  return `
    <form class="order-actions" data-order-id="${escapeHtml(order.orderId)}">
      <div class="order-form-grid">
        <label class="order-field">
          <span>Order Status</span>
          <select name="status">
            ${buildStatusOptions(fulfillment.status)}
          </select>
        </label>
        <label class="order-field">
          <span>Supplier Order Ref</span>
          <input name="supplierOrderRef" type="text" value="${escapeHtml(fulfillment.supplierOrderRef || '')}" placeholder="Optional supplier order reference">
        </label>
        <label class="order-field">
          <span>Carrier</span>
          <input name="carrier" type="text" value="${escapeHtml(fulfillment.carrier || '')}" placeholder="Blue Dart, Delhivery, etc.">
        </label>
        <label class="order-field">
          <span>Tracking ID</span>
          <input name="trackingId" type="text" value="${escapeHtml(fulfillment.trackingId || '')}" placeholder="Add shipping tracking number">
        </label>
      </div>
      <label class="order-field">
        <span>Notes</span>
        <textarea name="notes" placeholder="Optional admin notes">${escapeHtml(fulfillment.notes || '')}</textarea>
      </label>
      <div class="order-form-row">
        <button class="order-save-btn" type="submit">Save Status Update</button>
        <div class="order-save-note">
          Created ${escapeHtml(formatDateTime(order.createdAt))} | ${escapeHtml(order.orderId)}
        </div>
      </div>
    </form>
  `;
}

function renderRecentOrders(orders) {
  const container = document.getElementById('recent-orders');
  const count = document.getElementById('orders-count');
  if (!container) return;

  if (count) {
    count.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
  }

  if (!orders.length) {
    container.innerHTML = '<p class="empty-state">No customer orders matched this search.</p>';
    return;
  }

  container.innerHTML = orders.map(order => {
    const status = normalizeOrderStatus(order.fulfillment?.status);

    return `
      <article class="order-card">
        <div class="order-card-head">
          <div>
            <div class="queue-kicker">${escapeHtml(order.orderId)}</div>
            <h3>${escapeHtml(order.customer?.name || 'Customer')}</h3>
            <p>${escapeHtml([order.customer?.phone, order.customer?.email].filter(Boolean).join(' | ') || 'No contact saved')}</p>
          </div>
          <div class="order-status status-${status}">${escapeHtml(formatOrderStatus(status))}</div>
        </div>
        <div class="order-meta-grid">
          <div><span>Revenue</span><strong>${renderCurrency(order.totals?.revenue || 0)}</strong></div>
          <div><span>Supplier Cost</span><strong>${renderCurrency(order.totals?.sourceCost || 0)}</strong></div>
          <div><span>Profit</span><strong>${renderCurrency(order.totals?.grossProfit || 0)}</strong></div>
          <div><span>Items</span><strong>${order.totals?.units || 0}</strong></div>
        </div>
        ${buildOrderStatusPills(order)}
        ${buildShippingBlock(order)}
        <div class="order-lines">
          ${buildOrderLines(order)}
        </div>
        ${buildOrderActionForm(order)}
      </article>
    `;
  }).join('');

  attachOrderActionHandlers();
}

function toggleCustomerHandled(customerKey, isHandled) {
  const handled = new Set(getHandledCustomers());
  if (isHandled) {
    handled.add(customerKey);
  } else {
    handled.delete(customerKey);
  }
  setHandledCustomers(Array.from(handled));
  renderDashboard();
}

function buildCustomerCard(customer, isHandled) {
  const checkboxId = `customer-${customer.key}`;
  return `
    <article class="customer-item">
      <div>
        <strong>${escapeHtml(customer.name)}</strong>
        <small>${escapeHtml([customer.phone, customer.email].filter(Boolean).join(' | ') || 'No contact saved')}</small>
        <small style="display:block; margin-top:6px;">${customer.ordersCount} order(s) | ${renderCurrency(customer.revenue)} | Latest ${escapeHtml(customer.latestOrderId || '--')}</small>
      </div>
      <label class="customer-toggle" for="${checkboxId}">
        <input
          id="${checkboxId}"
          type="checkbox"
          data-customer-key="${escapeHtml(customer.key)}"
          ${isHandled ? 'checked' : ''}
        >
        ${isHandled ? 'Handled' : 'Pending'}
      </label>
    </article>
  `;
}

function renderCustomerLists(orders) {
  const searchTerm = adminState.searchTerm;
  const allCustomers = buildCustomerRecords(orders);
  const handled = new Set(getHandledCustomers());
  const allPendingCustomers = allCustomers.filter(customer => !handled.has(customer.key)).sort((a, b) => {
    const aNum = parseInt(a.latestOrderId.split('_')[1] || 0);
    const bNum = parseInt(b.latestOrderId.split('_')[1] || 0);
    return bNum - aNum; // descending
  });
  const allHandledCustomers = allCustomers.filter(customer => handled.has(customer.key));

  const customers = allCustomers.filter(customer => {
    if (!searchTerm) return true;
    const haystack = [
      customer.name,
      customer.phone,
      customer.email,
      customer.latestOrderId
    ].join(' ').toLowerCase();
    return haystack.includes(searchTerm);
  });

  const pendingCustomers = customers.filter(customer => !handled.has(customer.key)).sort((a, b) => {
    const aNum = parseInt(a.latestOrderId.split('_')[1] || 0);
    const bNum = parseInt(b.latestOrderId.split('_')[1] || 0);
    return bNum - aNum;
  });
  const handledCustomers = customers.filter(customer => handled.has(customer.key));
  const visiblePendingCustomers = pendingCustomers.slice(0, searchTerm ? CUSTOMER_RESULT_LIMIT : 1);
  const visibleHandledCustomers = handledCustomers.slice(0, CUSTOMER_RESULT_LIMIT);

  const pendingContainer = document.getElementById('pending-customers');
  const handledContainer = document.getElementById('handled-customers');
  const pendingCount = document.getElementById('pending-count');
  const handledCount = document.getElementById('handled-count');
  const searchStatus = document.getElementById('customer-search-status');

  if (pendingCount) {
    pendingCount.textContent = searchTerm
      ? pendingCustomers.length > CUSTOMER_RESULT_LIMIT
        ? `${visiblePendingCustomers.length} of ${pendingCustomers.length} pending`
        : `${pendingCustomers.length} pending`
      : `${allPendingCustomers.length} pending`;
  }
  if (handledCount) {
    handledCount.textContent = searchTerm
      ? handledCustomers.length > CUSTOMER_RESULT_LIMIT
        ? `${visibleHandledCustomers.length} of ${handledCustomers.length} handled`
        : `${handledCustomers.length} handled`
      : `${allHandledCustomers.length} handled`;
  }
  if (searchStatus) {
    if (!searchTerm) {
      searchStatus.textContent = `Search to reveal up to ${CUSTOMER_RESULT_LIMIT} matching customers in the pending and handled lists.`;
    } else if (!pendingCustomers.length && !handledCustomers.length) {
      searchStatus.textContent = `No customers found for "${searchTerm}".`;
    } else if (pendingCustomers.length > CUSTOMER_RESULT_LIMIT || handledCustomers.length > CUSTOMER_RESULT_LIMIT) {
      searchStatus.textContent = `Showing up to ${CUSTOMER_RESULT_LIMIT} customer matches per list for "${searchTerm}".`;
    } else {
      searchStatus.textContent = `Showing customer matches for "${searchTerm}".`;
    }
  }

  if (!searchTerm) {
    if (pendingContainer) {
      const visiblePending = allPendingCustomers.slice(0, 1);
      pendingContainer.innerHTML = visiblePending.length
        ? visiblePending.map(customer => buildCustomerCard(customer, false)).join('')
        : '<p class="empty-state">No pending customers.</p>';
    }

    if (handledContainer) {
      handledContainer.innerHTML = allHandledCustomers.length
        ? allHandledCustomers.map(customer => buildCustomerCard(customer, true)).join('')
        : '<p class="empty-state">No handled customers.</p>';
    }
    return;
  }

  if (pendingContainer) {
    pendingContainer.innerHTML = visiblePendingCustomers.length
      ? visiblePendingCustomers.map(customer => buildCustomerCard(customer, false)).join('')
      : '<p class="empty-state">No pending customers matched the current search.</p>';
  }

  if (handledContainer) {
    handledContainer.innerHTML = visibleHandledCustomers.length
      ? visibleHandledCustomers.map(customer => buildCustomerCard(customer, true)).join('')
      : '<p class="empty-state">No handled customers matched the current search.</p>';
  }

  document.querySelectorAll('[data-customer-key]').forEach(input => {
    input.addEventListener('change', event => {
      toggleCustomerHandled(event.target.dataset.customerKey, event.target.checked);
    });
  });
}

function bindSearchControls() {
  const form = document.getElementById('customer-search-form');
  const input = document.getElementById('customer-search-input');
  const clear = document.getElementById('customer-search-clear');
  if (!form || !input || !clear || form.dataset.bound === 'true') return;

  const applySearch = value => {
    adminState.searchTerm = normalizeSearchTerm(value);
    renderDashboard();
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    applySearch(input.value);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    applySearch('');
    input.focus();
  });

  form.dataset.bound = 'true';
}

function bindProductSearchControls() {
  const form = document.getElementById('product-search-form');
  const input = document.getElementById('product-search-input');
  const clear = document.getElementById('product-search-clear');
  if (!form || !input || !clear || form.dataset.bound === 'true') return;

  const applySearch = value => {
    adminState.productSearchTerm = normalizeSearchTerm(value);
    renderDashboard();
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    applySearch(input.value);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    applySearch('');
    input.focus();
  });

  form.dataset.bound = 'true';
}

function buildOrderUpdatePayload(form) {
  return {
    fulfillment: {
      status: form.querySelector('[name="status"]').value,
      supplierOrderRef: form.querySelector('[name="supplierOrderRef"]').value,
      carrier: form.querySelector('[name="carrier"]').value,
      trackingId: form.querySelector('[name="trackingId"]').value,
      notes: form.querySelector('[name="notes"]').value
    }
  };
}

async function refreshAnalytics() {
  let serverAnalytics = null;
  let localAnalytics = ReyvalOrderTools.getLocalAnalytics();
  
  try {
    serverAnalytics = await requestAdminData('/api/analytics');
  } catch (error) {
    console.log('Server analytics not available, using local analytics');
  }
  
  if (serverAnalytics) {
    // Merge server and local orders, avoiding duplicates by orderId
    const serverOrderIds = new Set(serverAnalytics.recentOrders.map(order => order.orderId));
    const uniqueLocalOrders = localAnalytics.recentOrders.filter(order => !serverOrderIds.has(order.orderId));
    
    adminState.analytics = {
      ...serverAnalytics,
      recentOrders: [...serverAnalytics.recentOrders, ...uniqueLocalOrders],
      totals: {
        orders: serverAnalytics.totals.orders + uniqueLocalOrders.length,
        units: serverAnalytics.totals.units + localAnalytics.totals.units,
        revenue: serverAnalytics.totals.revenue + localAnalytics.totals.revenue,
        sourceCost: serverAnalytics.totals.sourceCost + localAnalytics.totals.sourceCost,
        grossProfit: serverAnalytics.totals.grossProfit + localAnalytics.totals.grossProfit
      },
      statusBreakdown: {
        pending: serverAnalytics.statusBreakdown.pending + localAnalytics.statusBreakdown.pending,
        placed: serverAnalytics.statusBreakdown.placed + localAnalytics.statusBreakdown.placed,
        shipped: serverAnalytics.statusBreakdown.shipped + localAnalytics.statusBreakdown.shipped,
        delivered: serverAnalytics.statusBreakdown.delivered + localAnalytics.statusBreakdown.delivered,
        cancelled: serverAnalytics.statusBreakdown.cancelled + localAnalytics.statusBreakdown.cancelled
      }
    };
  } else {
    adminState.analytics = localAnalytics;
  }
}

async function refreshAdminContext() {
  try {
    const config = await requestAdminData('/api/config');
    adminState.storageMode = config.storageMode || 'local-file';
    adminState.firebaseEnabled = Boolean(config.firebaseEnabled);
  } catch (error) {
    adminState.storageMode = 'local-file';
    adminState.firebaseEnabled = false;
  }
}

async function refreshProductCatalog() {
  try {
    const response = await requestAdminData('/api/products');
    adminState.productCatalog = (response.products || []).map(product => normalizeProductRecord(product));
    if (response.storageMode) {
      adminState.storageMode = response.storageMode;
    }
  } catch (error) {
    adminState.productCatalog = ((window.REYVAL_CATALOG && window.REYVAL_CATALOG.products) || [])
      .map(product => normalizeProductRecord(product));
  }
}

async function saveOrderUpdate(orderId, payload) {
  try {
    const response = await requestAdminData(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (response.order) {
      ReyvalOrderTools.mirrorOrder(response.order);
    }

    await refreshAnalytics();
    renderDashboard();
    return true;
  } catch (error) {
    if (typeof ReyvalOrderTools.updateLocalOrder === 'function') {
      const localOrder = ReyvalOrderTools.updateLocalOrder(orderId, payload);
      if (localOrder) {
        await refreshAnalytics(); // Refresh to merge server + updated local
        renderDashboard();
        return true;
      }
    }

    console.error('Unable to update order', error);
    return false;
  }
}

function buildProductUpdatePayload(form) {
  return {
    price: parseMoneyInput(form.querySelector('[name="price"]').value),
    supplierPrice: parseMoneyInput(form.querySelector('[name="supplierPrice"]').value),
    sourceLabel: form.querySelector('[name="sourceLabel"]').value.trim(),
    sourceUrl: form.querySelector('[name="sourceUrl"]').value.trim(),
    imageUrl: form.querySelector('[name="imageUrl"]').value.trim()
  };
}

async function saveProductUpdate(productId, payload) {
  try {
    const response = await requestAdminData(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (response.product) {
      const updatedProduct = normalizeProductRecord(response.product);
      const productIndex = adminState.productCatalog.findIndex(product => product.id === updatedProduct.id);

      if (productIndex >= 0) {
        adminState.productCatalog[productIndex] = updatedProduct;
      } else {
        adminState.productCatalog.unshift(updatedProduct);
      }
    }

    renderDashboard();
    return true;
  } catch (error) {
    console.error('Unable to update product', error);
    return false;
  }
}

function attachOrderActionHandlers() {
  document.querySelectorAll('.order-actions').forEach(form => {
    if (form.dataset.bound === 'true') return;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('.order-save-btn');
      const note = form.querySelector('.order-save-note');
      const orderId = form.dataset.orderId;
      const payload = buildOrderUpdatePayload(form);

      if (button) {
        button.disabled = true;
        button.textContent = 'Saving...';
      }
      if (note) {
        note.textContent = 'Saving order update...';
      }

      const saved = await saveOrderUpdate(orderId, payload);

      if (!saved) {
        if (button) {
          button.disabled = false;
          button.textContent = 'Save Status Update';
        }
        if (note) {
          note.textContent = 'Unable to save right now. Please try again.';
        }
      }
    });

    form.dataset.bound = 'true';
  });
}

function attachProductActionHandlers() {
  document.querySelectorAll('.product-actions').forEach(form => {
    if (form.dataset.bound === 'true') return;

    const priceInput = form.querySelector('[name="price"]');
    const supplierPriceInput = form.querySelector('[name="supplierPrice"]');
    const sourceUrlInput = form.querySelector('[name="sourceUrl"]');
    const imageUrlInput = form.querySelector('[name="imageUrl"]');
    const marginOutput = form.querySelector('[data-margin-output]');
    const profitBadge = form.closest('.product-card')?.querySelector('[data-product-profit-badge]');
    const sourceLink = form.querySelector('[data-source-link]');
    const sourceLinkLabel = form.querySelector('[data-source-link-label]');
    const imagePreview = form.closest('.product-card')?.querySelector('[data-product-preview]');
    const imagePreviewEmpty = form.closest('.product-card')?.querySelector('[data-product-preview-empty]');

    const syncProductMeta = () => {
      const margin = parseMoneyInput(priceInput?.value) - parseMoneyInput(supplierPriceInput?.value);
      if (marginOutput) {
        marginOutput.textContent = renderCurrency(margin);
      }
      if (profitBadge) {
        profitBadge.textContent = `Profit ${renderCurrency(margin)}`;
      }
      if (sourceLink && sourceUrlInput) {
        const value = sourceUrlInput.value.trim();
        sourceLink.setAttribute('href', value || '#');
        sourceLink.textContent = value ? 'Open supplier page' : 'Supplier link missing';
      }
      if (sourceLinkLabel && sourceUrlInput) {
        sourceLinkLabel.textContent = sourceUrlInput.value.trim()
          ? 'Supplier link ready to save.'
          : 'No supplier link saved yet.';
      }
      if (imagePreview && imagePreviewEmpty && imageUrlInput) {
        const value = imageUrlInput.value.trim();
        if (value) {
          imagePreview.src = value;
          imagePreview.alt = form.closest('.product-card')?.querySelector('h3')?.textContent || 'Product photo';
          imagePreview.hidden = false;
          imagePreviewEmpty.hidden = true;
        } else {
          imagePreview.src = '';
          imagePreview.alt = '';
          imagePreview.hidden = true;
          imagePreviewEmpty.hidden = false;
        }
      }
    };

    [priceInput, supplierPriceInput, sourceUrlInput, imageUrlInput].forEach(input => {
      if (!input) return;
      input.addEventListener('input', syncProductMeta);
    });

    if (adminState.firebaseEnabled) {
      form.addEventListener('submit', async event => {
        event.preventDefault();

        const button = form.querySelector('.product-save-btn');
        const note = form.querySelector('.product-save-note');
        const productId = form.dataset.productId;
        const payload = buildProductUpdatePayload(form);

        if (button) {
          button.disabled = true;
          button.textContent = 'Saving...';
        }
        if (note) {
          note.textContent = 'Saving product update...';
        }

        const saved = await saveProductUpdate(productId, payload);
        if (!saved) {
          if (button) {
            button.disabled = false;
            button.textContent = 'Save Product';
          }
          if (note) {
            note.textContent = 'Unable to save right now. Please try again.';
          }
        }
      });
    }

    syncProductMeta();
    form.dataset.bound = 'true';
  });
}

function renderDashboard() {
  renderKpis(adminState.analytics.totals || {}, adminState.analytics.statusBreakdown || {});
  renderTopProducts(adminState.analytics.topProducts || []);
  renderProcurementQueue(adminState.analytics.procurementQueue || []);
  renderProductStorageStatus();
  renderProductCatalog(adminState.productCatalog || []);

  const filteredOrders = (adminState.analytics.recentOrders || []).filter(order => {
    return customerMatchesSearch(order, adminState.searchTerm);
  });

  renderCustomerLists(adminState.analytics.recentOrders || []);
  renderRecentOrders(filteredOrders);
}

async function loadAdminDashboard() {
  await Promise.all([
    refreshAnalytics(),
    refreshAdminContext(),
    refreshProductCatalog()
  ]);
  bindSearchControls();
  bindProductSearchControls();
  renderDashboard();
}

window.addEventListener('DOMContentLoaded', loadAdminDashboard);
