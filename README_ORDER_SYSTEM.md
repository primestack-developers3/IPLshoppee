# 💳 IPL Shoppee - Order & Payment System

**A simple, production-ready order management + Razorpay payment integration for your Next.js e-commerce store.**

Built specifically for the **IPL Shoppee dropshipping model** using **Meesho**.

---

## 🎯 What You Get

✅ **Razorpay Payment Integration** - Secure, PCI-DSS compliant payments  
✅ **Order Management System** - Firebase-backed persistent storage  
✅ **Admin Dashboard** - View, filter, and manage all orders  
✅ **Meesho-Optimized** - One-click copy of order details  
✅ **Refund System** - Process refunds directly from admin panel  
✅ **Mobile Responsive** - Works perfectly on all devices  
✅ **Zero Overengineering** - Minimal, beginner-friendly code  
✅ **Production Ready** - Deploy instantly to Vercel  

---

## 📁 What's Included

### Frontend Pages
- **checkout.html** - Customer checkout form with order review
- **order-success.html** - Order confirmation page
- **admin/orders.html** - Admin dashboard for order management

### JavaScript
- **checkout.js** - Payment form validation and Razorpay integration
- **order-manager.js** - Reusable order utility functions
- **cart-manager.js** - Your existing cart system (updated)

### Backend API Routes (Next.js)
- **api/create-order.js** - Creates Razorpay order ID
- **api/save-order.js** - Saves order to Firebase
- **api/get-orders.js** - Retrieves all orders
- **api/update-order-status.js** - Updates order status
- **api/refund-payment.js** - Processes refunds

### Documentation
- **QUICKSTART.md** - Get started in 5 minutes (read this first!)
- **SETUP_GUIDE.md** - Comprehensive detailed setup
- **ORDER_SYSTEM_DOCS.md** - Complete system documentation
- **IMPLEMENTATION_CHECKLIST.md** - Step-by-step implementation guide
- **.env.local.example** - Environment variables template

---

## 🚀 Quick Start (5 Minutes)

### 1. Get API Keys
- **Razorpay**: Go to razorpay.com → Settings → API Keys → Copy Key ID & Secret
- **Firebase**: Go to firebase.google.com → Create project → Service Account → Download JSON

### 2. Install Dependencies
```bash
npm install razorpay firebase-admin
```

### 3. Create `.env.local`
```
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="your_key_here"
FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

### 4. Add Files to Project
Copy all provided files to your Next.js project (see file structure below)

### 5. Test Locally
```bash
npm run dev
# Open http://localhost:3000/home.html
# Add items to cart → Click "Proceed to Checkout"
# Fill form → Pay with test card: 4111 1111 1111 1111
```

### 6. Deploy to Vercel
Push to GitHub, import to Vercel, add environment variables, deploy.

**That's it! Your payment system is live! 🎉**

For detailed instructions, see [QUICKSTART.md](QUICKSTART.md)

---

## 📖 Documentation Guide

| Document | Purpose | Read When |
|----------|---------|-----------|
| **QUICKSTART.md** | 5-minute quick start | First time setup |
| **SETUP_GUIDE.md** | Detailed step-by-step | Full implementation |
| **ORDER_SYSTEM_DOCS.md** | How everything works | Understanding the system |
| **IMPLEMENTATION_CHECKLIST.md** | Implementation tracker | During development |

---

## 🔄 Payment Flow

```
Customer Adds Items to Cart
        ↓
Clicks "Proceed to Checkout"
        ↓
Fills: Name, Phone, Address
        ↓
Clicks "Pay Now with Razorpay"
        ↓
API: /create-order → Gets Razorpay Order ID
        ↓
Razorpay Popup Opens
        ↓
Customer Pays (Card/UPI/Wallet)
        ↓
Payment Success
        ↓
API: /save-order → Saves to Firestore
        ↓
Order Confirmation Page
        ↓
Cart Cleared
        ↓
Order Visible in Admin Dashboard
        ↓
Admin Copies Details & Orders from Meesho
        ↓
Marks as "ORDERED" when placed on Meesho
        ↓
Marks as "SHIPPED" when received from Meesho
        ↓
(Optional: Process refund if product unavailable)
```

---

## 📂 File Structure

```
project-root/
├── pages/
│   └── api/
│       ├── create-order.js
│       ├── save-order.js
│       ├── get-orders.js
│       ├── update-order-status.js
│       └── refund-payment.js
│
├── public/
│   ├── checkout.html
│   ├── checkout.js
│   ├── order-success.html
│   ├── order-manager.js
│   └── admin/
│       └── orders.html
│
├── .env.local (create from .env.local.example)
├── .gitignore (add .env.local)
├── package.json (add razorpay, firebase-admin)
│
└── Documentation/
    ├── QUICKSTART.md
    ├── SETUP_GUIDE.md
    ├── ORDER_SYSTEM_DOCS.md
    ├── IMPLEMENTATION_CHECKLIST.md
    └── .env.local.example
```

---

## 🎛️ Admin Dashboard Features

### View Orders
- Filter by status: All, New, Ordered, Shipped, Refunded
- See customer details and product list
- View order timestamps and payment IDs

### Quick Actions
- **Copy Details** - Copy name, phone, address for Meesho ordering
- **Mark Ordered** - Update status after placing order on Meesho
- **Mark Shipped** - Update status after receiving from Meesho  
- **Refund** - Process refund if product unavailable

### Dashboard Statistics
- Total orders count
- Pending orders (NEW + ORDERED)
- Shipped orders count
- Refunded orders count

---

## 🔐 Security Features

✅ **Razorpay Signature Verification** - Prevents payment fraud  
✅ **API Key Protection** - Keys never exposed to browser  
✅ **HTTPS in Production** - Automatic with Vercel  
✅ **Firestore Authentication** - Server-side only  
✅ **No Sensitive Data in Frontend** - All secrets on backend  

---

## 💰 Test Payment Details

Use these credentials in Razorpay test mode:

| Card | Number | Expiry | CVV |
|------|--------|--------|-----|
| Visa | 4111 1111 1111 1111 | 12/25 | 123 |
| Mastercard | 5555 5555 5555 4444 | 12/25 | 456 |
| Amex | 3782 822463 10005 | 12/25 | 789 |

---

## 📊 Database Schema

### Firestore: `orders` Collection

```javascript
{
  id: "ORD_1726543210_abc9xyz",
  customer: {
    name: "John Doe",
    phone: "9876543210",
    address: "123 Main St, City, State, 110001"
  },
  products: [
    { name: "CSK Jersey", price: 499, quantity: 2 }
  ],
  totalAmount: 998,
  razorpayOrderId: "order_KZDQJxxxx",
  razorpayPaymentId: "pay_KZDQJxxxx",
  razorpaySignature: "signature_hash",
  status: "NEW",  // NEW → ORDERED → SHIPPED → REFUNDED
  createdAt: Timestamp,
  updatedAt: Timestamp,
  refundId: "rfnd_KZDQJxxxx" // if refunded
}
```

---

## 🚀 Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add order and payment system"
git push origin main
```

### 2. Import to Vercel
- Go to https://vercel.com
- Click "Import Project"
- Select your GitHub repo
- Click "Import"

### 3. Set Environment Variables
In Vercel dashboard → Project Settings → Environment Variables:
- Add all variables from `.env.local`
- Use LIVE keys (not test)

### 4. Deploy
Vercel automatically deploys when you commit!

### 5. Update API Base URL
In `checkout.js`, change `API_BASE` to your Vercel URL:
```js
const API_BASE = 'https://your-app.vercel.app';
```

---

## ✅ Testing Checklist

### Local Testing
- [ ] Add items to cart
- [ ] Proceed to checkout
- [ ] Fill form completely
- [ ] Make test payment
- [ ] See order in Firestore
- [ ] Check admin dashboard
- [ ] Copy order details
- [ ] Update order status
- [ ] Process refund

### Live Testing (Post-Deployment)
- [ ] Checkout form loads
- [ ] Razorpay accepts real payment
- [ ] Order saves securely
- [ ] Admin dashboard accessible
- [ ] Mobile version works
- [ ] Refunds process correctly

---

## 🐛 Troubleshooting

### "Failed to create order"
→ Check Razorpay API key in `.env.local`, restart dev server

### "Payment signature mismatch"
→ Verify Razorpay secret key matches in `.env.local`

### "Orders not showing in admin"
→ Check Firebase Firestore, verify `/api/get-orders` works

### "Refund failed"
→ Verify payment ID, check Razorpay dashboard, try test payment first

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for more troubleshooting.

---

## 💡 Customization Ideas

Want to extend the system? Try these:

- Email order confirmations (nodemailer)
- SMS notifications (Twilio)
- Inventory tracking
- Customer order tracking page
- Analytics dashboard
- Discount/promo codes
- Multiple payment methods
- Export orders to CSV

---

## 📱 Mobile Compatibility

All pages are fully responsive:
- Checkout form works on mobile
- Admin dashboard is touch-friendly
- Razorpay popup opens on all devices
- Order success page displays correctly

Test with: DevTools Device Emulation or real device

---

## 🎓 Learning Resources

- **Razorpay Docs**: https://razorpay.com/docs/
- **Firebase Docs**: https://firebase.google.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Vercel Docs**: https://vercel.com/docs

---

## 💬 Support

### Documentation
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
2. See [ORDER_SYSTEM_DOCS.md](ORDER_SYSTEM_DOCS.md) for system overview
3. Use [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) to track progress

### Debugging
1. Check browser console (F12) for JavaScript errors
2. Check Vercel deployment logs for backend errors
3. Verify API endpoints are working with Postman/Insomnia
4. Check Firebase Firestore for data

### Common Issues
- Razorpay keys not set? → Update `.env.local`
- Firebase error? → Verify credentials and database URL
- API not responding? → Check Next.js API routes exist
- Orders not saving? → Check Firestore rules allow writes

---

## 🎉 Success!

Once complete, you'll have:

✅ Functioning checkout system  
✅ Secure payment processing  
✅ Persistent order storage  
✅ Admin order management  
✅ Refund capability  
✅ Live production deployment  

**Ready to scale your IPL Shoppee business! 🚀**

---

## 📝 Version & License

**Version**: 1.0.0  
**Last Updated**: September 2024  
**License**: MIT  
**Best For**: Solo developers, small teams  
**Tech Stack**: Next.js, Razorpay, Firebase, Vercel  

---

## 👨‍💻 Built With ❤️

For independent student developers who value simplicity and speed.

**Ready to implement? Start with [QUICKSTART.md](QUICKSTART.md)! 🚀**
