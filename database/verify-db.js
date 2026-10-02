const { Client } = require('pg');
require('dotenv').config();

async function verify() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const pRes = await client.query(`
    SELECT id, source_url, source_identity_hash, sku, name_ar, name_en, 
           category_id, brand_id, source_price, regular_price, selling_price, 
           currency, source_image_count
    FROM products
    ORDER BY id ASC
  `);
  
  const iRes = await client.query(`
    SELECT product_id, image_order, cloudinary_public_id, cloudinary_url, width, height, source_filename
    FROM product_images
    ORDER BY product_id ASC, image_order ASC
  `);
  
  const imagesByProduct = {};
  iRes.rows.forEach(img => {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push(img);
  });
  
  console.log("=========================================");
  console.log("DATABASE VERIFICATION EXPORT");
  console.log("=========================================\n");
  
  pRes.rows.forEach(p => {
    console.log(`Product ID: ${p.id}`);
    console.log(`Source URL: ${p.source_url}`);
    console.log(`Identity Hash: ${p.source_identity_hash}`);
    console.log(`SKU: ${p.sku === null ? 'NULL' : p.sku}`);
    console.log(`Name AR: ${p.name_ar === null ? 'NULL' : p.name_ar}`);
    console.log(`Name EN: ${p.name_en === null ? 'NULL' : p.name_en}`);
    console.log(`Category ID: ${p.category_id}`);
    console.log(`Brand ID: ${p.brand_id === null ? 'NULL' : p.brand_id}`);
    console.log(`Source Price: ${p.source_price}`);
    console.log(`Regular Price: ${p.regular_price === null ? 'NULL' : p.regular_price}`);
    console.log(`Selling Price: ${p.selling_price}`);
    console.log(`Currency: ${p.currency}`);
    console.log(`Source Image Count: ${p.source_image_count}`);
    
    console.log(`\n  --- Images ---`);
    const imgs = imagesByProduct[p.id] || [];
    if (imgs.length === 0) console.log(`  (No images)`);
    imgs.forEach(img => {
       console.log(`  Order: ${img.image_order} | Size: ${img.width}x${img.height} | File: ${img.source_filename}`);
       console.log(`  Cloudinary ID: ${img.cloudinary_public_id}`);
       console.log(`  Cloudinary URL: ${img.cloudinary_url === null ? 'NULL' : img.cloudinary_url}`);
       console.log(`  -`);
    });
    console.log(`=========================================\n`);
  });
  
  await client.end();
}

verify().catch(console.error);
