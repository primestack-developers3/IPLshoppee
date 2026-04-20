import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { getFirebaseFirestore, loadEnvFile, readSafeFile } from './firebase-utils.mjs';
import { generateAndSaveBill } from './bill-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'reyval-catalog.js');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');

loadEnvFile(ENV_FILE);

const PORT = Number(process.env.REYVAL_PORT || process.env.PORT || 3000);
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const FIREBASE_ORDERS_COLLECTION = process.env.FIREBASE_ORDERS_COLLECTION || 'reyval_orders';
const FIREBASE_PRODUCTS_COLLECTION = process.env.FIREBASE_PRODUCTS_COLLECTION || 'reyval_products';
const FIREBASE_CUSTOMERS_COLLECTION = process.env.FIREBASE_CUSTOMERS_COLLECTION || 'reyval_customers';
const AUTO_CANCEL_WINDOW_MS = 30 * 60 * 60 * 1000;
const AUTO_CANCEL_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const ORDER_STATUS_VALUES = new Set(['pending', 'placed', 'shipped', 'delivered', 'cancelled']);
const pendingPaymentSessions = new Map();
const completedPaymentOrders = new Map();
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendNotFound(response) {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
}

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

async function parseJsonBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }

  if (!body) return {};
  return JSON.parse(body);
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOrderStatus(value) {
  return ORDER_STATUS_VALUES.has(value) ? value : 'pending';
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
  const cancellationReason = fulfillment.cancelReason || 'Auto-cancelled because the supplier order was not placed within 30 hours.';

  return {
    changed: true,
    order: {
      ...order,
      fulfillment: {
        ...fulfillment,
        status: 'cancelled',
        supplierOrderStatus: 'cancelled',
        cancelledAt: fulfillment.cancelledAt || timestamp,
        cancelReason: cancellationReason,
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

async function getStorageContext() {
  const firebase = await getFirebaseFirestore({ appName: 'reyval-server' });
  return {
    firebaseEnabled: firebase.enabled,
    firebaseReason: firebase.reason,
    db: firebase.db
  };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDataDir();
  await writeFile(filePath, JSON.stringify(data ?? [], null, 2), 'utf8');
}

async function loadCatalog() {
  const raw = await readFile(CATALOG_FILE, 'utf8');
  const jsonText = raw.replace(/^window\.REYVAL_CATALOG = /, '').replace(/;\s*$/, '');
  return JSON.parse(jsonText);
}

function normalizeProductRecord(record, index = 0) {
  const salePrice = toNumber(record.price ?? record.saleUnitPrice, 0);
  const supplierPrice = toNumber(
    record.supplierPrice ?? record.originalPrice ?? record.sourceUnitPrice,
    Math.round(salePrice / 2)
  );
  const sourceUrl = record.sourceUrl || record.supplierUrl || '';
  const sourceLabel = record.sourceLabel || record.supplierName || 'Manual sourcing';

  return {
    id: record.id || `product_${index + 1}`,
    name: record.name || `Product ${index + 1}`,
    category: record.category || record.categoryId || 'general',
    categoryLabel: record.categoryLabel || record.category || 'General',
    description: record.description || '',
    imageUrl: record.imageUrl || '',
    price: salePrice,
    originalPrice: supplierPrice,
    supplierPrice,
    sourceUrl,
    supplierUrl: sourceUrl,
    sourceLabel,
    sourceName: sourceLabel,
    updatedAt: record.updatedAt || nowIso()
  };
}

async function loadFirebaseProducts(db) {
  const snapshot = await db.collection(FIREBASE_PRODUCTS_COLLECTION).get();
  return snapshot.docs.map((doc, index) => normalizeProductRecord({ id: doc.id, ...doc.data() }, index));
}

async function loadProductCatalog() {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    const firebaseProducts = await loadFirebaseProducts(storage.db);
    if (firebaseProducts.length) {
      return firebaseProducts;
    }
  }

  const catalog = await loadCatalog();
  return (catalog.products || []).map((product, index) => normalizeProductRecord(product, index));
}

async function getProductById(productId) {
  const products = await loadProductCatalog();
  return products.find(product => product.id === productId) || null;
}

async function loadOrders() {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    const snapshot = await storage.db.collection(FIREBASE_ORDERS_COLLECTION).get();
    const orders = [];
    const dirtyOrders = [];

    snapshot.docs.forEach(doc => {
      const { order, changed } = applyOrderLifecyclePolicies({ orderId: doc.id, ...doc.data() });
      orders.push(order);
      if (changed) {
        dirtyOrders.push(order);
      }
    });

    await Promise.all(
      dirtyOrders.map(order =>
        storage.db.collection(FIREBASE_ORDERS_COLLECTION).doc(order.orderId).set(order, { merge: false })
      )
    );

    return orders.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }

  const orders = await readJsonFile(ORDERS_FILE, []);
  const processedOrders = [];
  const dirtyOrders = [];

  orders.forEach(order => {
    const next = applyOrderLifecyclePolicies(order);
    processedOrders.push(next.order);
    if (next.changed) {
      dirtyOrders.push(next.order);
    }
  });

  if (dirtyOrders.length) {
    await writeJsonFile(ORDERS_FILE, processedOrders);
  }

  return processedOrders
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

async function loadOrderById(orderId) {
  if (!orderId) return null;

  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    const snapshot = await storage.db.collection(FIREBASE_ORDERS_COLLECTION).doc(orderId).get();
    if (!snapshot.exists) {
      return null;
    }

    const next = applyOrderLifecyclePolicies({ orderId: snapshot.id, ...snapshot.data() });
    if (next.changed) {
      await storage.db.collection(FIREBASE_ORDERS_COLLECTION).doc(orderId).set(next.order, { merge: false });
    }
    return next.order;
  }

  const orders = await readJsonFile(ORDERS_FILE, []);
  const item = orders.find(item => item.orderId === orderId);
  if (!item) {
    return null;
  }

  const next = applyOrderLifecyclePolicies(item);
  if (next.changed) {
    const index = orders.findIndex(entry => entry.orderId === orderId);
    orders[index] = next.order;
    await writeJsonFile(ORDERS_FILE, orders);
  }

  return next.order;
}

async function saveOrder(order) {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    await storage.db.collection(FIREBASE_ORDERS_COLLECTION).doc(order.orderId).set(order, { merge: false });
    return order;
  }

  const orders = await readJsonFile(ORDERS_FILE, []);
  const index = orders.findIndex(item => item.orderId === order.orderId);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.push(order);
  }
  await writeJsonFile(ORDERS_FILE, orders);
  return order;
}

async function updateOrder(orderId, nextOrder) {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    await storage.db.collection(FIREBASE_ORDERS_COLLECTION).doc(orderId).set(nextOrder, { merge: false });
    return nextOrder;
  }

  const orders = await readJsonFile(ORDERS_FILE, []);
  const index = orders.findIndex(item => item.orderId === orderId);
  if (index >= 0) {
    orders[index] = nextOrder;
  } else {
    orders.push(nextOrder);
  }
  await writeJsonFile(ORDERS_FILE, orders);
  return nextOrder;
}

async function saveCustomer(customer) {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    await storage.db.collection(FIREBASE_CUSTOMERS_COLLECTION).doc(customer.customerId.toString()).set(customer, { merge: false });
    return customer;
  }

  const customers = await readJsonFile(CUSTOMERS_FILE, []);
  const index = customers.findIndex(item => String(item.customerId) === String(customer.customerId));
  if (index >= 0) {
    customers[index] = customer;
  } else {
    customers.push(customer);
  }
  await writeJsonFile(CUSTOMERS_FILE, customers);
  return customer;
}

async function loadCustomerByIdFromOrdersOrCustomers(customer) {
  const storage = await getStorageContext();
  if (storage.firebaseEnabled && storage.db) {
    const customersRef = storage.db.collection(FIREBASE_CUSTOMERS_COLLECTION);
    const phoneQuery = await customersRef.where('phone', '==', customer.phone).get();
    if (!phoneQuery.empty) {
      const doc = phoneQuery.docs[0];
      return { customerId: doc.id, ...doc.data() };
    }
    if (customer.email) {
      const emailQuery = await customersRef.where('email', '==', customer.email).get();
      if (!emailQuery.empty) {
        const doc = emailQuery.docs[0];
        return { customerId: doc.id, ...doc.data() };
      }
    }
  }

  const customers = await readJsonFile(CUSTOMERS_FILE, []);
  const foundCustomer = customers.find(item =>
    item.phone === customer.phone || (customer.email && item.email === customer.email)
  );
  if (foundCustomer) {
    return foundCustomer;
  }

  const orders = await loadOrders();
  return orders.find(order =>
    order.customer?.phone === customer.phone ||
    (customer.email && order.customer?.email === customer.email)
  );
}

async function loadCustomerById(customerId) {
  const storage = await getStorageContext();

  if (storage.firebaseEnabled && storage.db) {
    const doc = await storage.db.collection(FIREBASE_CUSTOMERS_COLLECTION).doc(customerId.toString()).get();
    if (doc.exists) {
      return { customerId, ...doc.data() };
    }
    return null;
  }

  const customers = await readJsonFile(CUSTOMERS_FILE, []);
  return customers.find(item => String(item.customerId) === String(customerId)) || null;
}

async function updateProduct(productId, patch) {
  const storage = await getStorageContext();
  if (!(storage.firebaseEnabled && storage.db)) {
    throw new Error('Firebase product database is not configured.');
  }

  const docRef = storage.db.collection(FIREBASE_PRODUCTS_COLLECTION).doc(productId);
  const current = await docRef.get();
  const existing = current.exists
    ? normalizeProductRecord({ id: current.id, ...current.data() })
    : await getProductById(productId);

  if (!existing) {
    throw new Error(`Product ${productId} was not found.`);
  }

  const next = normalizeProductRecord({
    ...existing,
    ...patch,
    sourceUrl: patch.sourceUrl || patch.supplierUrl || existing.sourceUrl,
    supplierUrl: patch.sourceUrl || patch.supplierUrl || existing.sourceUrl,
    sourceLabel: patch.sourceLabel || patch.sourceName || existing.sourceLabel,
    supplierPrice: patch.supplierPrice ?? patch.originalPrice ?? existing.supplierPrice,
    originalPrice: patch.supplierPrice ?? patch.originalPrice ?? existing.supplierPrice,
    price: patch.price ?? existing.price,
    updatedAt: nowIso()
  });

  await docRef.set(next, { merge: true });
  return next;
}

async function hydrateCart(cart) {
  const products = await loadProductCatalog();
  const catalogIndex = new Map(products.map(product => [product.id, product]));

  return (cart || []).map((item, index) => {
    const product = catalogIndex.get(item.id) || products.find(entry => entry.name === item.name);
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const saleUnitPrice = toNumber(product?.price ?? item.price, 0);
    const sourceUnitPrice = toNumber(
      product?.supplierPrice ?? product?.originalPrice ?? item.sourceUnitPrice,
      Math.round(saleUnitPrice / 2)
    );
    const lineRevenue = saleUnitPrice * quantity;
    const lineCost = sourceUnitPrice * quantity;
    const sourceUrl = product?.sourceUrl || product?.supplierUrl || '';
    const sourceLabel = product?.sourceLabel || product?.sourceName || 'Manual sourcing';

    return {
      id: product?.id || item.id || `custom-item-${index + 1}`,
      name: product?.name || item.name || `Product ${index + 1}`,
      category: product?.categoryLabel || product?.category || 'General',
      categoryId: product?.category || 'general',
      imageUrl: product?.imageUrl || '',
      sourceUrl,
      supplierUrl: sourceUrl,
      sourceLabel,
      quantity,
      saleUnitPrice,
      sourceUnitPrice,
      lineRevenue,
      lineCost,
      lineProfit: lineRevenue - lineCost
    };
  });
}

function buildTotals(products) {
  return products.reduce((totals, product) => {
    totals.units += toNumber(product.quantity, 0);
    totals.revenue += toNumber(product.lineRevenue, 0);
    totals.sourceCost += toNumber(product.lineCost, 0);
    totals.grossProfit += toNumber(product.lineProfit, 0);
    return totals;
  }, {
    units: 0,
    revenue: 0,
    sourceCost: 0,
    grossProfit: 0
  });
}

function buildCustomer(customer = {}) {
  const name = customer.fullName || customer.name || '';
  const address = customer.address || '';
  const pincode = customer.pincode || '';

  return {
    name,
    phone: customer.phone || '',
    email: customer.email || '',
    address,
    pincode,
    shippingAddress: address,
    shippingPincode: pincode
  };
}

function buildPayment(payment = {}, totals = {}) {
  const timestamp = nowIso();
  return {
    mode: payment.mode || 'manual',
    provider: payment.provider || payment.mode || 'manual',
    status: payment.status || 'pending_manual_review',
    amount: toNumber(payment.amount, toNumber(totals.revenue, 0)),
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

async function buildOrder({ customer, cart, payment, source = 'server-api' }) {
  const orders = await loadOrders();
  const products = await hydrateCart(cart);
  const totals = buildTotals(products);
  const normalizedCustomer = buildCustomer(customer);
  const paymentSnapshot = buildPayment(payment, totals);

  const orderNumber = orders.reduce((max, order) => Math.max(max, toNumber(order.orderNumber, 0)), 0) + 1;

  // Check if customer exists
  let customerId;
  const existingCustomer = await loadCustomerByIdFromOrdersOrCustomers(normalizedCustomer);
  if (existingCustomer) {
    customerId = existingCustomer.customerId;
  } else {
    // Assign new customer ID
    const allOrders = await loadOrders();
    customerId = allOrders.reduce((max, order) => Math.max(max, toNumber(order.customerId, 0)), 0) + 1;
    // Save new customer
    const customerRecord = {
      customerId,
      ...normalizedCustomer,
      firstOrderAt: nowIso(),
      totalOrders: 0,
      totalSpent: 0
    };
    await saveCustomer(customerRecord);
  }

  return {
    orderId: `ORDER_${String(orderNumber).padStart(4, '0')}`,
    orderNumber,
    customerId,
    customer: normalizedCustomer,
    shipping: buildInitialShipping(normalizedCustomer),
    products,
    totals,
    payment: paymentSnapshot,
    fulfillment: buildInitialFulfillment(),
    source,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function getStatusBreakdown(orders) {
  return orders.reduce((breakdown, order) => {
    const status = normalizeOrderStatus(order.fulfillment?.status);
    breakdown[status] = (breakdown[status] || 0) + 1;
    return breakdown;
  }, {
    pending: 0,
    placed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  });
}

function getAnalyticsFromOrders(orders) {
  const totals = {
    orders: orders.length,
    units: 0,
    revenue: 0,
    sourceCost: 0,
    grossProfit: 0
  };

  const productMap = new Map();
  const categoryMap = new Map();
  const procurementMap = new Map();

  orders.forEach(order => {
    totals.units += toNumber(order.totals?.units, 0);
    totals.revenue += toNumber(order.totals?.revenue, 0);
    totals.sourceCost += toNumber(order.totals?.sourceCost, 0);
    totals.grossProfit += toNumber(order.totals?.grossProfit, 0);

    const isPendingProcurement = normalizeOrderStatus(order.fulfillment?.status) === 'pending';

    (order.products || []).forEach(product => {
      const key = product.id || product.name;
      if (!productMap.has(key)) {
        productMap.set(key, {
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

      const summary = productMap.get(key);
      summary.quantity += toNumber(product.quantity, 0);
      summary.revenue += toNumber(product.lineRevenue, 0);
      summary.sourceCost += toNumber(product.lineCost, 0);
      summary.grossProfit += toNumber(product.lineProfit, 0);

      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          category: product.category,
          quantity: 0,
          revenue: 0
        });
      }

      const categorySummary = categoryMap.get(product.category);
      categorySummary.quantity += toNumber(product.quantity, 0);
      categorySummary.revenue += toNumber(product.lineRevenue, 0);

      if (isPendingProcurement) {
        if (!procurementMap.has(key)) {
          procurementMap.set(key, {
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

        const procurementSummary = procurementMap.get(key);
        procurementSummary.quantity += toNumber(product.quantity, 0);
        procurementSummary.revenue += toNumber(product.lineRevenue, 0);
        procurementSummary.sourceCost += toNumber(product.lineCost, 0);
        procurementSummary.grossProfit += toNumber(product.lineProfit, 0);
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
  const recentOrders = [...orders].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

  return {
    totals,
    topProducts,
    categories,
    procurementQueue,
    recentOrders,
    statusBreakdown: getStatusBreakdown(orders)
  };
}

function paymentConfigPayload(storage) {
  return {
    paymentMode: RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET ? 'razorpay' : 'manual',
    paymentProvider: RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET ? 'razorpay' : 'manual',
    hasRealPayment: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
    razorpayKeyId: RAZORPAY_KEY_ID || '',
    storageMode: storage?.firebaseEnabled ? 'firebase' : 'local-file',
    firebaseEnabled: Boolean(storage?.firebaseEnabled),
    firebaseReason: storage?.firebaseReason || 'local_file_mode'
  };
}

async function createRazorpayOrder(amountInPaise, receipt, customer) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        source: 'reyval',
        customer_phone: customer.phone || ''
      }
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const generated = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generated === signature;
}

function buildFulfillmentPatch(order, payload = {}) {
  const timestamp = nowIso();
  const current = order.fulfillment || {};
  const currentStatus = normalizeOrderStatus(current.status);
  const requestedStatus = normalizeOrderStatus(payload.status || currentStatus);
  const cancellationReason = typeof payload.cancelReason === 'string'
    ? payload.cancelReason.trim()
    : (current.cancelReason || '');

  const next = {
    status: requestedStatus,
    supplierOrderStatus: getSupplierOrderStatus(requestedStatus),
    supplierOrderRef: typeof payload.supplierOrderRef === 'string' ? payload.supplierOrderRef.trim() : (current.supplierOrderRef || ''),
    carrier: typeof payload.carrier === 'string' ? payload.carrier.trim() : (current.carrier || ''),
    trackingId: typeof payload.trackingId === 'string' ? payload.trackingId.trim() : (current.trackingId || ''),
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : (current.notes || ''),
    placedAt: current.placedAt || '',
    shippedAt: current.shippedAt || '',
    deliveredAt: current.deliveredAt || '',
    cancelledAt: current.cancelledAt || '',
    cancelReason: current.cancelReason || '',
    updatedAt: timestamp
  };

  if (['placed', 'shipped', 'delivered'].includes(requestedStatus) && !next.placedAt) {
    next.placedAt = timestamp;
  }
  if (['shipped', 'delivered'].includes(requestedStatus) && !next.shippedAt) {
    next.shippedAt = timestamp;
  }
  if (requestedStatus === 'delivered' && !next.deliveredAt) {
    next.deliveredAt = timestamp;
  }
  if (requestedStatus === 'cancelled' && !next.cancelledAt) {
    next.cancelledAt = timestamp;
  }
  if (requestedStatus === 'cancelled') {
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

function applyOrderUpdate(order, payload = {}) {
  const timestamp = nowIso();
  const fulfillmentPayload = payload.fulfillment || payload;
  const nextFulfillment = buildFulfillmentPatch(order, fulfillmentPayload);
  const nextPayment = payload.payment
    ? buildPayment({ ...order.payment, ...payload.payment }, order.totals)
    : order.payment;

  return {
    ...order,
    payment: nextPayment,
    fulfillment: nextFulfillment,
    shipping: buildShippingPatch(order, nextFulfillment),
    updatedAt: timestamp
  };
}

function parseResourceId(pathname, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^${escaped}/([^/]+)$`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sweepAutoCancelledOrders() {
  await loadOrders();
}

async function handleApi(request, response, url) {
  const storage = await getStorageContext();

  if (request.method === 'GET' && url.pathname === '/api/config') {
    sendJson(response, 200, paymentConfigPayload(storage));
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/products') {
    const products = await loadProductCatalog();
    sendJson(response, 200, {
      products,
      storageMode: storage.firebaseEnabled ? 'firebase' : 'local-file'
    });
    return true;
  }

  const productId = parseResourceId(url.pathname, '/api/products');
  if (request.method === 'PATCH' && productId) {
    try {
      const body = await parseJsonBody(request);
      const product = await updateProduct(productId, body);
      sendJson(response, 200, { product });
    } catch (error) {
      sendError(response, 400, error.message || 'Unable to update product');
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/create-order') {
    const body = await parseJsonBody(request);
    const products = await hydrateCart(body.cart || []);
    const totals = buildTotals(products);
    const config = paymentConfigPayload(storage);

    if (!config.hasRealPayment) {
      sendJson(response, 200, {
        paymentMode: 'manual',
        paymentProvider: 'manual',
        order: null
      });
      return true;
    }

    try {
      const order = await createRazorpayOrder(totals.revenue * 100, `reyval_${Date.now()}`, body.customer || {});
      pendingPaymentSessions.set(order.id, {
        customer: body.customer || {},
        cart: body.cart || [],
        amount: totals.revenue,
        createdAt: nowIso()
      });
      sendJson(response, 200, {
        paymentMode: 'razorpay',
        paymentProvider: 'razorpay',
        razorpayKeyId: RAZORPAY_KEY_ID,
        order
      });
    } catch (error) {
      sendError(response, 502, `Unable to create Razorpay order: ${error.message}`);
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/verify') {
    if (!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)) {
      sendJson(response, 200, { verified: false, reason: 'razorpay_not_configured' });
      return true;
    }

    const body = await parseJsonBody(request);
    const completedOrder = completedPaymentOrders.get(body.razorpay_payment_id || '');
    if (completedOrder) {
      sendJson(response, 200, { verified: true, order: completedOrder });
      return true;
    }

    const verified = verifyRazorpaySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature
    );

    if (!verified) {
      sendError(response, 400, 'Invalid payment signature');
      return true;
    }

    const pendingSession = pendingPaymentSessions.get(body.razorpay_order_id);
    if (!pendingSession) {
      const existingOrders = await loadOrders();
      const existingOrder = existingOrders.find(order =>
        order.payment?.providerPaymentId === body.razorpay_payment_id ||
        order.payment?.providerOrderId === body.razorpay_order_id
      );

      if (existingOrder) {
        completedPaymentOrders.set(body.razorpay_payment_id, existingOrder);
        sendJson(response, 200, { verified: true, order: existingOrder });
        return true;
      }

      sendError(response, 410, 'Payment session expired before the order could be created.');
      return true;
    }

    const order = await buildOrder({
      customer: pendingSession.customer,
      cart: pendingSession.cart,
      payment: {
        mode: 'razorpay',
        provider: 'razorpay',
        status: 'paid',
        amount: pendingSession.amount,
        currency: 'INR',
        providerOrderId: body.razorpay_order_id,
        providerPaymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
        capturedAt: nowIso()
      },
      source: 'server-api-razorpay'
    });

    await saveOrder(order);
    pendingPaymentSessions.delete(body.razorpay_order_id);
    completedPaymentOrders.set(body.razorpay_payment_id, order);

    sendJson(response, 200, { verified: true, order });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const body = await parseJsonBody(request);
    const order = await buildOrder({
      customer: body.customer || {},
      cart: body.cart || [],
      payment: body.payment || {},
      source: 'server-api'
    });
    await saveOrder(order);

    // Update customer stats
    try {
      const customer = await loadCustomerById(order.customerId);
      if (customer) {
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + order.totals.revenue;
        customer.lastOrderAt = order.createdAt;
        await saveCustomer(customer);
      }
    } catch (error) {
      console.error('Customer update failed:', error);
    }

    // Generate and save bill
    try {
      const billResult = await generateAndSaveBill(order);
      order.bill = {
        generated: true,
        driveFileId: billResult.driveFileId,
        localPath: billResult.localFilePath,
        pdfAvailable: true
      };
      await updateOrder(order.orderId, order); // Update order with bill info
    } catch (error) {
      console.error('Bill generation failed:', error);
      order.bill = { generated: false, error: error.message };
    }

    sendJson(response, 201, { order });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/orders') {
    const requestedOrderId = url.searchParams.get('orderId');

    if (requestedOrderId) {
      const order = await loadOrderById(requestedOrderId);
      sendJson(response, 200, { order });
      return true;
    }

    const orders = await loadOrders();
    sendJson(response, 200, { orders });
    return true;
  }

  const orderId = parseResourceId(url.pathname, '/api/orders');
  if (request.method === 'GET' && orderId) {
    const order = await loadOrderById(orderId);
    sendJson(response, 200, { order });
    return true;
  }

  if (request.method === 'PATCH' && orderId) {
    const currentOrder = await loadOrderById(orderId);
    if (!currentOrder) {
      sendError(response, 404, `Order ${orderId} was not found.`);
      return true;
    }

    const body = await parseJsonBody(request);
    const nextOrder = applyOrderUpdate(currentOrder, body);
    await updateOrder(orderId, nextOrder);
    sendJson(response, 200, { order: nextOrder });
    return true;
  }

  if (request.method === 'GET' && url.pathname.endsWith('/bill')) {
    const billOrderId = url.pathname.split('/').slice(-2)[0]; // Extract orderId from /api/orders/{orderId}/bill
    const order = await loadOrderById(billOrderId);
    if (!order) {
      sendError(response, 404, `Order ${billOrderId} was not found.`);
      return true;
    }

    const { pdfBuffer } = await generateAndSaveBill(order);
    response.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice_${order.orderId}.pdf"`,
      'Content-Length': String(pdfBuffer.length)
    });
    response.end(pdfBuffer);
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/analytics') {
    const orders = await loadOrders();
    sendJson(response, 200, getAnalyticsFromOrders(orders));
    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = decodeURIComponent(filePath);

  const resolvedPath = path.normalize(path.join(ROOT_DIR, filePath));
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    sendError(response, 403, 'Forbidden');
    return;
  }

  let finalPath = resolvedPath;
  try {
    const fileStats = await stat(finalPath);
    if (fileStats.isDirectory()) {
      finalPath = path.join(finalPath, 'index.html');
    }
  } catch {
    sendNotFound(response);
    return;
  }

  const extension = path.extname(finalPath).toLowerCase();
  const type = MIME_TYPES[extension] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': type });
  createReadStream(finalPath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (await handleApi(request, response, url)) {
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    sendError(response, 500, 'Internal Server Error');
  }
});

server.listen(PORT, () => {
  const storageHint = readSafeFile(ENV_FILE).includes('FIREBASE_')
    ? 'Firebase-ready'
    : 'local-file fallback';
  console.log(`Reyval server running on http://localhost:${PORT} (${storageHint})`);
});

sweepAutoCancelledOrders().catch(error => {
  console.error('Initial auto-cancel sweep failed:', error);
});

const autoCancelTimer = setInterval(() => {
  sweepAutoCancelledOrders().catch(error => {
    console.error('Auto-cancel sweep failed:', error);
  });
}, AUTO_CANCEL_SWEEP_INTERVAL_MS);

if (typeof autoCancelTimer.unref === 'function') {
  autoCancelTimer.unref();
}
