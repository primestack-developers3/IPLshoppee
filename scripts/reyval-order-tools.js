(() => {
  const STORAGE_KEYS = {
    orders: 'adminOrders',
    lastOrder: 'lastOrder',
    orderCounter: 'orderCounter',
    customerCounter: 'customerCounter'
  };
  const AUTO_CANCEL_WINDOW_MS = 30 * 60 * 60 * 1000;
  const ORDER_STATUSES = ['pending', 'placed', 'shipped', 'delivered', 'cancelled'];

  const catalog = window.REYVAL_CATALOG || { products: [] };
  const catalogIndex = new Map((catalog.products || []).map(product => [product.id, product]));

  function safeParse(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Unable to parse ${key}`, error);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeOrderStatus(value) {
    return ORDER_STATUSES.includes(value) ? value : 'pending';
  }

  function getSupplierOrderStatus(status) {
    switch (normalizeOrderStatus(status)) {
      case 'placed':
        return 'placed';
      case 'shipped':
        return 'shipped';
      case 'delivered':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      case 'pending':
      default:
        return 'pending';
    }
  }

  function getShippingStatus(status) {
    switch (normalizeOrderStatus(status)) {
      case 'placed':
        return 'processing';
      case 'shipped':
        return 'shipped';
      case 'delivered':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      case 'pending':
      default:
        return 'pending';
    }
  }

  function shouldAutoCancelOrder(order) {
    const status = normalizeOrderStatus(order?.fulfillment?.status);
    if (status !== 'pending') {
      return false;
    }

    const createdAt = new Date(order?.createdAt || 0).getTime();
    if (!Number.isFinite(createdAt) || createdAt <= 0) {
      return false;
    }

    return Date.now() - createdAt >= AUTO_CANCEL_WINDOW_MS;
  }

  function applyOrderLifecyclePolicies(order) {
    if (!shouldAutoCancelOrder(order)) {
      return { order, changed: false };
    }

    const timestamp = nowIso();
    const fulfillment = order.fulfillment || {};

    return {
      changed: true,
      order: {
        ...order,
        fulfillment: {
          ...fulfillment,
          status: 'cancelled',
          supplierOrderStatus: 'cancelled',
          cancelledAt: fulfillment.cancelledAt || timestamp,
          cancelReason: fulfillment.cancelReason || 'Auto-cancelled because the supplier order was not placed within 30 hours.',
          updatedAt: timestamp
        },
        shipping: {
          ...(order.shipping || {}),
          status: 'cancelled',
          updatedAt: timestamp
        },
        updatedAt: timestamp
      }
    };
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function getCatalogProduct(cartItem) {
    if (!cartItem) return null;
    if (cartItem.id && catalogIndex.has(cartItem.id)) {
      return catalogIndex.get(cartItem.id);
    }
    return (catalog.products || []).find(product => product.name === cartItem.name) || null;
  }

  function hydrateCart(cart) {
    return (cart || []).map((item, index) => {
      const product = getCatalogProduct(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const saleUnitPrice = Number(product?.price ?? item.price ?? 0);
      const sourceUnitPrice = Number(product?.supplierPrice ?? product?.originalPrice ?? Math.round(saleUnitPrice / 2));
      const lineRevenue = saleUnitPrice * quantity;
      const lineCost = sourceUnitPrice * quantity;
      const sourceUrl = product?.sourceUrl || product?.supplierUrl || '';

      return {
        id: product?.id || item.id || `custom-item-${index + 1}`,
        name: product?.name || item.name || `Product ${index + 1}`,
        category: product?.categoryLabel || product?.category || 'General',
        categoryId: product?.category || 'general',
        imageUrl: product?.imageUrl || '',
        sourceUrl,
        supplierUrl: sourceUrl,
        sourceLabel: product?.sourceLabel || product?.sourceName || 'Manual sourcing',
        quantity,
        saleUnitPrice,
        sourceUnitPrice,
        lineRevenue,
        lineCost,
        lineProfit: lineRevenue - lineCost
      };
    });
  }

  function getLocalOrders() {
    const orders = safeParse(STORAGE_KEYS.orders, []);
    let changed = false;
    const nextOrders = orders.map(order => {
      const next = applyOrderLifecyclePolicies(order);
      if (next.changed) {
        changed = true;
      }
      return next.order;
    });

    if (changed) {
      safeWrite(STORAGE_KEYS.orders, nextOrders);
    }

    return nextOrders;
  }

  function setLocalOrders(orders) {
    safeWrite(STORAGE_KEYS.orders, orders);
  }

  function getExistingCustomerId(customer) {
    const orders = getLocalOrders();
    const match = orders.find(order =>
      order.customer?.phone === customer.phone ||
      (customer.email && order.customer?.email === customer.email)
    );
    return match?.customerId || null;
  }

  function nextCustomerId(customer) {
    const existing = getExistingCustomerId(customer);
    if (existing) {
      return existing;
    }

    let current = parseInt(localStorage.getItem(STORAGE_KEYS.customerCounter) || '0', 10) || 0;
    current += 1;
    localStorage.setItem(STORAGE_KEYS.customerCounter, String(current));
    return current;
  }

  function nextOrderNumber() {
    let current = parseInt(localStorage.getItem(STORAGE_KEYS.orderCounter) || '0', 10) || 0;
    current += 1;
    localStorage.setItem(STORAGE_KEYS.orderCounter, String(current));
    return current;
  }

  function buildTotals(products) {
    return products.reduce((totals, product) => {
      totals.units += product.quantity;
      totals.revenue += product.lineRevenue;
      totals.sourceCost += product.lineCost;
      totals.grossProfit += product.lineProfit;
      return totals;
    }, {
      units: 0,
      revenue: 0,
      sourceCost: 0,
      grossProfit: 0
    });
  }

  function buildPaymentSnapshot(payment = {}, totals = {}) {
    const timestamp = nowIso();
    return {
      mode: payment.mode || 'manual',
      provider: payment.provider || 'manual',
      status: payment.status || 'pending_manual_review',
      amount: Number(payment.amount ?? totals.revenue ?? 0),
      currency: payment.currency || 'INR',
      providerOrderId: payment.providerOrderId || '',
      providerPaymentId: payment.providerPaymentId || '',
      signature: payment.signature || '',
      capturedAt: payment.capturedAt || (payment.status === 'paid' ? timestamp : ''),
      updatedAt: timestamp
    };
  }

  function buildInitialFulfillment() {
    const timestamp = nowIso();
    return {
      status: 'pending',
      supplierOrderStatus: 'pending',
      supplierOrderRef: '',
      carrier: '',
      trackingId: '',
      notes: '',
      placedAt: '',
      shippedAt: '',
      deliveredAt: '',
      cancelledAt: '',
      cancelReason: '',
      updatedAt: timestamp
    };
  }

  function buildInitialShipping(customer) {
    return {
      status: 'pending',
      address: customer.address || '',
      pincode: customer.pincode || '',
      trackingId: '',
      carrier: '',
      updatedAt: nowIso()
    };
  }

  function buildLocalOrder({ customer, cart, payment, source = 'browser-local' }) {
    const products = hydrateCart(cart);
    const totals = buildTotals(products);
    const orderNumber = nextOrderNumber();
    const customerId = nextCustomerId(customer);
    const normalizedCustomer = {
      name: customer.fullName || customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      pincode: customer.pincode || '',
      shippingAddress: customer.address || '',
      shippingPincode: customer.pincode || ''
    };

    return {
      orderId: `ORDER_${String(orderNumber).padStart(4, '0')}`,
      orderNumber,
      customerId,
      customer: normalizedCustomer,
      shipping: buildInitialShipping(normalizedCustomer),
      products,
      totals,
      payment: buildPaymentSnapshot(payment, totals),
      fulfillment: buildInitialFulfillment(),
      source,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  function updateCountersFromOrder(order) {
    const orderCounter = parseInt(localStorage.getItem(STORAGE_KEYS.orderCounter) || '0', 10) || 0;
    const customerCounter = parseInt(localStorage.getItem(STORAGE_KEYS.customerCounter) || '0', 10) || 0;

    if ((order.orderNumber || 0) > orderCounter) {
      localStorage.setItem(STORAGE_KEYS.orderCounter, String(order.orderNumber));
    }

    if ((order.customerId || 0) > customerCounter) {
      localStorage.setItem(STORAGE_KEYS.customerCounter, String(order.customerId));
    }
  }

  function setLastOrder(order) {
    safeWrite(STORAGE_KEYS.lastOrder, order);
    sessionStorage.setItem('checkoutTotal', String(order.totals?.revenue || 0));
    sessionStorage.setItem('orderSuccessId', order.orderId);
  }

  function persistLocalOrder(order) {
    const orders = getLocalOrders();
    const next = applyOrderLifecyclePolicies(order).order;
    orders.push(next);
    setLocalOrders(orders);
    updateCountersFromOrder(next);
    setLastOrder(next);
    return next;
  }

  function mirrorOrder(order) {
    const orders = getLocalOrders();
    const next = applyOrderLifecyclePolicies(order).order;
    const existingIndex = orders.findIndex(item => item.orderId === next.orderId);
    if (existingIndex >= 0) {
      orders[existingIndex] = next;
    } else {
      orders.push(next);
    }
    setLocalOrders(orders);
    updateCountersFromOrder(next);
    setLastOrder(next);
  }

  function buildFulfillmentPatch(order, payload = {}) {
    const timestamp = nowIso();
    const current = order.fulfillment || {};
    const nextStatus = normalizeOrderStatus(payload.status || current.status);
    const currentStatus = normalizeOrderStatus(current.status);
    const cancellationReason = typeof payload.cancelReason === 'string'
      ? payload.cancelReason.trim()
      : (current.cancelReason || '');

    const next = {
      status: nextStatus,
      supplierOrderStatus: getSupplierOrderStatus(nextStatus),
      supplierOrderRef: payload.supplierOrderRef ?? current.supplierOrderRef ?? '',
      carrier: payload.carrier ?? current.carrier ?? '',
      trackingId: payload.trackingId ?? current.trackingId ?? '',
      notes: payload.notes ?? current.notes ?? '',
      placedAt: current.placedAt || '',
      shippedAt: current.shippedAt || '',
      deliveredAt: current.deliveredAt || '',
      cancelledAt: current.cancelledAt || '',
      cancelReason: current.cancelReason || '',
      updatedAt: timestamp
    };

    if (['placed', 'shipped', 'delivered'].includes(nextStatus) && !next.placedAt) {
      next.placedAt = timestamp;
    }
    if (['shipped', 'delivered'].includes(nextStatus) && !next.shippedAt) {
      next.shippedAt = timestamp;
    }
    if (nextStatus === 'delivered' && !next.deliveredAt) {
      next.deliveredAt = timestamp;
    }
    if (nextStatus === 'cancelled' && !next.cancelledAt) {
      next.cancelledAt = timestamp;
    }
    if (nextStatus === 'cancelled') {
      next.cancelReason = cancellationReason || 'Cancelled manually from the admin dashboard.';
    } else if (currentStatus === 'cancelled') {
      next.cancelledAt = '';
      next.cancelReason = '';
    }

    return next;
  }

  function buildShippingPatch(order, fulfillment) {
    return {
      status: getShippingStatus(fulfillment.status),
      address: order.customer?.address || '',
      pincode: order.customer?.pincode || '',
      trackingId: fulfillment.trackingId || '',
      carrier: fulfillment.carrier || '',
      updatedAt: nowIso()
    };
  }

  function updateLocalOrder(orderId, payload = {}) {
    const orders = getLocalOrders();
    const index = orders.findIndex(order => order.orderId === orderId);
    if (index === -1) return null;

    const current = orders[index];
    const fulfillmentPayload = payload.fulfillment || payload;
    const nextFulfillment = buildFulfillmentPatch(current, fulfillmentPayload);
    const nextOrder = {
      ...current,
      payment: payload.payment ? buildPaymentSnapshot({ ...current.payment, ...payload.payment }, current.totals) : current.payment,
      fulfillment: nextFulfillment,
      shipping: buildShippingPatch(current, nextFulfillment),
      updatedAt: nowIso()
    };

    orders[index] = applyOrderLifecyclePolicies(nextOrder).order;
    setLocalOrders(orders);
    setLastOrder(orders[index]);
    return orders[index];
  }

  function getOrderById(orderId) {
    if (!orderId) return null;
    const orders = getLocalOrders();
    return orders.find(order => order.orderId === orderId) || safeParse(STORAGE_KEYS.lastOrder, null);
  }

  function getLocalAnalytics() {
    const orders = [...getLocalOrders()].sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });

    const totals = {
      orders: orders.length,
      units: 0,
      revenue: 0,
      sourceCost: 0,
      grossProfit: 0
    };
    const statusBreakdown = {
      pending: 0,
      placed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    const productMap = new Map();
    const categoryMap = new Map();
    const procurementMap = new Map();

    orders.forEach(order => {
      const orderTotals = order.totals || {};
      const orderStatus = normalizeOrderStatus(order.fulfillment?.status);

      statusBreakdown[orderStatus] = (statusBreakdown[orderStatus] || 0) + 1;
      totals.units += Number(orderTotals.units || 0);
      totals.revenue += Number(orderTotals.revenue || 0);
      totals.sourceCost += Number(orderTotals.sourceCost || 0);
      totals.grossProfit += Number(orderTotals.grossProfit || 0);

      (order.products || []).forEach(product => {
        const productKey = product.id || product.name;
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            id: product.id,
            name: product.name,
            category: product.category,
            quantity: 0,
            revenue: 0,
            sourceCost: 0,
            grossProfit: 0,
            sourceUrl: product.sourceUrl,
            imageUrl: product.imageUrl
          });
        }

        const summary = productMap.get(productKey);
        summary.quantity += Number(product.quantity || 0);
        summary.revenue += Number(product.lineRevenue || 0);
        summary.sourceCost += Number(product.lineCost || 0);
        summary.grossProfit += Number(product.lineProfit || 0);

        if (!categoryMap.has(product.category)) {
          categoryMap.set(product.category, {
            category: product.category,
            quantity: 0,
            revenue: 0
          });
        }

        const categorySummary = categoryMap.get(product.category);
        categorySummary.quantity += Number(product.quantity || 0);
        categorySummary.revenue += Number(product.lineRevenue || 0);

        if (orderStatus === 'pending') {
          if (!procurementMap.has(productKey)) {
            procurementMap.set(productKey, {
              id: product.id,
              name: product.name,
              category: product.category,
              quantity: 0,
              revenue: 0,
              sourceCost: 0,
              grossProfit: 0,
              sourceUrl: product.sourceUrl,
              imageUrl: product.imageUrl
            });
          }

          const pendingSummary = procurementMap.get(productKey);
          pendingSummary.quantity += Number(product.quantity || 0);
          pendingSummary.revenue += Number(product.lineRevenue || 0);
          pendingSummary.sourceCost += Number(product.lineCost || 0);
          pendingSummary.grossProfit += Number(product.lineProfit || 0);
        }
      });
    });

    const topProducts = Array.from(productMap.values()).sort((left, right) => {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      return right.revenue - left.revenue;
    });

    const categories = Array.from(categoryMap.values()).sort((left, right) => right.revenue - left.revenue);
    const procurementQueue = Array.from(procurementMap.values()).sort((left, right) => {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      return right.sourceCost - left.sourceCost;
    });

    return {
      totals,
      topProducts,
      categories,
      procurementQueue,
      recentOrders: orders,
      statusBreakdown
    };
  }

  window.ReyvalOrderTools = {
    catalog,
    formatCurrency,
    hydrateCart,
    getLocalOrders,
    buildLocalOrder,
    persistLocalOrder,
    mirrorOrder,
    updateLocalOrder,
    getOrderById,
    getLocalAnalytics
  };
})();
