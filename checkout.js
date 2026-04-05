const API_BASE = (window.REYVAL_API_BASE || '').replace(/\/$/, '');

let paymentConfig = {
  paymentMode: 'manual',
  hasRealPayment: false,
  razorpayKeyId: ''
};

function resolveApiUrl(path) {
  if (API_BASE) {
    return `${API_BASE}${path}`;
  }
  return path;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function getCheckoutCart() {
  if (typeof getCart === 'function') {
    return getCart();
  }
  return JSON.parse(localStorage.getItem('reyvalCart') || '[]');
}

function renderOrderSummary() {
  const cart = getCheckoutCart();
  const container = document.getElementById('orderSummary');
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = '<p class="text-slate-400">Your bag is empty.</p>';
    const totalAmountEl = document.getElementById('totalAmount');
    if (totalAmountEl) totalAmountEl.textContent = '0';
    return;
  }

  const products = ReyvalOrderTools.hydrateCart(cart);
  const total = products.reduce((sum, item) => sum + item.lineRevenue, 0);

  container.innerHTML = products.map(item => `
    <div class="order-summary-item">
      <div class="flex-1">
        <div class="font-semibold">${item.name}</div>
        <div class="text-slate-400 text-sm">${ReyvalOrderTools.formatCurrency(item.saleUnitPrice)} x ${item.quantity}</div>
      </div>
      <div class="font-bold text-right">${ReyvalOrderTools.formatCurrency(item.lineRevenue)}</div>
    </div>
  `).join('');

  const totalAmountEl = document.getElementById('totalAmount');
  if (totalAmountEl) {
    totalAmountEl.textContent = String(total);
  }
}

function validateCheckoutForm() {
  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const email = document.getElementById('email');
  const address = document.getElementById('address');
  const pincode = document.getElementById('pincode');

  let isValid = true;

  document.querySelectorAll('.form-group').forEach(group => {
    group.classList.remove('error');
  });

  if (!fullName.value.trim()) {
    fullName.parentElement.classList.add('error');
    isValid = false;
  }

  if (!/^\d{10}$/.test(phone.value.replace(/\D/g, ''))) {
    phone.parentElement.classList.add('error');
    isValid = false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    email.parentElement.classList.add('error');
    isValid = false;
  }

  if (!address.value.trim()) {
    address.parentElement.classList.add('error');
    isValid = false;
  }

  if (!/^\d{6}$/.test(pincode.value.replace(/\D/g, ''))) {
    pincode.parentElement.classList.add('error');
    isValid = false;
  }

  if (!isValid) {
    showToast('Please fill all fields correctly.', 'error');
  }

  return isValid;
}

function getCustomerData() {
  return {
    fullName: document.getElementById('fullName').value.trim(),
    phone: document.getElementById('phone').value.replace(/\D/g, ''),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    pincode: document.getElementById('pincode').value.replace(/\D/g, '')
  };
}

function setButtonLoading(isLoading, label = 'Place Order') {
  const button = document.getElementById('payNowBtn');
  if (!button) return;

  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<span class="loading-spinner"></span> Processing...'
    : label;
}

function updateCheckoutModeUi() {
  const modePanel = document.getElementById('paymentModePanel');
  const modeLabel = document.getElementById('paymentModeLabel');
  const button = document.getElementById('payNowBtn');

  const usingRazorpay = paymentConfig.paymentMode === 'razorpay' && paymentConfig.hasRealPayment;

  if (modeLabel) {
    modeLabel.textContent = usingRazorpay
      ? 'Secure payment is enabled through Razorpay.'
      : 'Payment API is not configured, so orders will be captured for manual follow-up.';
  }

  if (modePanel) {
    modePanel.innerHTML = usingRazorpay
      ? `
        <p class="text-sm"><strong>Payment mode:</strong> Razorpay checkout is ready.</p>
        <p class="text-sm mt-2">Once payment is successful, the order will be logged with sourcing details for Meesho follow-up.</p>
      `
      : `
        <p class="text-sm"><strong>Order mode:</strong> Your customer details and cart will still be captured properly.</p>
        <p class="text-sm mt-2">Use the admin orders dashboard to see what customers bought, expected source cost, and which Meesho link to open next.</p>
      `;
  }

  if (button) {
    button.textContent = usingRazorpay ? 'Pay Securely' : 'Place Order';
  }
}

async function loadPaymentConfig() {
  try {
    paymentConfig = await apiRequest('/api/config');
  } catch (error) {
    paymentConfig = {
      paymentMode: 'manual',
      hasRealPayment: false,
      razorpayKeyId: ''
    };
  }

  updateCheckoutModeUi();
}

async function createOrderRecord(customer, cart, payment) {
  try {
    const response = await apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customer, cart, payment })
    });

    const order = response.order;
    ReyvalOrderTools.mirrorOrder(order);
    return order;
  } catch (error) {
    const order = ReyvalOrderTools.buildLocalOrder({
      customer,
      cart,
      payment,
      source: 'browser-local'
    });
    ReyvalOrderTools.persistLocalOrder(order);
    return order;
  }
}

function completeCheckout(order, successMessage = 'Order placed successfully.') {
  localStorage.removeItem('reyvalCart');
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }

  showToast(successMessage, 'success');

  setTimeout(() => {
    window.location.href = `order-success.html?orderId=${encodeURIComponent(order.orderId)}`;
  }, 900);
}

async function finalizeOrder(customer, cart, payment) {
  const order = await createOrderRecord(customer, cart, payment);
  completeCheckout(order);
}

async function launchRazorpayCheckout(customer, cart) {
  const payload = await apiRequest('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ customer, cart })
  });

  if (payload.paymentMode !== 'razorpay' || !payload.order?.id) {
    await finalizeOrder(customer, cart, {
      mode: 'manual',
      provider: 'manual',
      status: 'pending_manual_review'
    });
    return;
  }

  const options = {
    key: payload.razorpayKeyId,
    amount: payload.order.amount,
    currency: payload.order.currency,
    name: 'Reyval',
    description: 'Luxury checkout',
    order_id: payload.order.id,
    prefill: {
      name: customer.fullName,
      contact: customer.phone,
      email: customer.email
    },
    theme: {
      color: '#d4af37'
    },
    handler: async response => {
      try {
        const verification = await apiRequest('/api/payments/verify', {
          method: 'POST',
          body: JSON.stringify(response)
        });

        if (!verification.order) {
          throw new Error('Verified payment did not return an order record.');
        }

        ReyvalOrderTools.mirrorOrder(verification.order);
        completeCheckout(verification.order, 'Payment received. Order placed successfully.');
      } catch (error) {
        console.error('Payment verification failed:', error);
        showToast('Payment verification failed. Please contact support.', 'error');
        setButtonLoading(false, 'Pay Securely');
      }
    },
    modal: {
      ondismiss: () => {
        setButtonLoading(false, 'Pay Securely');
      }
    }
  };

  const razorpay = new Razorpay(options);
  razorpay.open();
}

async function handlePayment() {
  if (!validateCheckoutForm()) {
    return;
  }

  const cart = getCheckoutCart();
  if (!cart.length) {
    showToast('Your cart is empty.', 'error');
    return;
  }

  const customer = getCustomerData();
  const usingRazorpay = paymentConfig.paymentMode === 'razorpay' && paymentConfig.hasRealPayment && typeof Razorpay !== 'undefined';

  setButtonLoading(true, usingRazorpay ? 'Pay Securely' : 'Place Order');

  try {
    if (usingRazorpay) {
      await launchRazorpayCheckout(customer, cart);
      return;
    }

    await finalizeOrder(customer, cart, {
      mode: 'manual',
      provider: 'manual',
      status: 'pending_manual_review'
    });
  } catch (error) {
    console.error('Checkout failed:', error);
    showToast('Checkout failed. Please try again.', 'error');
    setButtonLoading(false, usingRazorpay ? 'Pay Securely' : 'Place Order');
  }
}

function goBackToCart() {
  window.location.href = 'cart.html';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

window.handlePayment = handlePayment;
window.goBackToCart = goBackToCart;
window.renderOrderSummary = renderOrderSummary;

window.addEventListener('DOMContentLoaded', async () => {
  const cart = getCheckoutCart();
  renderOrderSummary();

  if (!cart.length) {
    showToast('Your cart is empty. Redirecting home...', 'error');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 1600);
    return;
  }

  await loadPaymentConfig();
});
