import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const outputFile = path.join(dataDir, 'reyval-catalog.js');
const overridesFile = path.join(dataDir, 'reyval-catalog-overrides.json');

const CATEGORY_CONFIG = [
  {
    id: 'men',
    label: 'Men',
    url: 'https://www.meesho.com/men-shirts/pl/1h8s',
    blurb: 'Structured silhouettes, polished casualwear, and understated essentials styled through the Reyval luxury lens.'
  },
  {
    id: 'women',
    label: 'Women',
    url: 'https://www.meesho.com/hive91-dresses/pl/1drv',
    blurb: 'Fluid evening pieces, elegant drape, and luminous occasion dressing elevated for a more regal presentation.'
  },
  {
    id: 'children',
    label: 'Children',
    url: 'https://www.meesho.com/search?q=kids%20fashion',
    blurb: 'Refined comfort for younger wardrobes with playful silhouettes translated into soft luxury storytelling.'
  },
  {
    id: 'accessories',
    label: 'Accessories',
    url: 'https://www.meesho.com/search?q=women%20accessories',
    blurb: 'Signature finishing pieces designed to bring richness, polish, and quiet glamour to every Reyval look.'
  }
];

const FALLBACK_SEED = {
  men: [
    { name: "STI Men's Tshirts", price: 170, description: 'casual men tshirt with everyday fit' },
    { name: 'Trendy Retro Men Shirts', price: 110, description: 'retro men shirt for casual styling' },
    { name: 'Tshirts & Polos', price: 294, description: 'polo and tshirt assortment for men' },
    { name: "CHHOTE NAWAB Men's Tshirts", price: 300, description: 'printed men tshirt with relaxed appeal' },
    { name: 'Men Cotton Blend Regular Tshirts', price: 233, description: 'cotton blend regular tshirt' },
    { name: 'Cotton Blend Men Regular Tshirts', price: 307, description: 'regular fit cotton blend tshirt' },
    { name: 'Men Polyester Regular Tshirts', price: 222, description: 'polyester tshirt with sporty finish' },
    { name: 'Elite Men Cotton Blend Tee', price: 208, description: 'lightweight everyday tee for men' },
    { name: 'Classic Checked Casual Shirt', price: 349, description: 'checked shirt for everyday use' },
    { name: 'Urbane Tailored Shirt', price: 389, description: 'smart casual shirt with tailored line' }
  ],
  women: [
    { name: 'Stylish Latest Women Dresses', price: 511, description: 'women dress with flowing silhouette' },
    { name: 'Pretty Retro Women Dresses', price: 522, description: 'retro-inspired dress for women' },
    { name: 'Classy Retro Women Dresses', price: 491, description: 'classy retro women dress' },
    { name: 'Stylish Glamorous Women Dresses', price: 523, description: 'glamorous women dress for events' },
    { name: 'Comfy Partywear Women Dresses', price: 522, description: 'partywear dress with comfortable fit' },
    { name: 'Stylish Graceful Women Dresses', price: 542, description: 'graceful women dress with premium drape' },
    { name: 'Classic Fashionista Women Dresses', price: 412, description: 'fashion dress with classic styling' },
    { name: 'Urbane Fabulous Women Dresses', price: 525, description: 'urbane women dress for elevated looks' },
    { name: 'Trendy Fashionable Women Dresses', price: 405, description: 'trendy women dress with modern shape' },
    { name: 'Pretty Graceful Women Dresses', price: 517, description: 'graceful dress for elegant moments' }
  ],
  children: [
    { name: 'Agile Elegant Boys Tshirts', price: 56, description: 'boys tshirt for everyday play' },
    { name: 'Agile Funky Boys Tshirts', price: 87, description: 'funky boys tshirt with playful style' },
    { name: 'Cute Printed Girls Frock', price: 249, description: 'printed girls frock with cheerful look' },
    { name: 'Classic Kids Co-ord Set', price: 319, description: 'matching kids coord set' },
    { name: 'Junior Adventure Denim Jacket', price: 399, description: 'kids denim jacket for layered styling' },
    { name: 'Soft Cotton Kids Night Suit', price: 289, description: 'cotton night suit for kids' },
    { name: 'Playful Casual Kids Set', price: 279, description: 'casual kids set for comfort' },
    { name: 'Charming Girls Party Dress', price: 359, description: 'girls party dress with festive charm' },
    { name: 'Boys Polo & Shorts Set', price: 329, description: 'boys polo and shorts combo' },
    { name: 'Little Prince Festive Kurta Set', price: 449, description: 'festive kurta set for boys' }
  ],
  accessories: [
    { name: 'Leather Tote Bag', price: 1799, description: 'structured tote bag for daily use' },
    { name: 'Structured Vanity Sling', price: 1299, description: 'sling bag with compact silhouette' },
    { name: 'Signature Buckle Belt', price: 699, description: 'belt with signature buckle detail' },
    { name: 'Oversized Fashion Sunglasses', price: 1299, description: 'oversized sunglasses for statement looks' },
    { name: 'Embellished Clutch', price: 1499, description: 'evening clutch with embellished exterior' },
    { name: 'Luxe Travel Backpack', price: 1899, description: 'travel backpack with polished shape' },
    { name: 'Pearl Handle Shoulder Bag', price: 1599, description: 'shoulder bag with pearl handle detail' },
    { name: 'Minimal Gold Watch Set', price: 999, description: 'watch set in minimal gold finish' },
    { name: 'Statement Silk Scarf', price: 849, description: 'silk scarf with fluid drape' },
    { name: 'Premium Wallet & Card Holder', price: 899, description: 'wallet and card holder combo' }
  ]
};

const categoryThemes = {
  men: { start: '#16382f', end: '#d4af37', accent: '#f5ead1' },
  women: { start: '#234638', end: '#e2c873', accent: '#fff6e2' },
  children: { start: '#295446', end: '#f0c764', accent: '#fff7de' },
  accessories: { start: '#112c24', end: '#c7942e', accent: '#fef1cb' }
};

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function rewriteLuxuryDescription(name, description, category) {
  const categoryLead = {
    men: 'A sharply refined essential',
    women: 'A luminous silhouette',
    children: 'A playful piece elevated',
    accessories: 'A statement finishing piece'
  }[category] || 'A refined Reyval selection';

  return `${categoryLead} with a premium Reyval tone, balancing elegance, polished detail, and a quietly regal presence for elevated styling.`;
}

function createImage(label, category) {
  const theme = categoryThemes[category] || categoryThemes.accessories;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1125">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.start}"/>
          <stop offset="100%" stop-color="${theme.end}"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1125" fill="url(#bg)"/>
      <circle cx="712" cy="208" r="170" fill="rgba(255,255,255,0.1)"/>
      <circle cx="160" cy="910" r="210" fill="rgba(0,0,0,0.16)"/>
      <rect x="84" y="96" width="732" height="932" rx="42" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)"/>
      <text x="118" y="214" fill="${theme.accent}" font-family="Georgia, serif" font-size="54" letter-spacing="18">REYVAL</text>
      <text x="118" y="540" fill="#fff9ee" font-family="Georgia, serif" font-size="74" font-weight="700">${label.slice(0, 24)}</text>
      <text x="118" y="620" fill="rgba(255,249,238,0.82)" font-family="Arial, sans-serif" font-size="30">Luxury edit inspired by Meesho trends</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildProduct(category, label, item, index, sourceLabel, sourceUrl) {
  return {
    id: `${category}-${slugify(item.name)}-${index + 1}`,
    category,
    categoryLabel: label,
    name: item.name,
    originalPrice: item.price,
    price: item.price * 2,
    description: rewriteLuxuryDescription(item.name, item.description, category),
    imageUrl: item.imageUrl || createImage(item.name, category),
    imageUrls: item.imageUrls?.length ? item.imageUrls : [item.imageUrl || createImage(item.name, category)],
    sourceLabel,
    sourceUrl,
    brand: 'Reyval'
  };
}

async function loadManualOverrides() {
  try {
    const raw = await readFile(overridesFile, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed.products && typeof parsed.products === 'object'
      ? parsed.products
      : {};
  } catch {
    return {};
  }
}

function applyProductOverride(product, override = {}) {
  const imageUrl = override.imageUrl || product.imageUrl || '';
  const imageUrls = Array.isArray(override.imageUrls) && override.imageUrls.length
    ? override.imageUrls
    : product.imageUrls?.length
      ? product.imageUrls
      : imageUrl
        ? [imageUrl]
        : [];

  return {
    ...product,
    ...override,
    imageUrl,
    imageUrls,
    sourceUrl: override.sourceUrl || product.sourceUrl,
    sourceLabel: override.sourceLabel || product.sourceLabel
  };
}

function extractCandidatesFromJson(value, bag = []) {
  if (!value) return bag;
  if (Array.isArray(value)) {
    value.forEach(item => extractCandidatesFromJson(item, bag));
    return bag;
  }
  if (typeof value !== 'object') {
    return bag;
  }

  const name = value.name || value.title || value.productName || value.product_title;
  const price = Number(
    value.price ||
    value.discountedPrice ||
    value.priceValue ||
    value.min_price ||
    value.currentPrice
  );
  const description = value.description || value.subtitle || value.productDescription || value.label;
  const imageUrl = value.image || value.image_url || value.imageUrl || value.img || value.img_url;
  const imageUrls = Array.isArray(value.images) ? value.images : undefined;

  if (name && Number.isFinite(price) && price > 0) {
    bag.push({ name, price, description, imageUrl, imageUrls });
  }

  Object.values(value).forEach(child => extractCandidatesFromJson(child, bag));
  return bag;
}

function uniqueProducts(products) {
  const seen = new Set();
  return products.filter(item => {
    const key = `${item.name}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchCategoryProducts(category) {
  const response = await fetch(category.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
      'accept-language': 'en-IN,en;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${category.url}`);
  }

  const html = await response.text();
  const jsonBlocks = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]);

  const products = [];
  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      extractCandidatesFromJson(parsed, products);
    } catch {
      // Ignore malformed JSON blocks.
    }
  }

  const deduped = uniqueProducts(products).slice(0, 10);
  if (deduped.length < 10) {
    throw new Error(`Parsed only ${deduped.length} products from ${category.url}`);
  }
  return deduped;
}

async function buildCatalog() {
  const warnings = [];
  const products = [];
  const overrides = await loadManualOverrides();

  for (const category of CATEGORY_CONFIG) {
    let items;
    let sourceLabel = 'Meesho live scrape';
    try {
      items = await fetchCategoryProducts(category);
    } catch (error) {
      sourceLabel = 'Meesho inspired sample';
      warnings.push(`Falling back for ${category.label}: ${error.message}.`);
      items = FALLBACK_SEED[category.id];
    }

    items.slice(0, 10).forEach((item, index) => {
      const product = buildProduct(category.id, category.label, item, index, sourceLabel, category.url);
      products.push(applyProductOverride(product, overrides[product.id]));
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    warnings,
    sources: CATEGORY_CONFIG.map(({ label, url }) => ({ label: `Meesho ${label}`, url })),
    categories: CATEGORY_CONFIG.map(category => ({
      id: category.id,
      label: category.label,
      sampleCount: 10,
      blurb: category.blurb
    })),
    products
  };
}

function toBrowserFile(catalog) {
  return `window.REYVAL_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`;
}

const catalog = await buildCatalog();
await mkdir(dataDir, { recursive: true });
await writeFile(outputFile, toBrowserFile(catalog), 'utf8');

console.log(`Wrote ${catalog.products.length} products to ${outputFile}`);
if (catalog.warnings.length) {
  console.log(catalog.warnings.join('\n'));
}
