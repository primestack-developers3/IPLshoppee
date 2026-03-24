// ============================================
// UNIFIED CART MANAGEMENT SYSTEM FOR IPL SHOPPEE
// ============================================
// This script provides persistent cart functionality across ALL pages
// Works with header.html and cart-panel.html components

// Get cart from localStorage
function getCart() {
  return JSON.parse(localStorage.getItem('iplCart')) || [];
}

// Save cart to localStorage
function saveCart(cart) {
  localStorage.setItem('iplCart', JSON.stringify(cart));
  updateCartCount();
  dispatchCartUpdate();
}

// Update cart count in header badge
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  // Update header badge
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  
  // Dispatch custom event for real-time updates
  dispatchCartUpdate();
}

// Dispatch cart update event
function dispatchCartUpdate() {
  window.dispatchEvent(new CustomEvent('cartUpdated', {
    detail: { cart: getCart() }
  }));
}

// Initialize cart on page load
function initializeCart() {
  updateCartCount();
  dispatchCartUpdate();
}

// ============================================
// CART OPERATIONS
// ============================================

// Add item to cart
function addToCart(productName, price, productId = null) {
  const cart = getCart();
  const id = productId || ('product_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
  
  const existingItem = cart.find(item => item.id === id || item.name === productName);
  
  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    cart.push({
      id: id,
      name: productName,
      price: price,
      quantity: 1
    });
  }
  
  saveCart(cart);
  showToast(`✓ ${productName} added to cart!`);
  console.log(`Added to cart: ${productName} - ₹${price}`);
}

// Remove item from cart
function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== productId);
  saveCart(cart);
  showToast('Item removed from cart');
}

// Update item quantity
function updateQuantity(productId, quantity) {
  let cart = getCart();
  
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity = quantity;
    saveCart(cart);
  }
}

// Clear entire cart
function clearAllCart() {
  if (confirm('Are you sure you want to clear your entire cart?')) {
    localStorage.removeItem('iplCart');
    updateCartCount();
    dispatchCartUpdate();
    const container = document.getElementById('cartItemsContainer');
    if (container) {
      const cart = getCart();
      if (cart.length === 0) {
        container.innerHTML = `
          <div class="iplpro-cart-empty">
            <div style="font-size: 3rem;">🛒</div>
            <div>Your cart is empty</div>
            <button onclick="closeCartPanel()" class="iplpro-nav-btn">Continue Shopping</button>
          </div>
        `;
      }
    }
    showToast('Cart cleared');
  }
}

// ============================================
// UI FUNCTIONS
// ============================================

// Show toast notification
function showToast(message = 'Added to cart!') {
  // Try to find existing toast
  let toast = document.getElementById('toast');
  
  // If no toast exists, create one
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #2563eb;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 700;
      z-index: 2000;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2000);
}

// ============================================
// CART PERSISTENCE ACROSS PAGES
// ============================================

// UI helpers for product and checkout modals
let currentProductModal = null;

function showProductModal(title, emoji, price, rating, reviews, description) {
  currentProductModal = { title, emoji, price, rating, reviews, description };
  const productModal = document.getElementById('productModal');
  if (!productModal) return;

  document.getElementById('productModalTitle').textContent = title;
  document.getElementById('productModalTitle2').textContent = title;
  document.getElementById('productModalImage').textContent = emoji;
  document.getElementById('productModalPrice').textContent = price;
  document.getElementById('productModalRating').textContent = `${rating} (${reviews} reviews)`;
  document.getElementById('productModalDescription').textContent = description;

  productModal.classList.add('active');
}

function closeProductModal() {
  const productModal = document.getElementById('productModal');
  if (productModal) {
    productModal.classList.remove('active');
  }
  currentProductModal = null;
}

function addToCartFromModal() {
  if (!currentProductModal) return;

  const priceStr = currentProductModal.price.replace('₹', '').replace(',', '');
  const price = parseInt(priceStr);
  addToCart(currentProductModal.title, price);
  closeProductModal();
}

function proceedToCheckout() {
  closeCartPanel();
  const productsGrid = document.querySelector('.grid');
  const checkoutSection = document.getElementById('checkout');
  if (productsGrid && checkoutSection) {
    productsGrid.style.display = 'none';
    checkoutSection.style.display = 'block';
    updateOrderSummary();
  }
}

function updateOrderSummary() {
  const orderItems = document.getElementById('order-items');
  const totalPrice = document.getElementById('total-price');
  if (!orderItems || !totalPrice) return;

  const cart = getCart();
  orderItems.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex justify-between';
    itemDiv.textContent = `${item.name} x${item.quantity || 1} - ₹${itemTotal}`;
    orderItems.appendChild(itemDiv);
  });

  totalPrice.textContent = `₹${total}`;
}

function showCheckout() {
  proceedToCheckout();
}

// Close modals when clicking outside
function handleDocumentClick(event) {
  const cartModal = document.getElementById('cartModal');
  const productModal = document.getElementById('productModal');

  if (cartModal && event.target === cartModal) {
    closeCartModal();
  }

  if (productModal && event.target === productModal) {
    closeProductModal();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeCart();
  const paymentForm = document.getElementById('payment-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Payment processed successfully! (This is a demo - in real implementation, this would connect to a payment gateway)');
      localStorage.removeItem('iplCart');
      updateCartCount();
      const productsGrid = document.querySelector('.grid');
      const checkoutSection = document.getElementById('checkout');
      if (productsGrid && checkoutSection) {
        productsGrid.style.display = 'grid';
        checkoutSection.style.display = 'none';
      }
      closeCartPanel();
    });
  }
  document.addEventListener('click', handleDocumentClick);
});

// Save cart before leaving page
window.addEventListener('beforeunload', () => {
  const cart = getCart();
  localStorage.setItem('iplCart', JSON.stringify(cart));
});
