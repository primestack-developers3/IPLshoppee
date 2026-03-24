# Unified Cart & Navigation System - Complete Setup Guide

## Status

✅ **Core System Complete:**
- `cart-manager.js` - Fully refactored with unified cart functions
- `components/header.html` - Universal navigation with all team links
- `components/cart-panel.html` - Slide-out cart accessible from anywhere
- `home.html` - Updated to use new unified system

⏳ **In Progress:**
- Updating 10 team pages (CSK, RCB, MI, KKR, RR, SRH, GT, LSG, DC, PBKS)

## What's Working Now

### Global Cart System
```javascript
// Add item to cart (use these functions in any page)
addToCart(productName, price, productId)

// Remove from cart
removeFromCart(productId)

// Update quantity
updateQuantity(productId, newQuantity)

// Clear entire cart
clearAllCart()

// Get current cart
const cart = getCart()

// Show notification
showToast(message)
```

### On Any Page
- Cart badge in header updates automatically
- Cart persists across page navigation (uses localStorage)
- Clicking cart button opens the unified slide-out panel
- All products use the same cart regardless of which page you're on

## Quick Integration Summary

### For Root Pages (home.html, checkout.html)

1. **Add script to `<head>`:**
```html
<script src="./cart-manager.js"></script>
```

2. **Add right after `<body>` tag:**
```html
<div id="header-container"></div>
<script>
  fetch('./components/header.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('header-container').innerHTML = html;
      initializeCart();
      updateCartCount();
    });
</script>

<div id="cart-panel-container"></div>
<script>
  fetch('./components/cart-panel.html')
    .then(response => response.text())
    .then(html => document.getElementById('cart-panel-container').innerHTML = html);
</script>
```

3. **Update add-to-cart buttons:**
```html
<!-- Old -->
<button onclick="addToCart('Product Name', 999)">Add</button>

<!-- Still same - function is now unified -->
<button onclick="addToCart('Product Name', 999)">Add</button>
```

4. **Remove old code:**
   - Delete old nav-bar HTML (`<nav class="nav-bar">`)
   - Delete old cart modal HTML (`<div id="cartModal" class="modal">`) 
   - Delete old product modal HTML (`<div id="productModal" class="modal">`)
   - Delete cart rendering functions (renderCart, renderCartItems, etc.)
   - Delete persistCart, loadCart functions (now in cart-manager.js)

### For Team Pages (IPL teams/csk.html, etc.)

**Path Adjustment:** Use `../../` instead of `./` for all fetch and src paths

1. **Add script to `<head>`:**
```html
<script src="../../cart-manager.js"></script>
```

2. **Add right after `<body>` tag:**
```html
<div id="header-container"></div>
<script>
  fetch('../../components/header.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('header-container').innerHTML = html;
      initializeCart();
      updateCartCount();
    });
</script>

<div id="cart-panel-container"></div>
<script>
  fetch('../../components/cart-panel.html')
    .then(response => response.text())
    .then(html => document.getElementById('cart-panel-container').innerHTML = html);
</script>
```

3. **Update add-to-cart buttons:**
```html
<!-- Keep same format, function is now unified -->
<button onclick="addToCart('CSK Jersey', 1999)">Add to Cart</button>
```

4. **Remove old code:**
   - Delete old nav-bar HTML and CSS
   - Delete old cart modal HTML
   - Delete old product modal HTML  
   - Delete team-logo, nav-brand CSS classes
   - Delete renderCartItems, openCartModal, closeCartModal functions
   - Delete persistCart, loadCart functions

## Team Pages to Update

1. ✅ **home.html** - DONE
2. 🔄 **IPL teams/csk.html** - PARTIALLY DONE (needs old code cleanup)
3. ⏳ **IPL teams/rcb.html**
4. ⏳ **IPL teams/mi.html**
5. ⏳ **IPL teams/kkr.html**
6. ⏳ **IPL teams/rr.html**
7. ⏳ **IPL teams/srh.html**
8. ⏳ **IPL teams/gt.html**
9. ⏳ **IPL teams/lsg.html**
10. ⏳ **IPL teams/dc.html**
11. ⏳ **IPL teams/pbks.html**

## Files Modified

### New Created Files
- `components/header.html` (380+ lines)
  - Universal header with team dropdown
  - Cart badge that updates in real-time
  - Navigation buttons
  - Mobile responsive

- `components/cart-panel.html` (450+ lines)
  - Slide-out cart drawer
  - Real-time item updates
  - Quantity controls
  - Checkout button

- `cart-manager.js` (refactored)
  - Unified cart functions
  - localStorage persistence
  - Event dispatching for real-time sync
  - Toast notifications

### Updated Files
- `home.html` - Integrated new components, removed old cart code

## Testing Checklist

After updating each page:

- [ ] Header appears at top with logo and nav buttons
- [ ] Cart badge shows correct count
- [ ] Clicking cart button opens slide-out panel
- [ ] Add to cart button works and shows toast
- [ ] Cart items persist when navigating to another page
- [ ] Cart items can be removed and quantities updated
- [ ] Checkout button in cart panel navigates to checkout
- [ ] Team dropdown links work and navigate correctly
- [ ] No JavaScript errors in browser console

## Common Issues & Fixes

**Problem:** Component not loading
- **Fix:** Check paths are correct (`./` vs `../../`)
- **Fix:** Ensure `cart-manager.js` loads before components

**Problem:** Cart not persisting
- **Fix:** Check localStorage is enabled
- **Fix:** Verify browser isn't in private/incognito mode

**Problem:** Cart count not updating
- **Fix:** Ensure `updateCartCount()` is called in header fetch callback
- **Fix:** Check header.html loaded successfully

**Problem:** Add to cart does nothing
- **Fix:** Verify `cart-manager.js` script loaded completely
- **Fix:** Check browser console for errors
- **Fix:** Ensure addToCart parameters are correct (name, price)

## Implementation Strategy

### Option 1: Manual Update (Detailed Control)
1. Open each team page HTML
2. Find and replace the nav-bar section
3. Add fetch scripts for components
4. Remove old cart modal HTML
5. Test thoroughly

### Option 2: Find & Replace (Faster)
Use VS Code Find & Replace with regex to update all team pages:
- Find nav-bar pattern
- Replace with new header component
- Find cart modal pattern
- Replace with new cart panel component

### Option 3: Helper Script
Create a PowerShell script to batch update all team pages automatically.

## Next Steps

1. **Verify home.html works**: Navigate to home.html, test add to cart, cart panel
2. **Update CSK completely**: Remove remaining old modal code from CSK
3. **Create batch update script**: Use PowerShell or Node.js to update all 10 team pages
4. **Test thoroughly**: Test cart across multiple pages and browsers
5. **Deploy**: Once everything works, site is ready with unified cart

## Code Examples

### Example: Adding a Product
```html
<div class="product-card">
  <div class="product-image">👕</div>
  <h3>CSK Jersey</h3>
  <div class="price">₹1,999</div>
  <!-- This button works with unified cart -->
  <button onclick="addToCart('CSK Jersey', 1999)">Add to Cart</button>
</div>
```

### Example: Custom Toast
```javascript
// Show custom message
showToast('✓ CSK Jersey added to Dugout!');

// Standard message
showToast();  // Shows default message
```

### Example: Checking Cart Contents
```javascript
// Get all cart items
const cart = getCart();
console.log(cart);
// Output: [{id: 'product_123', name: 'CSK Jersey', price: 1999, quantity: 1}, ...]

// Calculate total
let total = 0;
cart.forEach(item => {
  total += item.price * item.quantity;
});
console.log('Total:', total);
```

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify file paths match directory structure
3. Ensure all required files exist:
   - `cart-manager.js`
   - `components/header.html`
   - `components/cart-panel.html`
4. Check that cart-manager.js loads before page tries to use cart functions
