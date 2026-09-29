const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, 'mikyaj-demo', 'js', 'catalog-data.js');
const BASE_DIR = path.join(__dirname, 'mikyaj-demo');

if (!fs.existsSync(catalogPath)) {
  console.error("catalog-data.js not found!");
  process.exit(1);
}

// Very simple manual parsing for validation script purposes
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

// Use an eval or regex. Eval is safe here since we generated it.
let products = [];
let categories = [];
let brands = [];

const fakeWindow = {};
try {
  const func = new Function('window', catalogContent);
  func(fakeWindow);
  products = fakeWindow.ATTAR_CATALOG_PRODUCTS || [];
  categories = fakeWindow.ATTAR_CATALOG_CATEGORIES || [];
  brands = fakeWindow.ATTAR_CATALOG_BRANDS || [];
} catch (e) {
  console.error("Failed to parse catalog:", e);
}

const report = {
  totalProducts: products.length,
  totalCategories: categories.length,
  totalBrands: brands.length,
  productsWithImages: 0,
  productsWithoutImages: 0,
  productsWithPrices: 0,
  productsWithoutPrices: 0,
  duplicateSkus: [],
  duplicateSlugs: [],
  brokenImagePaths: [],
  invalidRecords: []
};

const skuSet = new Set();
const slugSet = new Set();

products.forEach(p => {
  if (!p.sku) report.invalidRecords.push(p.id + ' (Missing SKU)');
  if (!p.name) report.invalidRecords.push(p.id + ' (Missing Name)');

  if (skuSet.has(p.sku)) report.duplicateSkus.push(p.sku);
  skuSet.add(p.sku);

  if (slugSet.has(p.slug)) report.duplicateSlugs.push(p.slug);
  slugSet.add(p.slug);

  if (p.price > 0) report.productsWithPrices++;
  else report.productsWithoutPrices++;

  if (p.images && p.images.length > 0) {
    report.productsWithImages++;
    p.images.forEach(img => {
      const imgPath = path.join(BASE_DIR, img);
      if (!fs.existsSync(imgPath)) {
        report.brokenImagePaths.push(img);
      }
    });
  } else {
    report.productsWithoutImages++;
  }
});

console.log("=== DATA VALIDATION REPORT ===");
console.log(`Total products imported: ${report.totalProducts}`);
console.log(`Categories: ${report.totalCategories}`);
console.log(`Brands: ${report.totalBrands}`);
console.log(`Products with images: ${report.productsWithImages}`);
console.log(`Products without images: ${report.productsWithoutImages}`);
console.log(`Products with prices: ${report.productsWithPrices}`);
console.log(`Products without prices: ${report.productsWithoutPrices}`);
console.log(`Duplicate SKUs: ${report.duplicateSkus.length}`);
console.log(`Duplicate slugs: ${report.duplicateSlugs.length}`);
console.log(`Broken image paths: ${report.brokenImagePaths.length}`);
console.log(`Invalid records: ${report.invalidRecords.length}`);

if (report.brokenImagePaths.length > 0) {
  console.log("Broken images sample:");
  console.log(report.brokenImagePaths.slice(0, 5));
}
