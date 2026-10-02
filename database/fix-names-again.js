const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query('UPDATE products SET name_en = name_ar;');
  console.log('Updated all products to use name_ar for name_en');
  process.exit(0);
}
run();
