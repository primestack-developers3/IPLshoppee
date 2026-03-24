// pages/api/save-order.js
// Save order to Firebase after successful payment

import * as admin from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      customer,
      products,
      totalAmount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status = 'NEW',
      createdAt,
    } = req.body;

    // Validate required fields
    if (!customer || !products || !totalAmount || !razorpayPaymentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify Razorpay signature
    const isSignatureValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isSignatureValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Generate unique order ID
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create order document
    const orderData = {
      id: orderId,
      customer,
      products,
      totalAmount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status,
      createdAt: new Date(createdAt),
      updatedAt: new Date(),
    };

    // Save to Firestore
    await db.collection('orders').doc(orderId).set(orderData);

    return res.status(200).json({
      success: true,
      orderId,
      message: 'Order saved successfully',
    });
  } catch (error) {
    console.error('Save order error:', error);
    return res.status(500).json({ error: 'Failed to save order' });
  }
}

// Verify Razorpay signature
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}
