require('dotenv').config({ path: '../.env' });
const { pool } = require('./db');
const { requestRefund } = require('./services/refund-service');
const { reconcilePayment } = require('./services/reconciliation-service');
const myfatoorah = require('./services/myfatoorah');
const crypto = require('crypto');

// Mock makeRefund so we don't hit the real network during these fast DB tests
myfatoorah.makeRefund = async function({ paymentId, amount, currency, comment }) {
  return {
    RefundId: Math.floor(Math.random() * 1000000),
    RefundReference: 'REF-' + Date.now(),
    RefundStatus: 'REFUNDED'
  };
};

async function setupTestData() {
  const { rows: orderRows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status, idempotency_key)
    VALUES ('MKJ-TEST-' || extract(epoch from now()), 'Test User', 'test@example.com', '12345678', 'Test Address', 100.000, 'CONFIRMED', 'idem-${Date.now()}')
    RETURNING id, order_number
  `);
  
  const order = orderRows[0];
  
  const { rows: paymentRows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, provider_payment_id, status, amount, currency)
    VALUES ($1, 'INV-123', 'PAY-123', 'SUCCESS', 100.000, 'KWD')
    RETURNING id
  `, [order.id]);
  
  return { order, payment: paymentRows[0] };
}

async function runTests() {
  console.log('--- STARTING REFUND TESTS ---');
  let testData;
  try {
    testData = await setupTestData();
  } catch (err) {
    console.error('Failed to setup test data', err);
    process.exit(1);
  }

  const { order, payment } = testData;

  try {
    // 1. Amount Test: Partial Refund
    console.log('Test 1: Partial Refund (25.000)');
    const r1 = await requestRefund({
      orderId: order.id,
      paymentId: payment.id,
      amount: 25.000,
      reason: 'Partial 1'
    });
    console.log('-> Success, Status:', r1.status);

    // 2. Amount Test: Multiple Partial Refunds
    console.log('Test 2: Second Partial Refund (25.000)');
    const r2 = await requestRefund({
      orderId: order.id,
      paymentId: payment.id,
      amount: 25.000,
      reason: 'Partial 2'
    });
    console.log('-> Success, Status:', r2.status);

    // 3. Amount Test: Over-refund expected to fail
    console.log('Test 3: Over-refund (50.001) - Expected to fail');
    try {
      await requestRefund({
        orderId: order.id,
        paymentId: payment.id,
        amount: 50.001,
        reason: 'Over refund'
      });
      throw new Error('Over-refund did not throw!');
    } catch (err) {
      console.log('-> Caught expected error:', err.message);
    }

    // 4. Amount Test: Exhausting the remaining balance
    console.log('Test 4: Exhaust balance (50.000)');
    const r3 = await requestRefund({
      orderId: order.id,
      paymentId: payment.id,
      amount: 50.000,
      reason: 'Full remaining'
    });
    console.log('-> Success, Status:', r3.status);

    // 5. Amount Test: Zero refund expected to fail
    console.log('Test 5: Zero Refund - Expected to fail');
    try {
      await requestRefund({
        orderId: order.id,
        paymentId: payment.id,
        amount: 0,
        reason: 'Zero'
      });
      throw new Error('Zero refund did not throw!');
    } catch (err) {
      console.log('-> Caught expected error:', err.message);
    }

    // 6. Reconciliation Test
    console.log('Test 6: Reconciliation Service');
    const rec = await reconcilePayment(payment.id);
    console.log(`-> Reconciled: ${rec.reconciliationState}, Remaining: ${rec.remainingRefundableAmount}, Completed: ${rec.refundedCompletedAmount}`);

    // 7. Idempotency Test
    console.log('Test 7: Idempotency reuse');
    const idemKey = 'idem-refund-' + Date.now();
    
    // Add 10 KWD to a new payment to test idempotency
    const { rows: newPaymentRows } = await pool.query(`
      INSERT INTO payments (order_id, provider_invoice_id, provider_payment_id, status, amount, currency)
      VALUES ($1, 'INV-999', 'PAY-999', 'SUCCESS', 10.000, 'KWD')
      RETURNING id
    `, [order.id]);
    const p2Id = newPaymentRows[0].id;
    
    const req1 = await requestRefund({ orderId: order.id, paymentId: p2Id, amount: 5, reason: 'Idem 1', idempotencyKey: idemKey });
    const req2 = await requestRefund({ orderId: order.id, paymentId: p2Id, amount: 5, reason: 'Idem 1', idempotencyKey: idemKey });
    
    if (req1.id === req2.id) {
      console.log('-> Success, idempotency returned same refund ID:', req1.id);
    } else {
      throw new Error('Idempotency failed, created duplicate');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    console.log('--- TESTS COMPLETE ---');
    pool.end();
  }
}

runTests();
