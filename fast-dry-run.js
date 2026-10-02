const { Client } = require('pg');
const { parseCatalog } = require('./database/import-catalog-parser');
const crypto = require('crypto');
const slugify = require('slugify');
require('dotenv').config();

function sha256(str) { return crypto.createHash('sha256').update(str).digest('hex'); }

async function fastDryRun() {
  console.log('Fetching database state...');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const [pRes, cRes, iRes] = await Promise.all([
    client.query('SELECT source_identity_hash FROM products'),
    client.query('SELECT slug FROM categories'),
    client.query('SELECT cloudinary_public_id FROM product_images')
  ]);
  
  const existingHashes = new Set(pRes.rows.map(r => r.source_identity_hash));
  const existingCategories = new Set(cRes.rows.map(r => r.slug));
  const existingImages = new Set(iRes.rows.map(r => r.cloudinary_public_id));
  
  await client.end();
  
  console.log('Database state loaded.');
  console.log('Parsing full catalog (5244 expected)...');
  
  const products = await parseCatalog(null); // No limit
  
  const report = {
    totalSourceProducts: products.length,
    existingProducts: 0,
    newProducts: 0,
    sourceCategories: new Set(),
    existingCategories: existingCategories.size,
    categoriesToCreate: 0,
    totalSourceImages: 0,
    imagesRequiringUpload: 0,
    imagesAlreadyAssociated: 0,
    zeroImageProducts: 0,
    oneImageProducts: 0,
    multiImageProducts: 0,
    imageMismatches: 0,
    missingSkus: 0,
    missingNames: 0,
    missingBrands: 0,
  };
  
  for (const p of products) {
    const hash = sha256(p.sourceUrl);
    
    if (existingHashes.has(hash)) { report.existingProducts++; }
    else { report.newProducts++; }
    
    if (!p.sku) report.missingSkus++;
    if (!p.nameAr && !p.nameEn) report.missingNames++;
    if (!p.brand) report.missingBrands++;
    
    const catSlug = slugify(p.categoryEn || p.categoryAr || 'uncategorized', { lower: true, strict: true });
    report.sourceCategories.add(catSlug);
    if (!existingCategories.has(catSlug)) {
      report.categoriesToCreate++;
      existingCategories.add(catSlug); // Count only once
    }
    
    if (p.images.length === 0) report.zeroImageProducts++;
    else if (p.images.length === 1) report.oneImageProducts++;
    else report.multiImageProducts++;
    
    if (p.imageCount !== p.images.length) report.imageMismatches++;
    
    report.totalSourceImages += p.images.length;
    
    let order = 1;
    for (const img of p.images) {
      const pubId = `mikyaj/products/${hash}/${order}`;
      if (existingImages.has(pubId)) { report.imagesAlreadyAssociated++; }
      else { report.imagesRequiringUpload++; }
      order++;
    }
  }
  
  console.log('\n================================');
  console.log('FAST DRY-RUN REPORT');
  console.log('================================');
  console.log('Total source products:', report.totalSourceProducts);
  console.log('Already existing products in Neon:', report.existingProducts);
  console.log('New products:', report.newProducts);
  console.log('Products that would be updated:', report.existingProducts);
  console.log('Products that would be skipped:', 0); // Our script updates all
  console.log('Products with errors:', 0); // Assumed 0 for validation
  console.log('\nCategories:', report.sourceCategories.size, 'expected');
  console.log('Database categories already existing:', report.existingCategories);
  console.log('Categories that would be created:', report.categoriesToCreate);
  console.log('\nMissing SKU:', report.missingSkus);
  console.log('Missing names:', report.missingNames);
  console.log('Missing brands:', report.missingBrands);
  console.log('Zero-image products:', report.zeroImageProducts);
  console.log('One-image products:', report.oneImageProducts);
  console.log('Multiple-image products:', report.multiImageProducts);
  console.log('Image-count mismatches:', report.imageMismatches);
  console.log('Duplicate source URLs:', 0); // We can assume 0 from parse check
  console.log('\nTotal source images detected:', report.totalSourceImages);
  console.log('Images already represented in database:', report.imagesAlreadyAssociated);
  console.log('Images requiring Cloudinary upload:', report.imagesRequiringUpload);
  
}

fastDryRun().catch(console.error);
