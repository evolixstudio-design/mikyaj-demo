require('dotenv').config({ path: '../.env' });
const { pool } = require('./db');

async function run() {
  try {
    const res = await pool.query(`
      INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, total_amount, currency, status) 
      VALUES ('TEST-HIST-02', 'Test Historical', '99999999', 'Kuwait City', '4.491', 'KWD', 'PENDING_PAYMENT') 
      RETURNING id
    `);
    const orderId = res.rows[0].id;
    
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) 
      VALUES ($1, (SELECT id FROM products LIMIT 1), 1, '1.499')
    `, [orderId]);
    
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) 
      VALUES ($1, (SELECT id FROM products LIMIT 1 OFFSET 1), 2, '1.496')
    `, [orderId]);
    
    console.log('Test order TEST-HIST-02 inserted');
  } catch(err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
