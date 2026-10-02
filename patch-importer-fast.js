const fs = require('fs');
let code = fs.readFileSync('database/import-catalog.js', 'utf8');

// 1. Replace Client with Pool
code = code.replace(/const \{ Client \} = require\('pg'\);/, "const { Pool } = require('pg');");
code = code.replace(/const client = new Client\(\{ connectionString: process\.env\.DATABASE_URL \}\);/, "const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });");

// Remove client.connect() since pool handles it
code = code.replace(/await client\.connect\(\);/, '');

// Replace the main loop
const loopStartIdx = code.indexOf('for (const p of products) {');
const loopEndStr = 'const afterCounts = await getCounts();';
const loopEndIdx = code.indexOf(loopEndStr);

let loopBody = code.substring(loopStartIdx, loopEndIdx);
// Extract what's inside the loop
const innerBodyMatch = loopBody.match(/for \(const p of products\) \{([\s\S]*?)\}\s*$/);
let innerBody = innerBodyMatch[1];

// Inside innerBody, replace client with a checked-out client from pool
innerBody = 'const client = await pool.connect(); try {' + innerBody.replace(/report\./g, 'localReport.') + '} finally { client.release(); }';

const chunkingLogic = `
  const chunkSize = 20;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    console.log(\`[INFO] Processing batch \${Math.floor(i/chunkSize) + 1} (\${i} to \${i+chunk.length} of \${products.length})...\`);
    await Promise.all(chunk.map(async (p) => {
      const localReport = {
        productsImported: 0, productsUpdated: 0, productsSkipped: 0, productsFailed: 0,
        categoriesCreated: 0, categoriesReused: 0, brandsCreated: 0,
        productsWithSku: 0, productsWithoutSku: 0, imagesDiscovered: 0,
        imagesUploaded: 0, imagesReused: 0, imageUploadFailures: 0,
        imageCountMismatches: 0, databaseErrors: 0
      };
      
      ${innerBody}
      
      // Merge localReport into global report
      for (const k in localReport) { report[k] += localReport[k]; }
    }));
  }
`;

code = code.substring(0, loopStartIdx) + chunkingLogic + code.substring(loopEndIdx);

// Replace client.query inside getCounts to pool.query
code = code.replace(/client\.query\(\`SELECT COUNT/g, 'pool.query(`SELECT COUNT');
code = code.replace(/await client\.end\(\);/, 'await pool.end();');

fs.writeFileSync('database/import-catalog.js', code);
console.log('Successfully patched import-catalog.js for chunking concurrency.');
