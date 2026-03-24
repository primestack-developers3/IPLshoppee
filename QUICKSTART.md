# 🚀 IPL Shoppee - Quick Start (5 Minutes)

**Goal**: Get payment system working in 30 minutes.

---

## 📋 Pre-requisites (2 minutes)

- [ ] Next.js project set up locally
- [ ] Git repo initialized
- [ ] Node.js installed

---

## ⚙️ Step 1: Get API Keys (3 minutes)

### Razorpay (https://razorpay.com)
1. Sign up → Email verified
2. Dashboard → Settings → API Keys
3. Copy: **Key ID** and **Secret**

### Firebase (https://firebase.google.com)
1. Create project → Name: `ipl-shoppee`
2. Project Settings → Service Accounts
3. Generate Key → Download JSON

---

## 📦 Step 2: Install Dependencies (2 minutes)

```bash
npm install razorpay firebase-admin
```

---

## 📄 Step 3: Create .env.local (2 minutes)

Copy this file to your project root with your actual keys:

```
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_key_with_newlines_as_\\n"
FIREBASE_DATABASE_URL=your_db_url
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

---

## 📂 Step 4: Add Files to Project (5 minutes)

Copy these files to your Next.js project:

**In project root:**
- `checkout.html`
- `checkout.js`
- `order-success.html`
- `order-manager.js`

**In `pages/api/`:**
- `create-order.js`
- `save-order.js`
- `get-orders.js`
- `update-order-status.js`
- `refund-payment.js`

**In `public/admin/`:**
- `orders.html`

---

## 🔌 Step 5: Integrate with Home Page (3 minutes)

In your existing `home.html`, add a checkout button:

```html
<button onclick="goToCheckout()" class="btn-primary">
  Proceed to Checkout
</button>

<script>
  function goToCheckout() {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }
    const total = cart.reduce((sum, item) => 
      sum + (item.price * (item.quantity || 1)), 0
    );
    sessionStorage.setItem('checkoutTotal', total);
    window.location.href = 'checkout.html';
  }
</script>
```

---

## ✅ Step 6: Test (5 minutes)

1. **Start server**: `npm run dev`
2. **Add items to cart**: http://localhost:3000/home.html
3. **Checkout**: Click "Proceed to Checkout"
4. **Fill form**: Name, Phone, Address
5. **Pay**: Use test card `4111 1111 1111 1111`
6. **View order**: Check `/admin/orders.html`

---

## 🎊 Done!

Your payment system is live! 

### What You Can Do Now:
- ✅ Accept payments
- ✅ Store orders in Firestore
- ✅ Copy order details for Meesho
- ✅ Manage order status
- ✅ Process refunds
- ✅ Track everything in admin dashboard

---

## 🚢 Deploy to Vercel (5 minutes)

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Add payment system"
   git push
   ```

2. Import to Vercel (https://vercel.com)

3. Add environment variables in Vercel settings

4. Done! Your app is live 🎉

---

## 📚 Need More Details?

- **Full Setup**: Read `SETUP_GUIDE.md`
- **System Flow**: Read `ORDER_SYSTEM_DOCS.md`
- **Troubleshooting**: Check `SETUP_GUIDE.md` → Troubleshooting section

---

## 💡 Pro Tips

1. **Test payments first**: Use Razorpay test mode before going live
2. **Check Firebase**: Verify orders are saving in Firestore dashboard
3. **Keep .env.local**: Never commit to GitHub (add to `.gitignore`)
4. **Use Vercel**: Easiest way to deploy Next.js
5. **Monitor refunds**: Razorpay takes 2-3 days to process refunds

---

**You're all set! Happy selling! 🚀**
