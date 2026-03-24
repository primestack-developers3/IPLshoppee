// pages/api/refund-payment.js
// Process refunds using Razorpay API

import Razorpay from 'razorpay';
import * as admin from 'firebase-admin';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
    const { orderId, paymentId, amount } = req.body;

    if (!orderId || !paymentId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process refund with Razorpay
    const refund = await razorpay.payments.refund(paymentId, {
      amount, // Amount in paise
      notes: {
        orderId,
        reason: 'Product unavailable or customer request',
      },
    });

    if (refund.status !== 'processed' && refund.status !== 'pending') {
      throw new Error(`Refund failed with status: ${refund.status}`);
    }

    // Update order status to REFUNDED in Firestore
    await db.collection('orders').doc(orderId).update({
      status: 'REFUNDED',
      refundId: refund.id,
      refundedAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      refundId: refund.id,
      message: 'Refund processed successfully',
    });
  } catch (error) {
    console.error('Refund error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process refund' });
  }
}
