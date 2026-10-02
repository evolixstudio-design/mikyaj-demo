const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get products table schema
    const schema = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position"
    );
    console.log('=== PRODUCTS TABLE SCHEMA ===');
    schema.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // Sample products
    const sample = await pool.query('SELECT * FROM products LIMIT 3');
    console.log('\n=== SAMPLE PRODUCTS ===');
    sample.rows.forEach((r, i) => {
      console.log(`\n--- Product ${i+1} ---`);
      Object.entries(r).forEach(([k, v]) => {
        const val = typeof v === 'string' && v.length > 100 ? v.substring(0, 100) + '...' : v;
        console.log(`  ${k}: ${val}`);
      });
    });

    // Total count
    const cnt = await pool.query('SELECT count(*) FROM products');
    console.log('\nTotal products:', cnt.rows[0].count);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
