// Shared Cart Management System for IPL Shoppee
// This script provides persistent cart functionality across all pages

let cart = JSON.parse(localStorage.getItem('iplCart')) || [];
let currentProductModal = null;

// Initialize cart on page load
function initializeCart() {
  updateCartCount();
  renderCartItems();
}

function saveCartToLocalStorage() {
  localStorage.setItem('iplCart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = count;
  }
}

function addToCart(productName, price) {
  const existingItem = cart.find(item => item.name === productName);
  
  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    cart.push({
      name: productName,
      price: price,
      quantity: 1,
      id: Date.now() + Math.random()
    });
  }
  
  saveCartToLocalStorage();
  showToast();
  console.log(`Added to cart: ${productName} - ₹${price}`);
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCartToLocalStorage();
  renderCartItems();
}

function updateQuantity(id, quantity) {
  if (quantity <= 0) {
    removeFromCart(id);
    return;
  }
  const item = cart.find(item => item.id === id);
  if (item) {
    item.quantity = quantity;
    saveCartToLocalStorage();
    renderCartItems();
  }
}

function clearAllCart() {
  if (confirm('Are you sure you want to clear all items from your cart?')) {
    cart = [];
    saveCartToLocalStorage();
    renderCartItems();
  }
}

function renderCartItems() {
  const container = document.getElementById('cartItemsContainer');
  const summary = document.getElementById('cartSummary');
  
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <p>🛒 Your Dugout is empty! Start shopping to add items.</p>
        <button class="add-to-cart-btn" onclick="closeCartModal()" style="margin-top: 1rem;">Continue Shopping</button>
      </div>
    `;
    if (summary) summary.style.display = 'none';
    return;
  }

  let cartHTML = '';
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    cartHTML += `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price} each</div>
        </div>
        <div class="cart-item-controls">
          <div class="qty-control">
            <button class="qty-btn" onclick="updateQuantity(${item.id}, ${(item.quantity || 1) - 1})">−</button>
            <span class="qty-display">${item.quantity || 1}</span>
            <button class="qty-btn" onclick="updateQuantity(${item.id}, ${(item.quantity || 1) + 1})">+</button>
          </div>
          <div style="font-weight: 700; min-width: 80px; text-align: right;">₹${itemTotal}</div>
          <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = cartHTML;
  
  const totalPrice = document.getElementById('cartTotalPrice');
  if (totalPrice) {
    totalPrice.textContent = `₹${total}`;
  }
  
  if (summary) summary.style.display = 'block';
}

function openCartModal() {
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.classList.add('active');
    renderCartItems();
  }
}

function closeCartModal() {
  const cartModal = document.getElementById('cartModal');
  if (cartModal) {
    cartModal.classList.remove('active');
  }
}

function showProductModal(title, emoji, price, rating, reviews, description) {
  currentProductModal = { title, emoji, price, rating, reviews, description };
  const productModal = document.getElementById('productModal');
  
  if (productModal) {
    document.getElementById('productModalTitle').textContent = title;
    document.getElementById('productModalTitle2').textContent = title;
    document.getElementById('productModalImage').textContent = emoji;
    document.getElementById('productModalPrice').textContent = price;
    document.getElementById('productModalRating').textContent = `${rating} (${reviews} reviews)`;
    document.getElementById('productModalDescription').textContent = description;
    
    productModal.classList.add('active');
  }
}

function closeProductModal() {
  const productModal = document.getElementById('productModal');
  if (productModal) {
    productModal.classList.remove('active');
  }
  currentProductModal = null;
}

function addToCartFromModal() {
  if (currentProductModal) {
    const priceStr = currentProductModal.price.replace('₹', '').replace(',', '');
    const price = parseInt(priceStr);
    addToCart(currentProductModal.title, price);
    closeProductModal();
  }
}

function proceedToCheckout() {
  closeCartModal();
  const productsGrid = document.querySelector('.grid');
  const checkoutSection = document.getElementById('checkout');
  
  if (checkoutSection) {
    productsGrid.style.display = 'none';
    checkoutSection.style.display = 'block';
    updateOrderSummary();
  }
}

function updateOrderSummary() {
  const orderItems = document.getElementById('order-items');
  const totalPrice = document.getElementById('total-price');
  
  if (!orderItems) return;

  orderItems.innerHTML = '';
  let total = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex justify-between';
    itemDiv.innerHTML = `
      <span>${item.name} (x${item.quantity || 1})</span>
      <span>₹${itemTotal}</span>
    `;
    orderItems.appendChild(itemDiv);
  });
  
  if (totalPrice) {
    totalPrice.textContent = `₹${total}`;
  }
}

function showCheckout() {
  proceedToCheckout();
}

function showToast() {
  const t = document.getElementById('toast');
  if (t) {
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
  const cartModal = document.getElementById('cartModal');
  const productModal = document.getElementById('productModal');
  
  if (cartModal && event.target === cartModal) {
    closeCartModal();
  }
  if (productModal && event.target === productModal) {
    closeProductModal();
  }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeCart);
