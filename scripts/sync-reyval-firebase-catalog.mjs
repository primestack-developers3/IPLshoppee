import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { getFirebaseFirestore, loadEnvFile } from '../firebase-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const CATALOG_FILE = path.join(ROOT_DIR, 'data', 'reyval-catalog.js');
const FIREBASE_PRODUCTS_COLLECTION = process.env.FIREBASE_PRODUCTS_COLLECTION || 'reyval_products';

loadEnvFile(ENV_FILE);

function normalizeProductRecord(record, index = 0) {
  const price = Number(record.price || 0);
  const supplierPrice = Number(record.originalPrice || Math.round(price / 2));
  const sourceUrl = record.sourceUrl || record.supplierUrl || '';
  const sourceLabel = record.sourceLabel || record.supplierName || 'Manual sourcing';

  return {
    id: record.id || `product_${index + 1}`,
    name: record.name || `Product ${index + 1}`,
    category: record.category || 'general',
    categoryLabel: record.categoryLabel || record.category || 'General',
    description: record.description || '',
    imageUrl: record.imageUrl || '',
    price,
    originalPrice: supplierPrice,
    supplierPrice,
    sourceUrl,
    supplierUrl: sourceUrl,
    sourceLabel,
    sourceName: sourceLabel,
    updatedAt: new Date().toISOString()
  };
}

async function loadCatalogProducts() {
  const raw = await readFile(CATALOG_FILE, 'utf8');
  const jsonText = raw.replace(/^window\.REYVAL_CATALOG = /, '').replace(/;\s*$/, '');
  const catalog = JSON.parse(jsonText);
  return (catalog.products || []).map((product, index) => normalizeProductRecord(product, index));
}

async function main() {
  const firebase = await getFirebaseFirestore({ appName: 'reyval-catalog-sync' });
  if (!(firebase.enabled && firebase.db)) {
    throw new Error(`Firebase is not configured: ${firebase.reason}`);
  }

  const products = await loadCatalogProducts();
  const batch = firebase.db.batch();

  products.forEach(product => {
    const docRef = firebase.db.collection(process.env.FIREBASE_PRODUCTS_COLLECTION || FIREBASE_PRODUCTS_COLLECTION).doc(product.id);
    batch.set(docRef, product, { merge: true });
  });

  await batch.commit();
  console.log(`Synced ${products.length} Reyval products to Firestore collection "${process.env.FIREBASE_PRODUCTS_COLLECTION || FIREBASE_PRODUCTS_COLLECTION}".`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
