const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('UPDATE products SET images = $1 WHERE id = $2', [JSON.stringify(['assets/images/product_skincare_set.webp']), 'ATTAR-5913'])
  .then(() => {
    console.log('Database updated successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
