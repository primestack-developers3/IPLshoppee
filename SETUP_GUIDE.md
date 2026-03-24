# IPL Shoppee - Complete Setup Guide

## 📋 Overview

This guide will walk you through the complete setup for your order + payment workflow system. Follow each step carefully.

---

## 🔧 STEP 1: Environment Setup

### Create `.env.local` file

Create a file named `.env.local` in your Next.js project root:

```
# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="your-private-key-here-replace-newlines-with-\\n"
FIREBASE_DATABASE_URL=your-database-url

# API Configuration
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

---

## 🎯 STEP 2: Razorpay Setup

### 2.1 Create Razorpay Account
1. Go to https://razorpay.com
2. Sign up and verify your business details
3. Go to Settings → API Keys
4. Copy your:
   - **Key ID** → Paste in `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - **Key Secret** → Paste in `RAZORPAY_KEY_SECRET`

### 2.2 Install Razorpay SDK

Run in your project:
```bash
npm install razorpay
```

---

## 🔥 STEP 3: Firebase Setup (RECOMMENDED)

### 3.1 Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click "Create Project" → Name: `ipl-shoppee-orders`
3. Enable Firestore Database in Google Cloud
4. Create a service account for Node.js:
   - Project Settings → Service Accounts → Generate New Private Key
   - Download the JSON file

### 3.2 Extract Firebase Credentials

From the downloaded JSON file, find:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (replace `\n` with actual line breaks)

### 3.3 Create Firestore Collection

In Firebase Console:
1. Go to Firestore Database
2. Create collection: `orders`
3. Leave it empty (schema will be auto-created)

---

## 📦 STEP 4: Install Dependencies

Run in your Next.js project:

```bash
npm install firebase-admin crypto
```

---

## 📄 STEP 5: File Structure

Ensure your project structure looks like:

```
/pages
  /api
    - create-order.js        ✓
    - save-order.js          ✓
    - get-orders.js          ✓
    - update-order-status.js ✓
    - refund-payment.js      ✓

/public/
  - checkout.html            ✓
  - checkout.js              ✓
  - order-success.html       ✓
  - cart-manager.js          ✓ (existing)

/admin
  - orders.html              ✓

.env.local                    ✓ (create this)
```

---

## 🛒 STEP 6: Integrate into Your Website

### Update Home Page Checkout Button

In your `home.html` or where customers see the cart, add:

```html
<button onclick="goToCheckout()" class="btn-primary">
  Proceed to Checkout
</button>

<script>
  function goToCheckout() {
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }
    // Store total in session for success page
    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    sessionStorage.setItem('checkoutTotal', total);
    
    window.location.href = 'checkout.html';
  }
</script>
```

---

## ✅ STEP 7: Test Everything Locally

### Run Development Server

```bash
npm run dev
```

### Test the Flow

1. **Add items to cart** on home.html
2. **Click "Proceed to Checkout"** → Goes to checkout.html
3. **Fill in details** (Name, Phone, Address)
4. **Click "Pay Now"** → Razorpay popup opens
5. **Use Test Credentials**:
   - Card: `4111 1111 1111 1111`
   - Expiry: `12/25`
   - CVV: `123`
6. **Confirm payment** → See order-success.html
7. **Check admin dashboard** at `/admin/orders.html` → See new order

---

## 🚀 STEP 8: Deploy to Vercel

### 8.1 Set Environment Variables on Vercel

1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all variables from `.env.local`:
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_DATABASE_URL`

### 8.2 Update API Base URL

In your frontend files (`checkout.js`), change:
```js
const API_BASE = 'https://your-vercel-app.vercel.app';
```

### 8.3 Deploy

```bash
git add .
git commit -m "Add payment and order system"
git push origin main
```

Vercel will auto-deploy!

---

## 📊 Database Schema

### Firestore: orders collection

Each order has:

```javascript
{
  id: "ORD_1726543210_abc9xyz",
  customer: {
    name: "John Doe",
    phone: "9876543210",
    address: "123 Main St, City, State, 110001"
  },
  products: [
    {
      name: "CSK Jersey",
      price: 499,
      quantity: 2
    }
  ],
  totalAmount: 998,
  razorpayOrderId: "order_xyz...",
  razorpayPaymentId: "pay_xyz...",
  razorpaySignature: "signature...",
  status: "NEW", // or ORDERED, SHIPPED, REFUNDED
  createdAt: "2024-09-17T10:30:00Z",
  updatedAt: "2024-09-17T10:35:00Z",
  refundId: "rfnd_xyz..." // if refunded
}
```

---

## 🎛️ Admin Dashboard Usage

### Access Admin Orders
1. Open `/admin/orders.html`
2. See all orders with filters
3. For each order:
   - **Copy Details** → Copies name, address, phone for Meesho
   - **Mark Ordered** → Changes status to ORDERED (after placing on Meesho)
   - **Mark Shipped** → Changes status to SHIPPED (after receiving from Meesho)
   - **Refund** → Processes refund if product unavailable

---

## 🛠️ Troubleshooting

### Payment not processing
- Check Razorpay credentials are correct
- Verify test mode is enabled
- Check browser console for errors

### Orders not saving
- Verify Firebase credentials
- Check Firestore is enabled in Firebase
- Ensure `orders` collection exists
- Check `.env.local` variables

### Signature validation failing
- Verify payment ID is correct
- Check Razorpay key secret matches

### Admin dashboard not loading orders
- Verify API route is working (`/api/get-orders`)
- Check Firebase connection
- Look at browser console for errors

---

## 📱 Mobile Testing

All pages are mobile-responsive. To test:

```bash
npm run dev
# Open http://localhost:3000 on your phone or use DevTools device emulation
```

---

## 💡 Quick Reference

| Feature | File | Purpose |
|---------|------|---------|
| Checkout Form | `checkout.html` | Customer enters details |
| Razorpay Payment | `checkout.js` | Handles payment flow |
| Order Success | `order-success.html` | Confirmation page |
| Admin Dashboard | `admin/orders.html` | Manage orders |
| Create Order API | `api/create-order.js` | Generates Razorpay order |
| Save Order API | `api/save-order.js` | Stores in Firestore |
| Get Orders API | `api/get-orders.js` | Retrieves all orders |
| Update Status API | `api/update-order-status.js` | Changes order status |
| Refund API | `api/refund-payment.js` | Processes refunds |

---

## 🎓 How It Works (Flow Diagram)

```
Customer Adds Items to Cart
         ↓
Clicks "Proceed to Checkout"
         ↓
Opens checkout.html (checkout.js)
         ↓
Enters Name, Phone, Address
         ↓
Clicks "Pay Now with Razorpay"
         ↓
API: /create-order → Creates Razorpay Order ID
         ↓
Razorpay Popup Opens
         ↓
Customer Pays (Test Card: 4111 1111 1111 1111)
         ↓
Payment Success
         ↓
API: /save-order → Saves to Firestore
         ↓
Shows order-success.html
         ↓
Cart Cleared (localStorage)
         ↓
Admin sees order in /admin/orders.html
         ↓
Admin Copies Details & Orders from Meesho
         ↓
Marks as ORDERED
         ↓
Product Arrives, Mark as SHIPPED
```

---

## 💬 Need Help?

1. Check browser console for error messages
2. Verify all environment variables are set
3. Test API endpoints with Postman/Insomnia
4. Check Firebase Firestore has data
5. Compare your code with examples provided

---

**Happy selling! 🚀**
