const {Pool} = require('pg');
require('dotenv').config();
const p = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  const r = await p.query("SELECT name_ar, name_en FROM products WHERE name_ar LIKE '%يوجي تي%' LIMIT 5");
  console.table(r.rows);
  await p.end();
})();
