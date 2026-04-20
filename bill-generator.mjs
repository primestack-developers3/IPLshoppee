import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || ''; // User will provide later

async function authenticateGoogleDrive() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Service Account credentials not found');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  return google.drive({ version: 'v3', auth });
}

export async function generateBillPDF(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('IPL Shoppee Invoice', { align: 'center' });
    doc.moveDown();

    // Order Details
    doc.fontSize(14).text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    // Customer Details
    doc.fontSize(16).text('Customer Details:');
    doc.fontSize(12);
    doc.text(`Name: ${order.customer.fullName}`);
    doc.text(`Phone: ${order.customer.phone}`);
    doc.text(`Email: ${order.customer.email}`);
    doc.text(`Address: ${order.customer.address}, ${order.customer.pincode}`);
    doc.moveDown();

    // Products Table
    doc.fontSize(16).text('Products:');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const itemX = 50;
    const qtyX = 300;
    const priceX = 400;

    // Table headers
    doc.fontSize(12).text('Product', itemX, tableTop);
    doc.text('Qty', qtyX, tableTop);
    doc.text('Price', priceX, tableTop);

    // Underline headers
    doc.moveTo(itemX, tableTop + 15).lineTo(priceX + 50, tableTop + 15).stroke();

    let yPosition = tableTop + 25;

    order.products.forEach(product => {
      doc.text(product.name, itemX, yPosition);
      doc.text(product.quantity.toString(), qtyX, yPosition);
      doc.text(`Rs. ${product.lineRevenue}`, priceX, yPosition);
      yPosition += 20;
    });

    // Total
    doc.moveDown(2);
    doc.fontSize(14).text(`Total Amount: Rs. ${order.totals.revenue}`, { align: 'right' });

    doc.end();
  });
}

export async function saveBillToDrive(pdfBuffer, orderId) {
  if (!DRIVE_FOLDER_ID) {
    console.warn('Google Drive folder ID not set, skipping upload');
    return null;
  }

  try {
    const drive = await authenticateGoogleDrive();

    const fileMetadata = {
      name: `Invoice_${orderId}.pdf`,
      parents: [DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: 'application/pdf',
      body: pdfBuffer
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    return response.data.id;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return null;
  }
}

export async function generateAndSaveBill(order) {
  const pdfBuffer = await generateBillPDF(order);
  const driveFileId = await saveBillToDrive(pdfBuffer, order.orderId);
  return { pdfBuffer, driveFileId };
}