# IPL Shoppee - Order & Payment System Documentation

## 📚 Complete System Overview

This is a **production-ready order management + Razorpay payment integration** built specifically for the **IPL Shoppee dropshipping model** using Meesho.

### 🎯 Core Features

✅ Secure Razorpay payment integration  
✅ Persistent order storage (Firebase)  
✅ Admin dashboard for order management  
✅ Automatic refund system  
✅ Order status tracking (NEW → ORDERED → SHIPPED → REFUNDED)  
✅ Copy-paste order details for Meesho ordering  
✅ Mobile-responsive UI  
✅ Minimal, beginner-friendly codebase  

---

## 📂 File Structure & Purposes

### Frontend Files (HTML/CSS/JS)

| File | Purpose |
|------|---------|
| `checkout.html` | Checkout form (customer details, order review) |
| `checkout.js` | Payment logic, form validation, Razorpay integration |
| `order-success.html` | Success confirmation page |
| `cart-manager.js` | Cart management (existing) |
| `order-manager.js` | Order utility functions for reuse |

### Admin Interface

| File | Purpose |
|------|---------|
| `admin/orders.html` | Admin dashboard for managing orders |

### API Routes (Next.js)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/create-order` | Create Razorpay order ID |
| `POST /api/save-order` | Save order to Firestore after payment |
| `GET /api/get-orders` | Fetch all orders (for admin) |
| `POST /api/update-order-status` | Update order status |
| `POST /api/refund-payment` | Process refunds |

### Configuration

| File | Purpose |
|------|---------|
| `.env.local` | API keys & credentials (NEVER commit) |
| `SETUP_GUIDE.md` | Complete setup instructions |
| `DEPENDENCIES.md` | Required npm packages |

---

## 🔄 Payment Flow (Step by Step)

### 1. Customer Adds Items & Checkout
```
User adds items to cart (via cart-manager.js)
→ Clicks "Proceed to Checkout"
→ Redirects to checkout.html
```

### 2. Checkout Form
```
checkout.html displays:
- Order summary (all items from cart)
- Input fields: Full Name, Phone, Address
- "Pay Now" button
```

### 3. Payment Initiation
```
User fills form & clicks "Pay Now"
→ checkout.js validates all fields
→ Calculates total amount
→ Calls API: POST /api/create-order
→ Gets Razorpay Order ID back
```

### 4. Razorpay Popup
```
Razorpay checkout popup opens
→ User selects payment method (Card/UPI/Wallet)
→ Enters payment details
→ Payment processed by Razorpay
```

### 5. Order Saving
```
Payment successful callback
→ checkout.js calls API: POST /api/save-order
→ Backend:
   - Verifies Razorpay signature (security)
   - Saves order to Firestore
   - Generates order ID
→ Returns order ID to frontend
```

### 6. Success & Cleanup
```
Order saved successfully
→ Cart cleared (localStorage)
→ User redirected to order-success.html
→ Shows order confirmation with ID
→ Link to admin dashboard provided
```

### 7. Admin Processing
```
Admin opens admin/orders.html
→ Sees new order with "Copy Details" button
→ Copies: Name, Phone, Address, Products, Total
→ Opens Meesho
→ Pastes details in order form
→ Places order on Meesho
→ Marks order as "ORDERED" in dashboard
```

### 8. Order Fulfillment
```
Product arrives from Meesho
→ Admin marks order as "SHIPPED"
→ Customer receives product
```

### 9. Refund (if needed)
```
If product unavailable:
→ Admin clicks "Refund"
→ Confirmation modal appears
→ Admin confirms refund
→ API calls Razorpay refund endpoint
→ Refund processed (24-48 hours to customer)
→ Order status changes to "REFUNDED"
```

---

## 🛠️ Configuration Details

### Environment Variables

Your `.env.local` must have:

```
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_secret_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=your_private_key_with_escaped_newlines
FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

### API Base URL

For **local development**:
```js
const API_BASE = 'http://localhost:3000';
```

For **production (Vercel)**:
```js
const API_BASE = 'https://your-app.vercel.app';
```

---

## 🧪 Testing Locally

### Test Payment Cards

Use these in Razorpay test mode:

| Card | Details |
|------|---------|
| **Visa** | 4111 1111 1111 1111 |
| **Mastercard** | 5555 5555 5555 4444 |
| **Amex** | 3782 822463 10005 |

Expiry: Any future date (e.g., 12/25)  
CVV: Any 3-4 digits  
OTP: Leave blank (auto-verified in test)

### Local Testing Steps

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Add items to cart**: Open http://localhost:3000/home.html

3. **Go to checkout**: Click "Proceed to Checkout"

4. **Fill form**:
   - Name: Test User
   - Phone: 9876543210
   - Address: 123 Test Street, Test City, TS 100001

5. **Pay with test card**: 4111 1111 1111 1111

6. **Verify order**: Check admin dashboard at `/admin/orders.html`

---

## 🔒 Security Features

### 1. Razorpay Signature Verification
- Backend verifies payment signature before saving order
- Prevents unauthorized orders
- Uses HMAC-SHA256

### 2. API Key Protection
- Razorpay secret key never exposed to frontend
- Only public key used in browser
- Environment variables contain sensitive data

### 3. Firestore Security
- Firebase Admin SDK used server-side only
- Service account credentials on backend
- Orders specific to each customer

### 4. HTTPS in Production
- Vercel auto-enables HTTPS
- All payment data encrypted in transit

---

## 💾 Database Schema

### Firestore: `orders` Collection

Each document structure:

```javascript
{
  // Auto-generated ID
  id: "ORD_1726543210_abc9xyz",
  
  // Customer information
  customer: {
    name: "John Doe",
    phone: "9876543210",
    address: "123 Main St, City, State, 110001"
  },
  
  // Product list
  products: [
    {
      name: "CSK Jersey",
      price: 499,
      quantity: 2
    },
    {
      name: "IPL Cap",
      price: 299,
      quantity: 1
    }
  ],
  
  // Payment information
  totalAmount: 1297,
  razorpayOrderId: "order_KZDQJxxxx",
  razorpayPaymentId: "pay_KZDQJxxxx",
  razorpaySignature: "signature_hash_string",
  
  // Order status (workflow)
  status: "NEW",  // NEW → ORDERED → SHIPPED → REFUNDED
  
  // Timestamps
  createdAt: Timestamp: 2024-09-17T10:30:00Z,
  updatedAt: Timestamp: 2024-09-17T10:30:00Z,
  
  // Refund info (if applicable)
  refundId: "rfnd_KZDQJxxxx",
  refundedAt: Timestamp: 2024-09-18T14:22:00Z
}
```

---

## 🎛️ Admin Dashboard Features

### Order View
- **Filter by status**: All, New, Ordered, Shipped, Refunded
- **Order cards** with customer details
- **Product list** for each order
- **Quick stats** dashboard

### Quick Actions

| Action | What It Does |
|--------|-------------|
| **Copy Details** | Copies order info formatted for Meesho |
| **Mark Ordered** | Changes status from NEW to ORDERED |
| **Mark Shipped** | Changes status from ORDERED to SHIPPED |
| **Refund** | Processes refund + marks as REFUNDED |

### Example: Copy Details Output

```
📦 Order #KZDDJA67

👤 Name: John Doe
📞 Phone: 9876543210
📍 Address: 123 Main St, City, State, 110001

Products:
- CSK Jersey (Qty: 2) - ₹998
- IPL Cap (Qty: 1) - ₹299

Total: ₹1,297
```

Then paste into Meesho order form!

---

## 🚀 Deployment to Vercel

### Prerequisites
- GitHub account with your code
- Vercel account (free)
- Razorpay account (live keys)
- Firebase project (with credentials)

### Deployment Steps

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Add order and payment system"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to https://vercel.com
   - Click "Import Project"
   - Select your GitHub repo
   - Click "Import"

3. **Set Environment Variables**:
   - In Vercel project settings → Environment Variables
   - Add all variables from `.env.local`:
     ```
     NEXT_PUBLIC_RAZORPAY_KEY_ID=your_live_key
     RAZORPAY_KEY_SECRET=your_live_secret
     FIREBASE_PROJECT_ID=...
     FIREBASE_CLIENT_EMAIL=...
     FIREBASE_PRIVATE_KEY=... (paste full key with line breaks)
     FIREBASE_DATABASE_URL=...
     NEXT_PUBLIC_API_BASE=https://your-app.vercel.app
     ```

4. **Deploy**:
   - Vercel auto-deploys when you commit
   - Check deployment status in dashboard
   - Get your live URL

5. **Test Live**:
   - Use live Razorpay keys (not test)
   - Real payment processing begins
   - Check orders in Firebase Firestore

---

## 📊 Key Metrics & Monitoring

### What to Monitor

1. **Payment Success Rate**: Orders saved ÷ Payment attempts
2. **Refund Rate**: Refunded orders ÷ Total orders
3. **Status Distribution**: Count of NEW, ORDERED, SHIPPED, REFUNDED
4. **Revenue**: Sum of totalAmount field

### Firebase Console Monitoring

1. Go to https://console.firebase.google.com
2. Select your project
3. Firestore Database → orders collection
4. Filter, search, download data

---

## 🐛 Debugging & Common Issues

### Issue: "Failed to create order"
**Cause**: Razorpay API key not set
**Fix**: 
- Check `.env.local` has correct `RAZORPAY_KEY_ID`
- Verify key is from live environment (production)
- Restart dev server: `npm run dev`

### Issue: "Payment signature mismatch"
**Cause**: Wrong Razorpay secret key
**Fix**:
- Verify `RAZORPAY_KEY_SECRET` in `.env.local`
- Check it matches your Razorpay dashboard key
- Ensure no extra spaces or line breaks

### Issue: "Failed to save order" / Firebase errors
**Cause**: Missing Firebase credentials
**Fix**:
- Check all Firebase env vars are set
- Verify `FIREBASE_PRIVATE_KEY` has proper line breaks
- Ensure `orders` collection exists in Firestore
- Check Firebase rules allow writes (if custom rules set)

### Issue: Orders not showing in admin dashboard
**Cause**: API not returning data
**Fix**:
- Check `/api/get-orders` is accessible
- Verify Firebase connection working
- Check browser console for errors
- Try refreshing admin page

### Issue: "Refund failed"
**Cause**: Can't refund old payments
**Fix**:
- Razorpay can refund payments up to 12 months old
- Verify payment ID is correct
- Check amount is not more than original payment
- Test with test payment first

---

## 📞 Support & Resources

### Documentation Links
- Razorpay Docs: https://razorpay.com/docs/
- Firebase Docs: https://firebase.google.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs

### Troubleshooting Resources
- Check browser Developer Tools (F12) → Console for errors
- Check browser Network tab for failed API requests
- Look at Vercel deployment logs for backend errors
- Check Firebase Firestore for data presence

---

## ✨ What Makes This System Special

1. **Dropshipping-Optimized**: Built specifically for Meesho ordering model
2. **Copy-Paste Ready**: One-click copy of order details for Meesho
3. **Zero Overengineering**: Just what you need, nothing more
4. **Fast Implementation**: Can set up in <30 minutes
5. **Beginner-Friendly**: Easy to understand and modify
6. **Production-Ready**: Secure, scalable, deployed instantly
7. **Free Stack**: Razorpay, Firebase, Vercel (all have free tiers)

---

## 🎓 Learning Resources

Want to understand how it works better?

### Cart System
- See `cart-manager.js` - localStorage-based cart management
- Handles add, remove, update quantity

### Payment Flow
- See `checkout.js` - all payment logic in one file
- Comments explain each step

### Admin Dashboard
- See `admin/orders.html` - completely self-contained
- Shows filtering, status updates, refunds

### API Routes
- See `pages/api/*` - simple, readable backend code
- Each file handles one specific task

---

## 👨‍💻 Customization Ideas

Want to extend the system? Try these:

1. **Email confirmations**: Add nodemailer for order emails
2. **SMS alerts**: Integrate Twilio for SMS notifications
3. **Inventory tracking**: Add product stock management
4. **Order tracking**: Let customers track order status
5. **Analytics**: Dashboard showing revenue, trends, etc.
6. **Discount codes**: Add coupon/promo code support
7. **Multiple payment methods**: Add Google Pay, Apple Pay
8. **Export to CSV**: Export orders to spreadsheet

---

**Created with ❤️ for Independent Developers**

Last Updated: September 2024  
Version: 1.0.0  
License: MIT
