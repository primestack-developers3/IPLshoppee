# 🏗️ System Architecture & Data Flow

Visual guide to understand how all components work together.

---

## 🎯 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    CUSTOMER BROWSER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ home.html    │  │checkout.html │  │order-success   │   │
│  │(add to cart) │→ │(pay now)     │→ │(confirmation)  │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
│         ↓                  ↓                                │
│    cart-manager.js   checkout.js (Razorpay integration)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │    RAZORPAY PAYMENT GATEWAY          │
        │  (Secure payment processing)         │
        │  - Card/UPI/Wallet support           │
        │  - Signature verification            │
        └──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     YOUR NEXT.JS BACKEND                    │
│                  (Vercel Deployment)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              API ROUTES (pages/api/)                 │ │
│  │                                                      │ │
│  │  POST /api/create-order                             │ │
│  │  ├─ Gets payment amount from frontend               │ │
│  │  └─ Calls Razorpay → Returns orderId                │ │
│  │                                                      │ │
│  │  POST /api/save-order                               │ │
│  │  ├─ Receives payment response                        │ │
│  │  ├─ Verifies Razorpay signature                      │ │
│  │  └─ Saves order to Firestore                         │ │
│  │                                                      │ │
│  │  GET /api/get-orders                                │ │
│  │  └─ Fetches all orders from Firestore               │ │
│  │                                                      │ │
│  │  POST /api/update-order-status                       │ │
│  │  └─ Updates order status (NEW→ORDERED→SHIPPED)      │ │
│  │                                                      │ │
│  │  POST /api/refund-payment                            │ │
│  │  ├─ Calls Razorpay refund API                        │ │
│  │  └─ Updates order status to REFUNDED                 │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │       FIREBASE FIRESTORE DB          │
        │  (Persistent Order Storage)          │
        │                                      │
        │  Collection: orders                  │
        │  ├─ Document: ORD_xxx_yyy           │
        │  │  ├─ customer (name, phone, addr) │
        │  │  ├─ products (list)               │
        │  │  ├─ totalAmount                   │
        │  │  ├─ razorpayPaymentId             │
        │  │  ├─ status (NEW/ORDERED/SHIPPED)  │
        │  │  └─ createdAt timestamp           │
        │  └─ [More orders...]                 │
        │                                      │
        └──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      ADMIN DASHBOARD                        │
│                  (admin/orders.html)                        │
│                                                             │
│  Displays all orders from Firestore with:                 │
│  ├─ Customer details                                       │
│  ├─ Product list                                           │
│  ├─ Order status                                           │
│  │                                                         │
│  Actions:                                                  │
│  ├─ Copy Details (for Meesho ordering)                    │
│  ├─ Mark Ordered / Shipped                                │
│  └─ Process Refund                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow: From Cart to Order

### Step 1: Customer Checkout
```
User adds items to cart
      ↓
[localStorage: iplCart]
      ↓
Clicks "Proceed to Checkout"
      ↓
→ checkout.html loads (displays cart items)
```

### Step 2: Payment Initiation
```
Customer fills checkout form
├─ Full Name
├─ Phone (10 digits)
└─ Address

Clicks "Pay Now with Razorpay"
      ↓
checkout.js validates form
      ↓
Calculates total from cart:
totalAmount = sum(item.price × item.quantity)
      ↓
Calls: POST /api/create-order {amount, currency}
```

### Step 3: API: Create Order
```
Backend receives amount from frontend
      ↓
Calls Razorpay API with:
├─ amount (in paise)
├─ currency
└─ receipt ID
      ↓
Razorpay returns: orderId
      ↓
Backend sends orderId back to frontend
```

### Step 4: Razorpay Checkout
```
Frontend receives orderId
      ↓
Opens Razorpay popup with:
├─ orderId
├─ amount
├─ Key ID (public)
├─ Customer name & phone
└─ description
      ↓
User selects payment method
      ↓
User enters payment details
      ↓
Razorpay processes payment
      ↓
SUCCESS: Payment captured
         ├─ razorpay_order_id
         ├─ razorpay_payment_id
         └─ razorpay_signature
              ↓
         Callback to frontend
```

### Step 5: Save Order
```
Frontend receives payment response:
{
  razorpay_order_id: "order_xxx",
  razorpay_payment_id: "pay_xxx",
  razorpay_signature: "sig_xxx"
}
      ↓
Calls: POST /api/save-order
Body:
{
  customer: {name, phone, address},
  products: [...cart items...],
  totalAmount,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}
```

### Step 6: Backend Verification & Storage
```
Backend receives order data
      ↓
VERIFY SIGNATURE:
expectedSignature = HMAC-SHA256(
  key=RAZORPAY_SECRET,
  message=orderId|paymentId
)
      ↓
Compare with provided signature
      ↓
✓ Signature valid
      ↓
Generate unique Order ID: ORD_timestamp_random
      ↓
Save to Firestore:
db.collection('orders').doc(orderId).set({
  id, customer, products, totalAmount,
  razorpayOrderId, razorpayPaymentId,
  razorpaySignature, status: 'NEW',
  createdAt, updatedAt
})
      ↓
Return to frontend: {success: true, orderId}
```

### Step 7: Cleanup & Confirmation
```
Frontend receives success response
      ↓
Clear cart: localStorage.removeItem('iplCart')
      ↓
Clear session: sessionStorage.setItem('checkoutTotal', total)
      ↓
Redirect to: order-success.html?orderId=...
      ↓
Display confirmation with:
├─ Order ID
├─ Amount paid
├─ Status: NEW
├─ Timestamp
└─ Link to admin dashboard
```

---

## 🔄 Admin Order Management Flow

### View Orders
```
Admin opens: /admin/orders.html
      ↓
Page calls: GET /api/get-orders
      ↓
Backend fetches from Firestore:
db.collection('orders').orderBy('createdAt').get()
      ↓
Returns all orders as JSON
      ↓
Admin dashboard renders:
├─ Order cards with customer details
├─ Product list
├─ Order status
├─ Action buttons
└─ Filter options (All, New, Ordered, Shipped, Refunded)
```

### Copy Order Details
```
Admin clicks: "Copy Details" button
      ↓
JavaScript extracts order information:
{
  name: "John Doe",
  phone: "9876543210",
  address: "123 Main St, City, State, 110001",
  products: [...],
  totalAmount: 998
}
      ↓
Formats as readable text:
"👤 Name: John Doe
📞 Phone: 9876543210
📍 Address: 123 Main St...
...
Total: ₹998"
      ↓
Copies to clipboard: navigator.clipboard.writeText()
      ↓
Shows toast: "✓ Order details copied!"
      ↓
Admin opens Meesho
      ↓
Pastes order details into Meesho form
      ↓
Places order on Meesho
```

### Update Order Status
```
Admin sees order with status: NEW
      ↓
Clicks: "Mark Ordered" button
      ↓
Frontend calls: POST /api/update-order-status
Body: {orderId, status: "ORDERED"}
      ↓
Backend updates Firestore:
db.collection('orders').doc(orderId).update({
  status: "ORDERED",
  updatedAt: new Date()
})
      ↓
Returns success to frontend
      ↓
Admin dashboard refreshes
      ↓
Order status changes: NEW → ORDERED
```

### Process Refund
```
Admin sees order (status: NEW or ORDERED)
      ↓
Clicks: "Refund" button
      ↓
Modal confirmation appears
      ↓
Admin confirms: "Refund Order"
      ↓
Frontend calls: POST /api/refund-payment
Body: {orderId, paymentId, amount}
      ↓
Backend calls Razorpay API:
razorpay.payments.refund(paymentId, {
  amount: amount_in_paise,
  notes: {orderId, reason}
})
      ↓
Razorpay processes refund
      ↓
      ├─ Immediately marks as "processed"
      └─ Credits back in 2-3 business days
      ↓
Backend updates Firestore:
db.collection('orders').doc(orderId).update({
  status: "REFUNDED",
  refundId: "rfnd_xxx",
  refundedAt: new Date()
})
      ↓
Returns refund success to frontend
      ↓
Admin dashboard updates
      ↓
Order status: ANY → REFUNDED
      ↓
Toast: "✓ Refund processed successfully!"
```

---

## 🗂️ Component Relationships

```
checkout.html
│
├─ Imports: cart-manager.js
│           checkout.js
│
└─ checkout.js
   ├─ Uses: Razorpay SDK (external CDN)
   ├─ Calls API: POST /api/create-order
   ├─ Calls API: POST /api/save-order
   └─ Redirects to: order-success.html
         │
         └─ Shows: Order ID, Amount, Status
            ├─ Link to: /admin/orders.html
            └─ Link to: home.html (continue shopping)

admin/orders.html
│
├─ Uses: order-manager.js (utility functions)
│
└─ Calls API: 
   ├─ GET /api/get-orders (load orders)
   ├─ POST /api/update-order-status (update status)
   ├─ POST /api/refund-payment (process refund)
   └─ (no database calls directly - all via API)

Firebase Firestore
└─ Stores: orders collection
   └─ ORD_xxx documents
      ├─ Written by: /api/save-order
      ├─ Written by: /api/update-order-status
      └─ Read by: /api/get-orders
```

---

## 🔐 Security Checkpoints

### Payment Security
```
User payment data
      ↓
→ Razorpay (100% PCI-DSS compliant)
      ↓
Your backend NEVER sees card details
      ↓
Only sees: order_id, payment_id, signature
```

### Signature Verification
```
Razorpay sends payment response
      ↓
Backend creates signature:
HMAC-SHA256(key=SECRET, message=order_id|payment_id)
      ↓
Compare with Razorpay's signature
      ↓
✗ Mismatch → Reject order (potential fraud)
✓ Match → Save order safely
```

### Data Protection
```
Sensitive data (API keys):
├─ NEVER in frontend code
├─ NEVER in localStorage
├─ ONLY in .env.local (dev) / Vercel env (prod)
├─ ONLY used server-side
└─ NEVER logged or exposed

Customer data (orders):
├─ ONLY stored in Firestore (encrypted)
├─ ONLY accessed via authenticated APIs
├─ NEVER sent to client without need
└─ HTTPS-encrypted in transit
```

---

## 📈 Scalability Architecture

```
Horizontal Scaling:
Vercel (Next.js Functions)
└─ Auto-scales with demand
└─ No server management needed
└─ Handles 1000s of requests/min

Database Scaling:
Firebase Firestore
└─ Auto-scales globally
└─ Real-time synchronization
└─ Backups automatic
└─ No maintenance needed

Payment Processing:
Razorpay
└─ Handles all payment infrastructure
└─ PCI-DSS level 1 compliance
└─ Supports 100+ payment methods
└─ 99.99% uptime SLA
```

---

## 🔍 Monitoring & Debugging

### Frontend Issues
```
User reports: "Payment failed"
      ↓
Check: Browser Console (F12 → Console)
├─ JavaScript errors?
├─ Network errors?
└─ API response errors?
      ↓
Check: Network tab (F12 → Network)
├─ POST /api/create-order status?
├─ POST /api/save-order status?
└─ Show response body
```

### Backend Issues
```
Orders not appearing in admin
      ↓
Check: Vercel Deployment Logs
├─ Build succeeded?
├─ Environment variables set?
└─ Any runtime errors?
      ↓
Check: Firebase Firestore
├─ Collection exists?
├─ Documents present?
└─ Data structure correct?
```

### Payment Issues
```
Razorpay integration failing
      ↓
Check: Razorpay Dashboard
├─ Key ID correct?
├─ Key Secret not exposed?
├─ Live/Test mode correct?
└─ Payment method enabled?
      ↓
Check: Payment object
├─ Order ID generated?
├─ Amount is > 0?
└─ Signature verified?
```

---

**This architecture is designed for:**
- ✅ Simplicity (easy to understand)
- ✅ Security (production-grade)
- ✅ Scalability (grows with your business)
- ✅ Reliability (99.99% uptime)
- ✅ Maintainability (minimal code, clear structure)

**Ready to implement? Start with QUICKSTART.md! 🚀**
