const { Pool } = require('pg');
const { parseCatalog } = require('./import-catalog-parser');
const crypto = require('crypto');
const slugify = require('slugify');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isFullImport = args.includes('--full-import');
const limitArgIdx = args.indexOf('--limit');
let limit = 10;

if (limitArgIdx !== -1 && args[limitArgIdx + 1]) {
  limit = parseInt(args[limitArgIdx + 1], 10);
}

if (!isFullImport && limit !== 10) {
  console.error("CRITICAL ERROR: Phase 1C strictly requires --limit 10. For full import, use --full-import explicitly.");
  process.exit(1);
}

if (isFullImport) {
  limit = null; // No limit
}

const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (!hasCloudinary) {
  console.log("[WARNING] Cloudinary credentials missing. Images will simulate upload failure.");
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function makeSlug(name, hash) {
  if (!name) return `product-${hash.slice(0, 10)}`;
  const base = slugify(name, { lower: true, strict: true });
  return base ? `${base}-${hash.slice(0, 6)}` : `product-${hash.slice(0, 10)}`;
}

async function uploadToCloudinary(filePath, publicId) {
  if (!hasCloudinary) {
     console.error(`Simulated upload failure for ${publicId}: No credentials`);
     return null;
  }
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      overwrite: true, 
      resource_type: "image"
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Cloudinary upload failed for ${publicId}:`, error);
    return null;
  }
}

async function main() {
  console.log(`Starting Phase 1C/1D Import... Dry Run: ${isDryRun}`);
  
  // STEP 1 & 2: Parse and Validate
  const rawProducts = await parseCatalog(isFullImport ? null : (limit || 10) * 20); 
  
  // Selection
  const products = [];
  if (isFullImport) {
    products.push(...rawProducts);
  } else {
    // Pick diverse products for the test
    let hasSku = false, noSku = false, oneImg = false, multiImg = false;
    
    for (const p of rawProducts) {
      if (products.length >= limit) break;
      
      if (!hasSku && p.sku) { hasSku = true; products.push(p); continue; }
      if (!noSku && !p.sku) { noSku = true; products.push(p); continue; }
      if (!oneImg && p.images.length === 1) { oneImg = true; products.push(p); continue; }
      if (!multiImg && p.images.length > 1) { multiImg = true; products.push(p); continue; }
      
      products.push(p);
    }
  }

  console.log(`\n===============================`);
  console.log(`PHASE 1C/1D TEST SELECTION`);
  console.log(`===============================`);
  console.log(`Products selected: ${products.length}`);

  // STEP 3: Print test set
  products.forEach((p, idx) => {
     console.log(`${idx + 1}. [${p.sku || 'NO-SKU'}] ${p.nameEn || 'NO-NAME'} (${p.images.length} imgs) -> ${p.categoryEn}`);
  });

  if (isDryRun) console.log("\n[DRY RUN] Simulating import without writing to DB or Cloudinary...");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 25 });
  

  const report = {
    productsImported: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    productsFailed: 0,
    categoriesCreated: 0,
    categoriesReused: 0,
    brandsCreated: 0,
    productsWithSku: 0,
    productsWithoutSku: 0,
    imagesDiscovered: 0,
    imagesUploaded: 0,
    imagesReused: 0,
    imageUploadFailures: 0,
    imageCountMismatches: 0,
    databaseErrors: 0,
  };

  const getCounts = async () => {
    const [pRes, cRes, iRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM products`),
      pool.query(`SELECT COUNT(*) FROM categories`),
      pool.query(`SELECT COUNT(*) FROM product_images`)
    ]);
    return {
      products: parseInt(pRes.rows[0].count, 10),
      categories: parseInt(cRes.rows[0].count, 10),
      images: parseInt(iRes.rows[0].count, 10)
    };
  };

  const beforeCounts = await getCounts();

  
  const chunkSize = 25;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    console.log(`[INFO] Processing batch ${Math.floor(i/chunkSize) + 1} (${i} to ${i+chunk.length} of ${products.length})...`);
    await Promise.all(chunk.map(async (p) => {
      const localReport = {
        productsImported: 0, productsUpdated: 0, productsSkipped: 0, productsFailed: 0,
        categoriesCreated: 0, categoriesReused: 0, brandsCreated: 0,
        productsWithSku: 0, productsWithoutSku: 0, imagesDiscovered: 0,
        imagesUploaded: 0, imagesReused: 0, imageUploadFailures: 0,
        imageCountMismatches: 0, databaseErrors: 0
      };
      
      const client = await pool.connect(); try {
    if (p.sku) localReport.productsWithSku++;
    else localReport.productsWithoutSku++;
    
    if (p.imageCount !== p.images.length) localReport.imageCountMismatches++;
    localReport.imagesDiscovered += p.images.length;

    try {
      if (!isDryRun) await client.query('BEGIN');

      // 1. Categories
      let categoryId;
      const catCheck = await client.query(`SELECT id FROM categories WHERE name_ar = $1`, [p.categoryAr]);
      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].id;
        localReport.categoriesReused++;
      } else {
        const catSlug = slugify(p.categoryEn || p.categoryAr || 'uncategorized', { lower: true, strict: true });
        let catInsert;
        if (!isDryRun) {
          catInsert = await client.query(
            `INSERT INTO categories (name_ar, name_en, slug) VALUES ($1, $2, $3) RETURNING id`,
            [p.categoryAr, p.categoryEn, catSlug]
          );
          categoryId = catInsert.rows[0].id;
        } else {
          categoryId = -1; // Fake ID
        }
        localReport.categoriesCreated++;
      }

      // 2. Identity
      const identityHash = sha256(p.sourceUrl);
      const slug = makeSlug(p.nameEn || p.nameAr, identityHash);

      // 3. Product Upsert
      let productId;
      let isUpdate = false;
      
      const prodCheck = await client.query(`SELECT id FROM products WHERE source_identity_hash = $1`, [identityHash]);
      
      if (prodCheck.rows.length > 0) {
        productId = prodCheck.rows[0].id;
        isUpdate = true;
        if (!isDryRun) {
          await client.query(`
          UPDATE products SET
            sku = $1, name_ar = $2, name_en = $3,
            short_description_ar = $4, short_description_en = $5,
            details_ar = $6, details_en = $7,
            category_id = $8, brand_id = $9,
            source_price = $10, regular_price = $11, selling_price = $12,
            source_image_count = $13, folder_name = $14, image_folder = $15,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $16
        `, [
          p.sku || null, p.nameAr || null, p.nameEn || null,
          p.shortDescriptionAr || null, p.shortDescriptionEn || null,
          p.detailsAr || null, p.detailsEn || null,
          categoryId, null,
          p.sourcePrice, p.regularPrice || null, p.sellingPrice,
          p.imageCount, p.folderName, p.imageFolder,
          productId
        ]);
        }
        localReport.productsUpdated++;
      } else {
        if (!isDryRun) {
          const prodInsert = await client.query(`
          INSERT INTO products (
            source_url, source_identity_hash, sku, slug,
            name_ar, name_en, short_description_ar, short_description_en, details_ar, details_en,
            category_id, brand_id, source_price, regular_price, selling_price,
            source_image_count, folder_name, image_folder
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          ) RETURNING id
        `, [
          p.sourceUrl, identityHash, p.sku || null, slug,
          p.nameAr || null, p.nameEn || null, p.shortDescriptionAr || null, p.shortDescriptionEn || null, p.detailsAr || null, p.detailsEn || null,
          categoryId, null, p.sourcePrice, p.regularPrice || null, p.sellingPrice,
          p.imageCount, p.folderName, p.imageFolder
        ]);
        productId = prodInsert.rows[0].id;
        } else {
          productId = -1;
        }
        localReport.productsImported++;
      }

      if (!isDryRun) await client.query('COMMIT');

      // 4. Cloudinary & Images
      let order = 1;
      for (const img of p.images) {
        const publicId = `mikyaj/products/${identityHash}/${order}`;
        
        // Check if image row already exists
        const imgCheck = await client.query(`SELECT id, cloudinary_url FROM product_images WHERE product_id = $1 AND image_order = $2`, [productId, order]);
        
        let cUrl = null;
        if (imgCheck.rows.length > 0 && imgCheck.rows[0].cloudinary_url) {
           // Re-use existing upload
           cUrl = imgCheck.rows[0].cloudinary_url;
           localReport.imagesReused++;
        } else {
           // Upload
           if (!isDryRun) {
             cUrl = await uploadToCloudinary(img.path, publicId);
           } else {
             cUrl = 'dry-run-fake-url';
           }
           if (cUrl) {
             localReport.imagesUploaded++;
           } else {
             localReport.imageUploadFailures++;
           }
        }

        // Upsert Image row
        if (!isDryRun) {
          if (imgCheck.rows.length > 0) {
           await client.query(`
             UPDATE product_images 
             SET cloudinary_public_id = $1, cloudinary_url = $2, width = $3, height = $4, source_filename = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
           `, [publicId, cUrl, img.width || 0, img.height || 0, img.filename, imgCheck.rows[0].id]);
        } else {
           await client.query(`
             INSERT INTO product_images (product_id, cloudinary_public_id, cloudinary_url, image_order, width, height, source_filename)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
           `, [productId, publicId, cUrl, order, img.width || 0, img.height || 0, img.filename]);
        }
        }
        
        order++;
      }

    } catch (e) {
      if (!isDryRun) await client.query('ROLLBACK');
      console.error(`Database error for product ${p.sourceUrl}:`, e);
      localReport.databaseErrors++;
      localReport.productsFailed++;
    }
  } finally { client.release(); }
      
      // Merge localReport into global report
      for (const k in localReport) { report[k] += localReport[k]; }
    }));
  }
const afterCounts = await getCounts();

  console.log(`\n===============================`);
  console.log(`PHASE 1C/1D TEST RESULT`);
  console.log(`===============================`);
  console.log(`Products selected: ${products.length}`);
  console.log(`Products imported: ${report.productsImported}`);
  console.log(`Products updated: ${report.productsUpdated}`);
  console.log(`Products skipped: ${report.productsSkipped}`);
  console.log(`Products failed: ${report.productsFailed}`);
  console.log(`Categories created: ${report.categoriesCreated}`);
  console.log(`Categories reused: ${report.categoriesReused}`);
  console.log(`Brands created: ${report.brandsCreated}`);
  console.log(`Products with SKU: ${report.productsWithSku}`);
  console.log(`Products without SKU: ${report.productsWithoutSku}`);
  console.log(`Images discovered: ${report.imagesDiscovered}`);
  console.log(`Images uploaded: ${report.imagesUploaded}`);
  console.log(`Images reused: ${report.imagesReused}`);
  console.log(`Image upload failures: ${report.imageUploadFailures}`);
  console.log(`Image-count mismatches: ${report.imageCountMismatches}`);
  console.log(`Database errors: ${report.databaseErrors}`);
  
  console.log(`\nDATABASE:`);
  console.log(`Products before: ${beforeCounts.products}`);
  console.log(`Products after: ${afterCounts.products}`);
  console.log(`Categories before: ${beforeCounts.categories}`);
  console.log(`Categories after: ${afterCounts.categories}`);
  console.log(`Images before: ${beforeCounts.images}`);
  console.log(`Images after: ${afterCounts.images}`);

  if (report.productsImported > 0) {
     console.log(`\n[INFO] To test idempotency, run this exact script again and observe 0 new creations.`);
  }

  await pool.end();
}

main().catch(console.error);
