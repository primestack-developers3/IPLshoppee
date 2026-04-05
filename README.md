# IPL Shoppee - Reyval Storefront

A luxury e-commerce storefront inspired by Meesho trends, built with modern web technologies.

## Features

- Product catalog sourced from Meesho
- Razorpay payment integration
- Order management with auto-cancellation after 30 hours
- Admin dashboard for order handling
- Firebase integration for data persistence
- Responsive design with dark theme

## Setup Guide

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Firebase project (optional, for data persistence)

### Installation

1. Clone or download the project files to your local machine.

2. Navigate to the project directory:
   ```bash
   cd path/to/IPLshoppee
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

1. Create a `.env.local` file in the root directory with the following variables:

   ```env
   # Server configuration
   PORT=3000
   REYVAL_PORT=3000

   # Razorpay payment integration
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret

   # Firebase configuration (optional)
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_PRIVATE_KEY=your_private_key
   FIREBASE_CLIENT_EMAIL=your_client_email
   FIREBASE_ORDERS_COLLECTION=reyval_orders
   FIREBASE_PRODUCTS_COLLECTION=reyval_products
   ```

   **Note:** Get your Razorpay keys from the [Razorpay Dashboard](https://dashboard.razorpay.com/).

2. For Firebase integration (optional):
   - Create a Firebase project
   - Enable Firestore
   - Generate a service account key
   - Add the credentials to `.env.local`

### Sync Product Catalog

To update the product catalog with latest Meesho trends:

```bash
npm run sync:catalog
```

This will fetch products from Meesho and create luxury versions in the catalog.

### Sync Firebase Products (optional)

If using Firebase:

```bash
npm run sync:firebase-products
```

### Running the Application

Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Accessing the Admin Dashboard

- Main storefront: `http://localhost:3000`
- Admin orders: `http://localhost:3000/admin/orders.html`

### Order Management

- Orders are automatically cancelled if not placed within 30 hours
- Use the admin dashboard to mark customers as handled
- Pending customers are shown in the admin panel
- Handled customers are tracked separately

### Payment Flow

1. Customer adds items to cart
2. Proceeds to checkout
3. If Razorpay is configured, secure payment is processed
4. On successful payment, order is confirmed
5. Customer is redirected to order success page
6. Admin can view and manage orders

### File Structure

- `index.html` - Home page
- `cart.html` - Shopping cart
- `checkout.html` - Payment checkout
- `order-success.html` - Order confirmation
- `admin/orders.html` - Admin order management
- `server.mjs` - Backend server
- `scripts/` - Client-side JavaScript
- `data/` - Product catalog and orders
- `styles/` - CSS stylesheets

### Troubleshooting

- If payments don't work, check Razorpay keys in `.env.local`
- If catalog sync fails, it falls back to sample products
- Ensure Node.js version is 18+
- Check console for any errors

### Development

- Product images are currently SVG placeholders
- To add real product photos, update the catalog in `data/reyval-catalog.js`
- Firebase is optional; app works with local storage fallback</content>
<parameter name="filePath">c:\Users\SIDDHU\Desktop\IPLshoppee\README.md