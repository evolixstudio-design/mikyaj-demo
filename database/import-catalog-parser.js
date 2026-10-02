const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const sharp = require('sharp');
require('dotenv').config();

const CATALOG_ROOT = process.env.CATALOG_ROOT || path.resolve(process.cwd(), "images/AttarKuwait_Catalog");
const CSV_FILE = path.join(CATALOG_ROOT, '_metadata', 'catalog.csv');

if (!fs.existsSync(CSV_FILE)) {
  console.error("CRITICAL ERROR: CSV File not found at:", CSV_FILE);
  process.exit(1);
}

console.log(`[INFO] Using CATALOG_ROOT: ${CATALOG_ROOT}`);
console.log(`[INFO] Reading CSV: ${CSV_FILE}`);

const csvData = fs.readFileSync(CSV_FILE, 'utf8').replace(/^\uFEFF/, '');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

// Metrics
const metrics = {
  totalRecords: records.length,
  productFoldersFound: 0,
  productJsonFilesFound: 0,
  productsSuccessfullyParsed: 0,
  malformedJson: 0,
  missingProductJson: 0,
  
  missingSourceUrl: 0,
  duplicateSourceUrl: 0,
  
  missingSku: 0,
  duplicateSku: 0,

  missingNameAr: 0,
  missingNameEn: 0,
  missingCategoryAr: 0,
  missingCategoryEn: 0,
  missingShortDescAr: 0,
  missingShortDescEn: 0,
  missingDetailsAr: 0,
  missingDetailsEn: 0,
  missingBrand: 0,

  missingSourcePrice: 0,
  missingRegularPrice: 0,
  missingSellingPrice: 0,
  priceInvalidNumeric: 0,
  priceSellingGreaterThanSource: 0,
  priceSellingEqualToSource: 0,
  priceSellingLessThanSource: 0,
  
  zeroImages: 0,
  oneImage: 0,
  multipleImages: 0,
  imageCountMismatch: 0,
  
  unresolvedImageFolder: 0,
  unresolvedFolderName: 0,
  
  uniqueCategoryAr: new Set(),
  uniqueCategoryEn: new Set(),
  uniqueBrands: new Set(),
  brandOccurrences: {}
};

const urlTracker = new Set();
const skuTracker = new Set();
const duplicateUrls = [];
const duplicateSkus = [];
const duplicateNames = []; // just names
const nameTracker = new Set();

const parsedProducts = [];

async function parseCatalog(limit = 0) {
  let recordsToProcess = records;
  if (limit > 0) {
    recordsToProcess = records.slice(0, limit);
  }
  console.log(`[INFO] Processing ${recordsToProcess.length} records... This may take a moment.`);
  
  for (let i = 0; i < recordsToProcess.length; i++) {
    const row = recordsToProcess[i];
    
    // Normalization mapping
    const p = {
      sourceUrl: row.product_url,
      sku: row.sku,
      nameAr: row.product_name_ar,
      nameEn: row.product_name_en,
      categoryAr: row.category_ar,
      categoryEn: row.category_en,
      categoriesAr: row.categories_ar,
      categoriesEn: row.categories_en,
      brand: row.brand,
      sourcePrice: parseFloat(row.source_price),
      regularPrice: parseFloat(row.regular_price),
      sellingPrice: parseFloat(row.selling_price),
      shortDescriptionAr: row.short_description_ar,
      shortDescriptionEn: row.short_description_en,
      detailsAr: row.details_ar,
      detailsEn: row.details_en,
      imageCount: parseInt(row.image_count, 10) || 0,
      imageFolder: row.image_folder,
      folderName: row.folder_name,
      images: []
    };

    // --- IDENTITY & DUPLICATE CHECKS ---
    if (!p.sourceUrl) {
      metrics.missingSourceUrl++;
    } else {
      if (urlTracker.has(p.sourceUrl)) {
        metrics.duplicateSourceUrl++;
        duplicateUrls.push(p.sourceUrl);
      } else {
        urlTracker.add(p.sourceUrl);
      }
    }

    if (!p.sku) {
      metrics.missingSku++;
    } else {
      if (skuTracker.has(p.sku)) {
        metrics.duplicateSku++;
        duplicateSkus.push(p.sku);
      } else {
        skuTracker.add(p.sku);
      }
    }
    
    if (p.nameAr) {
      if (nameTracker.has(p.nameAr) && !urlTracker.has(p.sourceUrl)) {
        // same name, different URL
        duplicateNames.push(p.nameAr);
      } else {
        nameTracker.add(p.nameAr);
      }
    }

    // --- MISSING FIELDS ---
    if (!p.nameAr) metrics.missingNameAr++;
    if (!p.nameEn) metrics.missingNameEn++;
    if (!p.categoryAr) metrics.missingCategoryAr++;
    else metrics.uniqueCategoryAr.add(p.categoryAr);
    if (!p.categoryEn) metrics.missingCategoryEn++;
    else metrics.uniqueCategoryEn.add(p.categoryEn);
    if (!p.shortDescriptionAr) metrics.missingShortDescAr++;
    if (!p.shortDescriptionEn) metrics.missingShortDescEn++;
    if (!p.detailsAr) metrics.missingDetailsAr++;
    if (!p.detailsEn) metrics.missingDetailsEn++;
    if (!p.brand) {
      metrics.missingBrand++;
    } else {
      metrics.uniqueBrands.add(p.brand);
      metrics.brandOccurrences[p.brand] = (metrics.brandOccurrences[p.brand] || 0) + 1;
    }

    // --- PRICES ---
    if (!row.source_price) metrics.missingSourcePrice++;
    if (!row.regular_price) metrics.missingRegularPrice++;
    if (!row.selling_price) metrics.missingSellingPrice++;
    
    if (isNaN(p.sourcePrice) || isNaN(p.sellingPrice)) {
      metrics.priceInvalidNumeric++;
    } else {
      if (p.sellingPrice > p.sourcePrice) metrics.priceSellingGreaterThanSource++;
      else if (p.sellingPrice === p.sourcePrice) metrics.priceSellingEqualToSource++;
      else if (p.sellingPrice < p.sourcePrice) metrics.priceSellingLessThanSource++;
    }

    // --- FILESYSTEM ---
    let folderExists = false;
    let targetFolderPath = "";
    
    if (p.imageFolder) {
      targetFolderPath = path.join(CATALOG_ROOT, p.imageFolder);
      if (fs.existsSync(targetFolderPath)) {
        folderExists = true;
      } else {
        metrics.unresolvedImageFolder++;
      }
    } else if (p.folderName) {
      // Fallback
      targetFolderPath = path.join(CATALOG_ROOT, 'Products', p.categoryAr || 'Uncategorized', p.folderName);
      if (fs.existsSync(targetFolderPath)) {
         folderExists = true;
      } else {
         metrics.unresolvedFolderName++;
      }
    }

    let actualImagesCount = 0;
    
    if (folderExists) {
      metrics.productFoldersFound++;
      
      const jsonPath = path.join(targetFolderPath, 'product.json');
      if (fs.existsSync(jsonPath)) {
        metrics.productJsonFilesFound++;
        try {
          JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch(e) {
          metrics.malformedJson++;
        }
      } else {
        metrics.missingProductJson++;
      }
      
      const files = fs.readdirSync(targetFolderPath);
      const imgFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|webp|gif)$/i));
      actualImagesCount = imgFiles.length;
      
      for (const imgFile of imgFiles) {
         const fullPath = path.join(targetFolderPath, imgFile);
         try {
           const meta = await sharp(fullPath).metadata();
           p.images.push({
             filename: imgFile,
             path: fullPath,
             width: meta.width,
             height: meta.height
           });
         } catch(e) {
           p.images.push({
             filename: imgFile,
             path: fullPath,
             width: null,
             height: null,
             error: e.message
           });
         }
      }
    }

    if (actualImagesCount === 0) metrics.zeroImages++;
    else if (actualImagesCount === 1) metrics.oneImage++;
    else metrics.multipleImages++;

    if (actualImagesCount !== p.imageCount) {
      metrics.imageCountMismatch++;
    }

    metrics.productsSuccessfullyParsed++;
    parsedProducts.push(p);
  }

  return parsedProducts;
}

function generateReport() {
// ...
  console.log(`\n[INFO] Machine-readable audit report saved to: ${reportPath}`);
}

module.exports = { parseCatalog };

if (require.main === module) {
  parseCatalog().then(generateReport).catch(console.error);
}
