import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_URL || '';
const PAGE_MARGIN = 50;
const DETAILS_GAP = 6;

export function extractDriveFolderId(value = '') {
  const input = String(value || '').trim();
  if (!input) return '';

  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) {
    return folderMatch[1];
  }

  const queryMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  return input;
}

async function getDriveFolderId() {
  return extractDriveFolderId(
    DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_URL
  );
}

const BILLS_DIR = path.join(__dirname, 'data', 'bills');

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatCurrency(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safeAmount);
}

function getCustomerName(order) {
  return toText(order?.customer?.name || order?.customer?.fullName, 'N/A');
}

function getCustomerPhone(order) {
  return toText(order?.customer?.phone, 'N/A');
}

function getCustomerAddress(order) {
  const address = toText(
    order?.shipping?.address || order?.customer?.shippingAddress || order?.customer?.address
  );
  const pincode = toText(
    order?.shipping?.pincode || order?.customer?.shippingPincode || order?.customer?.pincode
  );

  return [address, pincode].filter(Boolean).join(', ') || 'N/A';
}

function getProducts(order) {
  return (Array.isArray(order?.products) ? order.products : []).map(product => {
    const quantity = Number(product?.quantity);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const lineRevenue = Number(product?.lineRevenue);
    const saleUnitPrice = Number(product?.saleUnitPrice);
    const safeLineRevenue = Number.isFinite(lineRevenue)
      ? lineRevenue
      : (Number.isFinite(saleUnitPrice) ? saleUnitPrice : 0) * safeQuantity;

    return {
      name: toText(product?.name, 'Unnamed product'),
      quantity: safeQuantity,
      lineRevenue: safeLineRevenue
    };
  });
}

function getOrderTotal(order, products) {
  const revenue = Number(order?.totals?.revenue);
  if (Number.isFinite(revenue)) {
    return revenue;
  }

  return products.reduce((sum, product) => sum + product.lineRevenue, 0);
}

function writeDetailRow(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(value);
  doc.moveDown(0.15);
}

function drawProductsHeader(doc, top) {
  const itemX = PAGE_MARGIN;
  const qtyX = 340;
  const amountX = 410;

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Product', itemX, top, { width: 250 });
  doc.text('Qty', qtyX, top, { width: 40, align: 'right' });
  doc.text('Amount', amountX, top, { width: 135, align: 'right' });
  doc.moveTo(itemX, top + 16).lineTo(doc.page.width - PAGE_MARGIN, top + 16).stroke('#d7d7d7');

  return top + 24;
}

function drawProductsTable(doc, products) {
  if (!products.length) {
    doc.font('Helvetica').fontSize(11).text('No products recorded.');
    return;
  }

  let y = drawProductsHeader(doc, doc.y);

  products.forEach(product => {
    const nameHeight = doc.heightOfString(product.name, { width: 250 });
    const rowHeight = Math.max(18, nameHeight + 4);

    if (y + rowHeight > doc.page.height - PAGE_MARGIN - 70) {
      doc.addPage();
      y = drawProductsHeader(doc, PAGE_MARGIN);
    }

    doc.font('Helvetica').fontSize(11);
    doc.text(product.name, PAGE_MARGIN, y, { width: 250 });
    doc.text(String(product.quantity), 340, y, { width: 40, align: 'right' });
    doc.text(formatCurrency(product.lineRevenue), 410, y, { width: 135, align: 'right' });

    y += rowHeight + DETAILS_GAP;
    doc.moveTo(PAGE_MARGIN, y - 2).lineTo(doc.page.width - PAGE_MARGIN, y - 2).stroke('#efefef');
  });

  doc.y = y + 6;
}

async function ensureBillsDir() {
  await fs.promises.mkdir(BILLS_DIR, { recursive: true });
}

async function saveBillLocally(pdfBuffer, orderId) {
  try {
    await ensureBillsDir();
    const filePath = path.join(BILLS_DIR, `Invoice_${orderId}.pdf`);
    await fs.promises.writeFile(filePath, pdfBuffer);
    return filePath;
  } catch (error) {
    console.error('Error saving bill locally:', error);
    return null;
  }
}

async function authenticateGoogleDrive() {
  // Use the same service account loading as Firebase
  const { getFirebaseServiceAccount } = await import('./firebase-utils.mjs');
  const creds = getFirebaseServiceAccount();
  if (!creds) {
    throw new Error('Google Service Account credentials not found');
  }

  // Transform to Google Auth expected format
  const credentials = {
    project_id: creds.projectId,
    client_email: creds.clientEmail,
    private_key: creds.privateKey
  };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  // Test authentication
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('Google Auth successful, token length:', token?.length);
  } catch (error) {
    console.error('Google Auth failed:', error.message);
    throw error;
  }

  return google.drive({ version: 'v3', auth });
}

export async function generateBillPDF(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN });
    const buffers = [];
    const products = getProducts(order);
    const totalAmount = getOrderTotal(order, products);

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).text('IPL Shoppee Customer Summary', { align: 'center' });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(11).fillColor('#666666');
    doc.text(`Order ID: ${toText(order?.orderId, 'N/A')}`, { align: 'center' });
    doc.text(`Order Date: ${formatDate(order?.createdAt)}`, { align: 'center' });
    doc.fillColor('black');
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(15).text('Customer Details');
    doc.moveDown();
    doc.fontSize(11);
    writeDetailRow(doc, 'Name', getCustomerName(order));
    writeDetailRow(doc, 'Phone', getCustomerPhone(order));
    writeDetailRow(doc, 'Address', getCustomerAddress(order));

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(15).text('Products');
    doc.moveDown(0.5);
    drawProductsTable(doc, products);

    if (doc.y > doc.page.height - PAGE_MARGIN - 60) {
      doc.addPage();
    }

    doc.moveDown(0.75);
    doc.font('Helvetica-Bold').fontSize(14).text(`Total Cost: ${formatCurrency(totalAmount)}`, {
      align: 'right'
    });

    doc.end();
  });
}

export async function saveBillToDrive(pdfBuffer, orderId) {
  const folderId = await getDriveFolderId();
  if (!folderId) {
    console.warn('Google Drive folder ID not set, skipping upload');
    return null;
  }

  try {
    const drive = await authenticateGoogleDrive();

    const fileMetadata = {
      name: `Invoice_${orderId}.pdf`,
      parents: [folderId]
    };

    // Convert buffer to readable stream
    const { Readable } = await import('stream');
    const stream = Readable.from(pdfBuffer);

    const media = {
      mimeType: 'application/pdf',
      body: stream
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true
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
  const localFilePath = await saveBillLocally(pdfBuffer, order.orderId);
  return { pdfBuffer, driveFileId, localFilePath };
}
