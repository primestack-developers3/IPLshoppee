// Package Dependencies for IPL Shoppee Order System
// Add these to your package.json

{
  "name": "ipl-shoppee",
  "version": "1.0.0",
  "description": "IPL Fan Store with Order & Payment System",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "razorpay": "^2.9.2",
    "firebase-admin": "^12.0.0"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0"
  }
}

// Installation command:
// npm install razorpay firebase-admin

// Environment variables needed in .env.local:
// NEXT_PUBLIC_RAZORPAY_KEY_ID=
// RAZORPAY_KEY_SECRET=
// FIREBASE_PROJECT_ID=
// FIREBASE_CLIENT_EMAIL=
// FIREBASE_PRIVATE_KEY=
// FIREBASE_DATABASE_URL=
// NEXT_PUBLIC_API_BASE=http://localhost:3000
