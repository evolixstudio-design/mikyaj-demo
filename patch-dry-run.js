const fs = require('fs');

let code = fs.readFileSync('database/import-catalog.js', 'utf8');

// 1. Remove the early exit for isDryRun
code = code.replace(/if \(isDryRun\) \{[\s\S]*?process\.exit\(0\);\s*\}/, 
  'if (isDryRun) console.log("\\n[DRY RUN] Simulating import without writing to DB or Cloudinary...");');

// 2. Prevent DB writes and Cloudinary uploads when isDryRun is true

// Wrap BEGIN / COMMIT / ROLLBACK
code = code.replace(/await client\.query\('BEGIN'\);/g, "if (!isDryRun) await client.query('BEGIN');");
code = code.replace(/await client\.query\('COMMIT'\);/g, "if (!isDryRun) await client.query('COMMIT');");
code = code.replace(/await client\.query\('ROLLBACK'\);/g, "if (!isDryRun) await client.query('ROLLBACK');");

// For categories
code = code.replace(/const catInsert = await client\.query\(\s*`INSERT INTO categories[\s\S]*?RETURNING id`,\s*\[p\.categoryAr, p\.categoryEn, catSlug\]\s*\);\s*categoryId = catInsert\.rows\[0\]\.id;/m,
`let catInsert;
        if (!isDryRun) {
          catInsert = await client.query(
            \`INSERT INTO categories (name_ar, name_en, slug) VALUES ($1, $2, $3) RETURNING id\`,
            [p.categoryAr, p.categoryEn, catSlug]
          );
          categoryId = catInsert.rows[0].id;
        } else {
          categoryId = -1; // Fake ID
        }`);

// For products update
code = code.replace(/await client\.query\(\`\s*UPDATE products SET[\s\S]*?WHERE id = \$16\s*\`,\s*\[[\s\S]*?productId\s*\]\);/m,
`if (!isDryRun) {
          $&
        }`);

// For products insert
code = code.replace(/const prodInsert = await client\.query\(\`\s*INSERT INTO products \([\s\S]*?RETURNING id\s*\`,\s*\[[\s\S]*?\]\);\s*productId = prodInsert\.rows\[0\]\.id;/m,
`if (!isDryRun) {
          $&
        } else {
          productId = -1;
        }`);

// For Cloudinary Upload
code = code.replace(/cUrl = await uploadToCloudinary\(img\.path, publicId\);/g,
`if (!isDryRun) {
             cUrl = await uploadToCloudinary(img.path, publicId);
           } else {
             cUrl = 'dry-run-fake-url';
           }`);

// For Images Upsert
code = code.replace(/if \(imgCheck\.rows\.length > 0\) \{\s*await client\.query\(\`\s*UPDATE product_images[\s\S]*?\]\);\s*\} else \{\s*await client\.query\(\`\s*INSERT INTO product_images[\s\S]*?\]\);\s*\}/m,
`if (!isDryRun) {
          $&
        }`);

fs.writeFileSync('database/import-catalog.js', code);
console.log('Patched import-catalog.js for dry run support.');
