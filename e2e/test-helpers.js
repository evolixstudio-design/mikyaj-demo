// e2e/test-helpers.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../backend/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function seedTestOrderWithItem(status = 'CONFIRMED', totalAmount = '15.500') {
  const orderNumber = 'QA-E2E-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const idemKey = 'idem-e2e-' + Date.now() + '-' + Math.random();
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get an active product or fallback
    const prodRes = await client.query("SELECT id, selling_price, sku FROM products WHERE status = 'ACTIVE' LIMIT 1");
    const product = prodRes.rows[0] || { id: 1, selling_price: '15.500', sku: 'TEST-SKU' };
    
    const ordRes = await client.query(`
      INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone, customer_address, 
        total_amount, currency, status, idempotency_key, created_at, updated_at
      ) VALUES ($1, 'Sara Al-Kuwaiti', 'sara@example.com', '96598765432', 'Hawalli, Block 3, Street 10, House 5', $2, 'KWD', $3, $4, NOW(), NOW())
      RETURNING *
    `, [orderNumber, totalAmount, status, idemKey]);
    const order = ordRes.rows[0];

    await client.query(`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      VALUES ($1, $2, 1, $3)
    `, [order.id, product.id, totalAmount]);

    // Insert payment
    const payRes = await client.query(`
      INSERT INTO payments (
        order_id, status, amount, currency, provider_payment_id, provider_invoice_id, created_at, updated_at
      ) VALUES ($1, $2, $3, 'KWD', $4, $5, NOW(), NOW())
      RETURNING *
    `, [order.id, status === 'CONFIRMED' || status === 'PROCESSING' || status === 'READY_FOR_DELIVERY' || status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED' ? 'SUCCESS' : 'PENDING', totalAmount, 'MF-PAY-' + Date.now(), 'INV-' + Date.now()]);
    const payment = payRes.rows[0];

    // Insert initial status history
    await client.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, reason, created_at)
      VALUES ($1, NULL, $2, 'Initial order creation for QA E2E', NOW())
    `, [order.id, status]);

    await client.query('COMMIT');
    return { order, payment, product };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedTestDriver(email = 'driver.e2e@mikyaj.com', password = 'driver_password_123') {
  const existing = await pool.query('SELECT * FROM drivers WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const res = await pool.query(`
    INSERT INTO drivers (name, email, phone, password_hash, status, created_at, updated_at)
    VALUES ('E2E Delivery Driver', $1, '96590001122', $2, 'ACTIVE', NOW(), NOW())
    RETURNING *
  `, [email, passwordHash]);
  return res.rows[0];
}

async function assignDriverToOrder(orderId, driverId, adminId = 1) {
  // Ensure existing assignments are completed/cancelled or check uniqueness
  await pool.query("UPDATE order_driver_assignments SET status = 'UNASSIGNED' WHERE order_id = $1 AND status = 'ACTIVE'", [orderId]);
  const res = await pool.query(`
    INSERT INTO order_driver_assignments (order_id, driver_id, assigned_by_admin_id, status, assigned_at)
    VALUES ($1, $2, $3, 'ACTIVE', NOW())
    RETURNING *
  `, [orderId, driverId, adminId]);
  return res.rows[0];
}

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const innerWidth = window.innerWidth;
    return {
      scrollWidth,
      innerWidth,
      hasOverflow: scrollWidth > innerWidth + 1
    };
  });
}

function attachAuditors(page) {
  const consoleErrors = [];
  const networkRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });
  page.on('request', req => {
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      postData: req.postData()
    });
  });
  return { consoleErrors, networkRequests };
}

module.exports = {
  seedTestOrderWithItem,
  seedTestDriver,
  assignDriverToOrder,
  checkOverflow,
  attachAuditors,
  pool
};
