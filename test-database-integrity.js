// test-database-integrity.js
require('dotenv').config();
const { pool } = require('./backend/db');

async function run() {
  console.log('====================================================');
  console.log('RUNNING FULL DATABASE INTEGRITY & REGRESSION AUDIT');
  console.log('====================================================\n');

  // 1. Orphan payments
  const orphanPayments = await pool.query(`
    SELECT p.id FROM payments p LEFT JOIN orders o ON p.order_id = o.id WHERE o.id IS NULL
  `);
  console.log(`Orphan payments: ${orphanPayments.rows.length} (Expected: 0)`);

  // 2. Orphan refunds
  const orphanRefunds = await pool.query(`
    SELECT r.id FROM refunds r LEFT JOIN orders o ON r.order_id = o.id WHERE o.id IS NULL
  `);
  console.log(`Orphan refunds: ${orphanRefunds.rows.length} (Expected: 0)`);

  // 3. Orphan status history
  const orphanHistory = await pool.query(`
    SELECT h.id FROM order_status_history h LEFT JOIN orders o ON h.order_id = o.id WHERE o.id IS NULL
  `);
  console.log(`Orphan status history: ${orphanHistory.rows.length} (Expected: 0)`);

  // 4. Invalid order status
  const validOrderStatuses = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  const invalidOrders = await pool.query(`
    SELECT id, order_number, status FROM orders WHERE status NOT IN (${validOrderStatuses.map(s => `'${s}'`).join(',')})
  `);
  console.log(`Invalid order statuses: ${invalidOrders.rows.length} (Expected: 0)`);

  // 5. Corrupted assignments
  const invalidAssignments = await pool.query(`
    SELECT id, status FROM order_driver_assignments WHERE status NOT IN ('ACTIVE', 'COMPLETED', 'UNASSIGNED')
  `);
  console.log(`Invalid assignment statuses: ${invalidAssignments.rows.length} (Expected: 0)`);

  // 6. Over-refunded payments
  const overRefunded = await pool.query(`
    SELECT p.id, p.amount, COALESCE(SUM(r.amount), 0) AS total_refunded
    FROM payments p
    LEFT JOIN refunds r ON p.id = r.payment_id AND r.status IN ('COMPLETED', 'REFUNDED')
    GROUP BY p.id, p.amount
    HAVING COALESCE(SUM(r.amount), 0) > p.amount
  `);
  console.log(`Over-refunded payments: ${overRefunded.rows.length} (Expected: 0)`);

  // 7. Legacy PAID payment inspection
  const paidPayments = await pool.query(`
    SELECT count(*) as count FROM payments WHERE status = 'PAID'
  `);
  console.log(`Legacy PAID payments count in test database: ${paidPayments.rows[0].count}`);

  const successPayments = await pool.query(`
    SELECT count(*) as count FROM payments WHERE status = 'SUCCESS'
  `);
  console.log(`Production/Active SUCCESS payments count: ${successPayments.rows[0].count}`);

  // 8. Idempotency uniqueness
  const dupIdempotency = await pool.query(`
    SELECT idempotency_key, COUNT(*)
    FROM refunds
    WHERE idempotency_key IS NOT NULL
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate idempotency keys: ${dupIdempotency.rows.length} (Expected: 0)`);

  await pool.end();
  console.log('\nDATABASE INTEGRITY AUDIT COMPLETE');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
