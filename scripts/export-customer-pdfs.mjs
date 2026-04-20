import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { loadEnvFile } from '../firebase-utils.mjs';
import { extractDriveFolderId, generateAndSaveBill } from '../bill-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const ORDERS_FILE = path.join(ROOT_DIR, 'data', 'orders.json');

loadEnvFile(ENV_FILE);

async function loadOrders() {
  const raw = await readFile(ORDERS_FILE, 'utf8');
  const orders = JSON.parse(raw);
  return Array.isArray(orders) ? orders : [];
}

async function saveOrders(orders) {
  await writeFile(ORDERS_FILE, `${JSON.stringify(orders, null, 2)}\n`);
}

async function main() {
  const folderInput = process.argv[2] || process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_URL || '';
  const folderId = extractDriveFolderId(folderInput);
  if (folderId) {
    process.env.GOOGLE_DRIVE_FOLDER_ID = folderId;
  }

  const orders = await loadOrders();
  if (!orders.length) {
    console.log('No saved orders were found in data/orders.json.');
    return;
  }

  let uploadedCount = 0;
  let localCount = 0;
  const nextOrders = [];

  for (const order of orders) {
    const result = await generateAndSaveBill(order);
    if (result.driveFileId) uploadedCount += 1;
    if (result.localFilePath) localCount += 1;

    nextOrders.push({
      ...order,
      bill: {
        generated: Boolean(result.localFilePath || result.driveFileId),
        driveFileId: result.driveFileId || null,
        localPath: result.localFilePath || null,
        pdfAvailable: Boolean(result.localFilePath)
      }
    });

    console.log(
      `${order.orderId}: local=${result.localFilePath || 'failed'} drive=${result.driveFileId || 'skipped'}`
    );
  }

  await saveOrders(nextOrders);
  console.log(`Done. Local PDFs: ${localCount}. Drive uploads: ${uploadedCount}.`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
