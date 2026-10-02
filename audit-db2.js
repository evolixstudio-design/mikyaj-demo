const {Pool} = require('pg');
require('dotenv').config();
const p = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  const r = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log(r.rows.map(row => row.table_name).join(', '));
  await p.end();
})();
