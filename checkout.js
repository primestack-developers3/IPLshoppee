// Checkout Form Handler
// Handles form validation, payment initiation, and order processing

// Update with a test Razorpay key for demo
const RAZORPAY_KEY = 'rzp_test_1DP5MMOk9HyR63'; // Test key for demo
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
    // For now, generate a demo order ID
    const demoOrderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Get customer data
    const customerData = {
      fullName: document.getElementById('fullName').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
    };

    // Open Razorpay Checkout directly
    openRazorpayCheckout(demoOrderId, customerData);

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
  // For demo purposes, skip Razorpay and directly process the order
  const demoResponse = {
    razorpay_payment_id: 'pay_demo_' + Date.now(),
    razorpay_order_id: razorpayOrderId,
    razorpay_signature: 'demo_signature_' + Date.now()
  };
  
  // Directly process the payment as successful (no actual Razorpay call)
  handlePaymentSuccess(demoResponse, customerData);
}

async function handlePaymentSuccess(paymentResponse, customerData) {
  const btn = document.getElementById('payNowBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Processing Order...';

  try {
    // Create sequential order number and ID
    let orderIndex = parseInt(localStorage.getItem('orderCounter') || '0', 10) || 0;
    orderIndex += 1;
    localStorage.setItem('orderCounter', orderIndex.toString());

    const orderId = `ORDER_${orderIndex}`;

    // Prepare order data
    const cart = getCart();
    const totalAmount = calculateTotal();
    const orderData = {
      orderId: orderId,
      orderNumber: orderIndex,
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
      totalAmount: totalAmount,
      razorpayPaymentId: paymentResponse.razorpay_payment_id || 'demo_payment_' + Date.now(),
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };

    // Save order and amount for success page visibility
    localStorage.setItem('lastOrder', JSON.stringify(orderData));
    sessionStorage.setItem('checkoutTotal', orderData.totalAmount);
    sessionStorage.setItem('orderSuccessId', orderData.orderId);

    // Store order in admin list (persistent across sessions)
    const adminOrders = JSON.parse(localStorage.getItem('adminOrders') || '[]');
    adminOrders.push(orderData);
    localStorage.setItem('adminOrders', JSON.stringify(adminOrders));

    // Clear cart
    localStorage.removeItem('iplCart');
    updateCartCount();

    // Show success message
    showToast('✓ Order placed successfully!', 'success');

    // Redirect to success page
    setTimeout(() => {
      window.location.href = 'order-success.html?orderId=' + orderData.orderId;
    }, 1500);

  } catch (error) {
    console.error('Order processing error:', error);
    showToast('Order completed but there was an issue. Please contact support.', 'error');
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
  // Initialize cart from localStorage
  const cart = getCart();
  
  // Render order summary
  renderOrderSummary();

  // If cart is empty, redirect back to home
  if (cart.length === 0) {
    showToast('Your cart is empty. Redirecting to home...', 'error');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 2000);
  }
});
