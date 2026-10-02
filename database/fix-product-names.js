/**
 * fix-product-names-v3.js — BULK UPDATE via unnest
 * 
 * Uses a single bulk SQL UPDATE to fix all product names at once,
 * avoiding the overhead of thousands of individual UPDATE statements.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const CATALOG_ROOT = path.resolve(process.cwd(), 'images/AttarKuwait_Catalog');
const CSV_FILE = path.join(CATALOG_ROOT, '_metadata', 'catalog.csv');

function buildEnglishName(nameAr, brand) {
  if (!nameAr) return nameAr || '';
  const latinFragments = [];
  const latinRegex = /[A-Za-z][A-Za-z0-9\s.,\-'&+]*[A-Za-z0-9]|[A-Za-z]/g;
  let m;
  while ((m = latinRegex.exec(nameAr)) !== null) {
    const f = m[0].trim();
    if (f.length >= 2) latinFragments.push(f);
  }
  const arabicUnits = { 'مل': 'ml', 'ملل': 'ml', 'لتر': 'L', 'غرام': 'g', 'غ': 'g', 'جرام': 'g', 'جم': 'g', 'كجم': 'kg', 'كيلو': 'kg', 'قطعة': 'pcs', 'قطع': 'pcs' };
  const numUnitRegex = /(\d+(?:\.\d+)?)\s*(مل|ملل|لتر|غرام|غ|جرام|جم|كجم|كيلو|قطعة|قطع)/g;
  const quantities = [];
  while ((m = numUnitRegex.exec(nameAr)) !== null) {
    quantities.push(`${m[1]}${arabicUnits[m[2]] || m[2]}`);
  }
  let parts = [];
  if (brand && !latinFragments.some(f => f.toLowerCase().includes(brand.toLowerCase()))) parts.push(brand);
  parts = parts.concat(latinFragments);
  if (quantities.length > 0) parts.push(quantities.join(' '));
  return parts.length > 0 ? parts.join(' - ').replace(/\s+/g, ' ').trim() : nameAr;
}

function cleanDesc(d) {
  if (!d) return null;
  return d.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() || null;
}

async function main() {
  console.log('=== MIKYAJ Product Names Fix (v3 — Bulk) ===\n');
  
  // 1. Read CSV
  const csvData = fs.readFileSync(CSV_FILE, 'utf8').replace(/^\uFEFF/, '');
  const records = parse(csvData, { columns: true, skip_empty_lines: true, relax_column_count: true });
  console.log(`[CSV] Loaded ${records.length} records`);
  
  // 2. Build lookup indexes
  const byUrl = new Map();
  const bySku = new Map();
  const byFolder = new Map();
  
  for (const row of records) {
    const url = (row.product_url || '').trim().replace(/\/+$/, '');
    if (url) {
      byUrl.set(url, row);
      try { byUrl.set(decodeURIComponent(url), row); } catch(e) {}
    }
    const sku = (row.sku || '').trim();
    if (sku) bySku.set(sku, row);
    const fn = (row.folder_name || '').trim().replace(/\r?\n/g, '');
    if (fn) byFolder.set(fn, row);
  }
  console.log(`[Index] URLs: ${byUrl.size}, SKUs: ${bySku.size}, Folders: ${byFolder.size}`);
  
  // 3. Get all products
  const { rows: products } = await pool.query(
    'SELECT id, source_url, name_ar, name_en, short_description_ar, short_description_en, details_ar, details_en, sku, folder_name FROM products ORDER BY id'
  );
  console.log(`[DB] ${products.length} products\n`);
  
  // 4. Build update arrays in memory (fast — O(1) lookups)
  const ids = [], nameArs = [], nameEns = [], descArs = [], descEns = [], detArs = [], detEns = [];
  let matched = 0, unmatched = 0, skipped = 0;
  
  console.log('[Phase 1] Building update map...');
  for (const prod of products) {
    const dbUrl = (prod.source_url || '').trim().replace(/\/+$/, '');
    
    let csvRow = byUrl.get(dbUrl);
    if (!csvRow) { try { csvRow = byUrl.get(decodeURIComponent(dbUrl)); } catch(e) {} }
    if (!csvRow && prod.folder_name) csvRow = byFolder.get(prod.folder_name);
    if (!csvRow && prod.sku) csvRow = bySku.get(prod.sku);
    
    if (!csvRow) { unmatched++; continue; }
    matched++;
    
    const nameAr = (csvRow.product_name_ar || csvRow['\uFEFFproduct_name_ar'] || '').trim();
    if (!nameAr) { skipped++; continue; }
    
    const brand = (csvRow.brand || '').trim();
    const nameEn = buildEnglishName(nameAr, brand);
    
    ids.push(prod.id);
    nameArs.push(nameAr);
    nameEns.push(nameEn || nameAr);
    descArs.push(cleanDesc(csvRow.short_description_ar) || prod.short_description_ar || null);
    descEns.push(cleanDesc(csvRow.short_description_en) || prod.short_description_en || null);
    detArs.push(cleanDesc(csvRow.details_ar) || prod.details_ar || null);
    detEns.push(cleanDesc(csvRow.details_en) || prod.details_en || null);
  }
  
  console.log(`  Matched: ${matched}, To update: ${ids.length}, Unmatched: ${unmatched}, Skipped (empty name): ${skipped}\n`);
  
  // 5. Execute SINGLE bulk UPDATE using unnest arrays
  if (ids.length > 0) {
    console.log(`[Phase 2] Executing bulk UPDATE for ${ids.length} products...`);
    const t0 = Date.now();
    
    await pool.query(`
      UPDATE products AS p SET
        name_ar = u.name_ar,
        name_en = u.name_en,
        short_description_ar = COALESCE(u.desc_ar, p.short_description_ar),
        short_description_en = COALESCE(u.desc_en, p.short_description_en),
        details_ar = COALESCE(u.det_ar, p.details_ar),
        details_en = COALESCE(u.det_en, p.details_en),
        updated_at = NOW()
      FROM (
        SELECT * FROM unnest(
          $1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]
        ) AS t(id, name_ar, name_en, desc_ar, desc_en, det_ar, det_en)
      ) AS u
      WHERE p.id = u.id
    `, [ids, nameArs, nameEns, descArs, descEns, detArs, detEns]);
    
    console.log(`  Bulk UPDATE completed in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }
  
  // 6. Phase 3: Fix remaining NULL names from product.json files
  console.log('\n[Phase 3] Fixing remaining NULL names from product.json...');
  const { rows: nullProds } = await pool.query('SELECT id, image_folder, folder_name FROM products WHERE name_ar IS NULL');
  console.log(`  ${nullProds.length} products still have NULL names`);
  
  const jsonIds = [], jsonNameArs = [], jsonNameEns = [], jsonDescs = [];
  for (const prod of nullProds) {
    const paths = [
      prod.image_folder ? path.join(CATALOG_ROOT, prod.image_folder, 'product.json') : null,
      prod.folder_name ? path.join(CATALOG_ROOT, 'Products', 'Uncategorized', prod.folder_name, 'product.json') : null
    ].filter(Boolean);
    
    for (const jp of paths) {
      if (!fs.existsSync(jp)) continue;
      try {
        const pd = JSON.parse(fs.readFileSync(jp, 'utf8'));
        const nameAr = (pd.product_name || '').trim();
        if (!nameAr) continue;
        jsonIds.push(prod.id);
        jsonNameArs.push(nameAr);
        jsonNameEns.push(buildEnglishName(nameAr, pd.brand || ''));
        jsonDescs.push(cleanDesc(pd.description));
        break;
      } catch(e) {}
    }
  }
  
  if (jsonIds.length > 0) {
    console.log(`  Updating ${jsonIds.length} via product.json...`);
    await pool.query(`
      UPDATE products AS p SET
        name_ar = u.name_ar,
        name_en = u.name_en,
        short_description_ar = COALESCE(u.desc_ar, p.short_description_ar),
        updated_at = NOW()
      FROM (
        SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[]) AS t(id, name_ar, name_en, desc_ar)
      ) AS u
      WHERE p.id = u.id
    `, [jsonIds, jsonNameArs, jsonNameEns, jsonDescs]);
    console.log(`  Done!`);
  }
  
  // 7. Phase 4: Extract names from source_url for any STILL null
  const { rows: stillNull } = await pool.query('SELECT id, source_url FROM products WHERE name_ar IS NULL');
  console.log(`\n[Phase 4] ${stillNull.length} products still NULL — extracting from URL...`);
  
  const urlIds = [], urlNames = [];
  for (const prod of stillNull) {
    if (!prod.source_url) continue;
    try {
      const urlPath = decodeURIComponent(new URL(prod.source_url).pathname);
      const slug = urlPath.replace(/^\/product\//, '').replace(/\/$/, '').replace(/-\d+$/, '').replace(/-/g, ' ').trim();
      if (slug && slug.length > 2) {
        urlIds.push(prod.id);
        urlNames.push(slug);
      }
    } catch(e) {}
  }
  
  if (urlIds.length > 0) {
    await pool.query(`
      UPDATE products AS p SET name_ar = u.name, name_en = u.name, updated_at = NOW()
      FROM (SELECT * FROM unnest($1::int[], $2::text[]) AS t(id, name)) AS u
      WHERE p.id = u.id
    `, [urlIds, urlNames]);
    console.log(`  Fixed ${urlIds.length} from URLs`);
  }
  
  // 8. Final verification
  const { rows: [v] } = await pool.query(`
    SELECT count(*) as total, count(name_ar) as ar, count(name_en) as en, 
           count(short_description_ar) as desc_ar, count(details_ar) as det_ar
    FROM products`);
  
  console.log('\n=== FINAL VERIFICATION ===');
  console.log(`Total:       ${v.total}`);
  console.log(`Has name_ar: ${v.ar} (${(v.ar/v.total*100).toFixed(1)}%)`);
  console.log(`Has name_en: ${v.en} (${(v.en/v.total*100).toFixed(1)}%)`);
  console.log(`Has desc_ar: ${v.desc_ar}`);
  console.log(`Has det_ar:  ${v.det_ar}`);
  
  const { rows: samples } = await pool.query('SELECT id, name_ar, name_en FROM products WHERE name_ar IS NOT NULL ORDER BY RANDOM() LIMIT 10');
  console.log('\n=== SAMPLE PRODUCTS ===');
  samples.forEach(s => console.log(`  #${s.id}: AR="${(s.name_ar||'').substring(0,50)}" EN="${(s.name_en||'').substring(0,50)}"`));
  
  await pool.end();
  console.log('\n✅ All done!');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
