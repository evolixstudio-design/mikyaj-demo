require('dotenv').config();
const { pool } = require('./backend/db');

async function inspectPaid() {
  const { rows } = await pool.query(`
    SELECT p.id, p.order_id, p.provider, p.provider_invoice_id, p.provider_payment_id,
           p.status, p.amount, p.currency, p.created_at, p.updated_at,
           o.order_number, o.status as order_status, o.created_at as order_created_at
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE p.status = 'PAID'
    ORDER BY p.id ASC
  `);
  console.log('Total payments with status = PAID:', rows.length);
  rows.forEach(r => {
    console.log(JSON.stringify(r, null, 2));
  });

  // Check table constraints on payments.status
  const { rows: constraints } = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_class t ON c.conrelid = t.oid 
    WHERE t.relname = 'payments'
  `);
  console.log('\nPayments table constraints:', constraints);

  await pool.end();
}
inspectPaid();
