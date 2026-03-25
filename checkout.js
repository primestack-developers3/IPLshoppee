// Checkout Form Handler
// Handles form validation, payment initiation, and order processing

const RAZORPAY_KEY = 'YOUR_RAZORPAY_KEY_ID'; // Replace with actual key
const API_BASE = 'http://localhost:3000'; // Replace with actual API base

function renderOrderSummary() {
  const cart = getCart();
  const container = document.getElementById('orderSummary');
  if (!container || cart.length === 0) return;

  let total = 0;
  let html = '';

  cart.forEach(item => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    html += `
      <div class="order-summary-item">
        <div class="flex-1">
          <div class="font-600">${item.name}</div>
          <div class="text-slate-400 text-sm">₹${item.price} × ${item.quantity || 1}</div>
        </div>
        <div class="font-700 text-right">₹${itemTotal}</div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update total
  const totalAmountEl = document.getElementById('totalAmount');
  if (totalAmountEl) {
    totalAmountEl.textContent = total;
  }
}

function validateCheckoutForm() {
  const form = document.getElementById('checkoutForm');
  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const address = document.getElementById('address');

  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('.form-group').forEach(group => {
    group.classList.remove('error');
  });

  // Validate full name
  if (!fullName.value.trim()) {
    fullName.parentElement.classList.add('error');
    isValid = false;
  }

  // Validate phone (10 digits)
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(phone.value.replace(/\D/g, ''))) {
    phone.parentElement.classList.add('error');
    isValid = false;
  }

  // Validate address
  if (!address.value.trim()) {
    address.parentElement.classList.add('error');
    isValid = false;
  }

  if (!isValid) {
    showToast('Please fill all fields correctly', 'error');
  }

  return isValid;
}

async function handlePayment() {
  // Validate form first
  if (!validateCheckoutForm()) {
    return;
  }

  // Validate cart is not empty
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }

  const btn = document.getElementById('payNowBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Processing...';

  try {
    // Step 1: Create Razorpay Order
    const orderResponse = await fetch(`${API_BASE}/api/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: calculateTotal(),
        currency: 'INR',
      }),
    });

    if (!orderResponse.ok) {
      throw new Error('Failed to create order');
    }

    const { orderId } = await orderResponse.json();

    // Step 2: Open Razorpay Checkout
    const customerData = {
      fullName: document.getElementById('fullName').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
    };

    openRazorpayCheckout(orderId, customerData);

  } catch (error) {
    console.error('Payment error:', error);
    showToast('Payment initialization failed. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Pay Now with Razorpay';
  }
}

function calculateTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => {
    return total + (item.price * (item.quantity || 1));
  }, 0);
}

function openRazorpayCheckout(razorpayOrderId, customerData) {
  const options = {
    key: RAZORPAY_KEY,
    amount: calculateTotal() * 100, // Razorpay expects amount in paise
    currency: 'INR',
    name: 'IPL PRO Fan Store',
    description: 'Order from IPL Shoppee',
    order_id: razorpayOrderId,
    prefill: {
      name: customerData.fullName,
      contact: customerData.phone,
    },
    handler: async function (response) {
      // Payment successful, save order
      await handlePaymentSuccess(response, customerData);
    },
    modal: {
      ondismiss: function () {
        showToast('Payment cancelled', 'error');
        const btn = document.getElementById('payNowBtn');
        btn.disabled = false;
        btn.innerHTML = 'Pay Now with Razorpay';
      },
    },
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

async function handlePaymentSuccess(paymentResponse, customerData) {
  const btn = document.getElementById('payNowBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Saving Order...';

  try {
    // Prepare order data
    const cart = getCart();
    const orderData = {
      customer: {
        name: customerData.fullName,
        phone: customerData.phone,
        address: customerData.address,
      },
      products: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
      })),
      totalAmount: calculateTotal(),
      razorpayOrderId: paymentResponse.razorpay_order_id,
      razorpayPaymentId: paymentResponse.razorpay_payment_id,
      razorpaySignature: paymentResponse.razorpay_signature,
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };

    // Save order to backend
    const saveResponse = await fetch(`${API_BASE}/api/save-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!saveResponse.ok) {
      throw new Error('Failed to save order');
    }

    const result = await saveResponse.json();

    // Clear cart
    localStorage.removeItem('iplCart');
    cart = [];

    // Show success message
    showToast('✓ Order placed successfully!', 'success');

    // Redirect after brief delay
    setTimeout(() => {
      window.location.href = 'order-success.html?orderId=' + result.orderId;
    }, 2000);

  } catch (error) {
    console.error('Order save error:', error);
    showToast('Order saved but there was an issue. Please contact support.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Pay Now with Razorpay';
  }
}

function goBackToCart() {
  window.history.back();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  // Cart should already be loaded via cart-manager.js
  renderOrderSummary();

  if (cart.length === 0) {
    showToast('No items in cart', 'error');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 2000);
  }
});
