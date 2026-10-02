require('dotenv').config();
const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// 1. Read catalog data
const catalogStr = fs.readFileSync(path.join(__dirname, 'mikyaj-demo', 'js', 'catalog-data.js'), 'utf8');
const window = {};
eval(catalogStr);
const products = window.ATTAR_CATALOG_PRODUCTS;

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function run() {
  await pgClient.connect();
  console.log('Connected to PostgreSQL');

  // Create tables
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      nameAr TEXT,
      slug TEXT,
      brand VARCHAR(255),
      brandId VARCHAR(255),
      category VARCHAR(255),
      description TEXT,
      descriptionAr TEXT,
      price DECIMAL(10,3),
      comparePrice DECIMAL(10,3),
      costPrice DECIMAL(10,3),
      sku VARCHAR(255),
      stock INTEGER,
      stockStatus VARCHAR(100),
      sourceUrl TEXT,
      published BOOLEAN,
      featured BOOLEAN,
      images JSONB,
      tags JSONB,
      climateTags JSONB,
      volume VARCHAR(100),
      ewgRating INTEGER,
      crueltyFree BOOLEAN,
      vegan BOOLEAN,
      halalCertified BOOLEAN,
      shades JSONB
    );
  `);
  console.log('Tables created');

  // Insert data
  for (const p of products) {
    const images = JSON.stringify(p.images || []);
    const tags = JSON.stringify(p.tags || []);
    const climateTags = JSON.stringify(p.climateTags || []);
    const shades = JSON.stringify(p.shades || []);
    
    await pgClient.query(`
      INSERT INTO products (
        id, name, nameAr, slug, brand, brandId, category, description, descriptionAr,
        price, comparePrice, costPrice, sku, stock, stockStatus, sourceUrl, published,
        featured, images, tags, climateTags, volume, ewgRating, crueltyFree, vegan, halalCertified, shades
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      ON CONFLICT (id) DO UPDATE SET 
        name=EXCLUDED.name, price=EXCLUDED.price, images=EXCLUDED.images
    `, [
      p.id, p.name, p.nameAr, p.slug, p.brand, p.brandId, p.category, p.description, p.descriptionAr,
      p.price, p.comparePrice, p.costPrice, p.sku, p.stock, p.stockStatus, p.sourceUrl, p.published,
      p.featured, images, tags, climateTags, p.volume, p.ewgRating, p.crueltyFree, p.vegan, p.halalCertified, shades
    ]);
  }
  console.log('Products inserted');

  // Upload images
  const productsDir = path.join(__dirname, 'mikyaj-demo', 'assets', 'products');
  if (fs.existsSync(productsDir)) {
    const folders = fs.readdirSync(productsDir);
    for (const folder of folders) {
      const folderPath = path.join(productsDir, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          if (file.endsWith('.webp')) {
            const filePath = path.join(folderPath, file);
            const fileStream = fs.createReadStream(filePath);
            const s3Key = `products/${folder}/${file}`;
            console.log(`Uploading ${s3Key}...`);
            await s3Client.send(new PutObjectCommand({
              Bucket: process.env.S3_BUCKET,
              Key: s3Key,
              Body: fileStream,
              ContentType: mime.lookup(filePath) || 'image/webp'
            }));
          }
        }
      }
    }
  }

  console.log('Done!');
  await pgClient.end();
}

run().catch(console.error);
