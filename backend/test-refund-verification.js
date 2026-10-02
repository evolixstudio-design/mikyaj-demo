require('dotenv').config({ path: '../.env' });
const { pool } = require('./db');
const { requestRefund } = require('./services/refund-service');
const { reconcilePayment } = require('./services/reconciliation-service');
const myfatoorah = require('./services/myfatoorah');
const request = require('supertest');
const crypto = require('crypto');
const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();
app.use(express.json());
app.use('/api/webhook', webhookRouter);

// Mock makeRefund so we don't hit real network during these fast DB tests
myfatoorah.makeRefund = async function({ paymentId, amount, currency, comment }) {
  if (comment === 'Provider Fail Test') {
    throw new Error('Explicit Provider Rejection');
  }
  if (comment === 'Ambiguous Response Test') {
    // Simulate network loss where we don't get the response but provider processed it
    throw new Error('ETIMEDOUT');
  }
  return {
    RefundId: Math.floor(Math.random() * 1000000),
    RefundReference: 'REF-' + Date.now(),
    RefundStatus: 'REFUNDED'
  };
};

async function createTestOrderAndPayment(amountStr) {
  const { rows: orderRows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status, idempotency_key)
    VALUES ('MKJ-VERIFY-' || extract(epoch from now()) || '-' || random(), 'Test User', 'test@example.com', '12345678', 'Test Address', $1, 'CONFIRMED', 'idem-${Date.now()}-${Math.random()}')
    RETURNING id, order_number, total_amount
  `, [amountStr]);
  const order = orderRows[0];
  const { rows: paymentRows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, provider_payment_id, status, amount, currency)
    VALUES ($1, $2, $3, 'SUCCESS', $4, 'KWD')
    RETURNING id, amount
  `, [order.id, 'INV-' + order.id, 'PAY-' + order.id, amountStr]);
  return { order, payment: paymentRows[0] };
}

async function runTests() {
  console.log('--- STARTING FINANCIAL FORENSIC VERIFICATION ---');
  let passed = 0; let failed = 0;
  function assert(condition, message) {
    if (condition) { passed++; console.log('✅ PASS: ' + message); }
    else { failed++; console.error('❌ FAIL: ' + message); }
  }
  
  try {
    // ---------------------------------------------------------
    // 1. AMOUNT-ARITHMETIC AUDIT & FINANCIAL PRECISION
    // ---------------------------------------------------------
    console.log('\n--- 1. PRECISION TESTS ---');
    const t1 = await createTestOrderAndPayment('100.000');
    // JS 0.1 + 0.2 floating point issues:
    // Testing 0.001 bounds
    const r1a = await requestRefund({ orderId: t1.order.id, paymentId: t1.payment.id, amount: 0.001, reason: 'Precision test 1' });
    const r1b = await requestRefund({ orderId: t1.order.id, paymentId: t1.payment.id, amount: '0.001', reason: 'Precision test 2' });
    assert(r1a.status === 'REFUNDED', '0.001 refund processed');
    
    // Testing more than 3 decimals
    try {
      await requestRefund({ orderId: t1.order.id, paymentId: t1.payment.id, amount: 0.0001, reason: 'Precision test 3' });
      assert(false, 'Should have blocked 4 decimal places');
    } catch (err) {
      assert(err.message === 'INVALID_PRECISION', '4 decimal places blocked securely (INVALID_PRECISION)');
    }
    
    try {
      await requestRefund({ orderId: t1.order.id, paymentId: t1.payment.id, amount: -10, reason: 'Negative test' });
      assert(false, 'Should have blocked negative values');
    } catch (err) {
      assert(err.message === 'INVALID_AMOUNT', 'Negative values blocked');
    }

    // ---------------------------------------------------------
    // 2. FULL REFUND & MULTIPLE PARTIAL REFUNDS
    // ---------------------------------------------------------
    console.log('\n--- 2. PARTIAL/FULL REFUND TESTS ---');
    const t2 = await createTestOrderAndPayment('100.000');
    await requestRefund({ orderId: t2.order.id, paymentId: t2.payment.id, amount: 20.000, reason: 'P1' });
    await requestRefund({ orderId: t2.order.id, paymentId: t2.payment.id, amount: 30.000, reason: 'P2' });
    await requestRefund({ orderId: t2.order.id, paymentId: t2.payment.id, amount: 50.000, reason: 'P3' });
    
    const rec2 = await reconcilePayment(t2.payment.id);
    assert(rec2.refundedCompletedAmount === 100, 'Partial refunds total exact 100.000');
    assert(rec2.remainingRefundableAmount === 0, 'Remaining is precisely 0');
    
    try {
      await requestRefund({ orderId: t2.order.id, paymentId: t2.payment.id, amount: 0.001, reason: 'P4' });
      assert(false, 'Should have blocked 0.001 over-refund');
    } catch (err) {
      assert(err.message === 'AMOUNT_EXCEEDS_REMAINING_BALANCE', 'Over-refund correctly blocked at 0.001 KWD');
    }

    // ---------------------------------------------------------
    // 3. OVER-REFUND CONCURRENCY
    // ---------------------------------------------------------
    console.log('\n--- 3. CONCURRENCY TESTS ---');
    const t3 = await createTestOrderAndPayment('100.000');
    // Promise.all to fire simultaneously and test row locks
    const reqs = [
      requestRefund({ orderId: t3.order.id, paymentId: t3.payment.id, amount: 70.000, reason: 'Conc 1' }).catch(e => e.message),
      requestRefund({ orderId: t3.order.id, paymentId: t3.payment.id, amount: 50.000, reason: 'Conc 2' }).catch(e => e.message)
    ];
    const results = await Promise.all(reqs);
    const rec3 = await reconcilePayment(t3.payment.id);
    
    assert(
      (results[0].status === 'REFUNDED' && results[1] === 'AMOUNT_EXCEEDS_REMAINING_BALANCE') ||
      (results[1].status === 'REFUNDED' && results[0] === 'AMOUNT_EXCEEDS_REMAINING_BALANCE'),
      'Simultaneous refunds successfully mutually excluded via FOR UPDATE locks'
    );
    assert(rec3.refundedCompletedAmount === 70 || rec3.refundedCompletedAmount === 50, 'Completed amount is exactly one of the successful requests');
    
    // ---------------------------------------------------------
    // 4. IDEMPOTENCY
    // ---------------------------------------------------------
    console.log('\n--- 4. IDEMPOTENCY TESTS ---');
    const t4 = await createTestOrderAndPayment('100.000');
    const idempotencyKey = 'IDEM-' + Date.now();
    const idem1 = await requestRefund({ orderId: t4.order.id, paymentId: t4.payment.id, amount: 25, reason: 'Idem 1', idempotencyKey });
    const idem2 = await requestRefund({ orderId: t4.order.id, paymentId: t4.payment.id, amount: 25, reason: 'Idem 1', idempotencyKey });
    
    assert(idem1.id === idem2.id, 'Idempotent calls returned exact same database ID');
    const rec4 = await reconcilePayment(t4.payment.id);
    assert(rec4.refundedCompletedAmount === 25, 'Total refunded strictly 25, not 50');

    // ---------------------------------------------------------
    // 5. AMBIGUOUS PROVIDER RESPONSE & WEBHOOK SYNC
    // ---------------------------------------------------------
    console.log('\n--- 5. AMBIGUOUS PROVIDER RESPONSE TESTS ---');
    const t5 = await createTestOrderAndPayment('100.000');
    const providerRes = await requestRefund({ orderId: t5.order.id, paymentId: t5.payment.id, amount: 10, reason: 'Ambiguous Response Test' });
    
    assert(providerRes.status === 'PROVIDER_ERROR', 'Network error safely mapped to PROVIDER_ERROR without duplicate attempt');
    const rec5a = await reconcilePayment(t5.payment.id);
    assert(rec5a.refundedCompletedAmount === 0, 'PROVIDER_ERROR does not reduce remaining available if unconfirmed, or safely forces manual check');

    // ---------------------------------------------------------
    // 6. UNKNOWN REFUND (EXTERNAL WEBHOOK)
    // ---------------------------------------------------------
    console.log('\n--- 6. EXTERNAL WEBHOOK & SIGNATURE TESTS ---');
    // Generate valid signature for webhook
    const webhookSecret = process.env.MYFATOORAH_WEBHOOK_SECRET;
    const fakeRefundId = 999999;
    const payload = {
      Event: 'RefundStatusChanged',
      Data: {
        InvoiceId: 101, // Arbitrary
        PaymentId: 'PAY-101',
        RefundId: fakeRefundId,
        RefundReference: 'REF-EXTERNAL',
        RefundStatus: 'Refunded',
        RefundAmount: 50.000,
        Currency: 'KWD'
      }
    };
    
    // Sort and sign exactly like myfatoorah.js
    const stringToSign = `Data.Currency=${payload.Data.Currency},Data.InvoiceId=${payload.Data.InvoiceId},Data.PaymentId=${payload.Data.PaymentId},Data.RefundAmount=${payload.Data.RefundAmount},Data.RefundId=${payload.Data.RefundId},Data.RefundReference=${payload.Data.RefundReference},Data.RefundStatus=${payload.Data.RefundStatus},Event=${payload.Event}`;
    const signature = crypto.createHmac('sha256', webhookSecret).update(stringToSign).digest('base64');
    
    const whRes = await request(app)
      .post('/api/webhook/myfatoorah')
      .set('myfatoorah-signature', signature)
      .send(payload);
      
    assert(whRes.status === 200, 'Valid webhook signature accepted');
    
    // Check if the external refund was safely recorded
    // Wait, the webhook uses InvoiceId to find the payment. In our payload InvoiceId is 101, which doesn't exist.
    // Let's create a payment for it.
    const t6 = await createTestOrderAndPayment('100.000');
    const payload6 = {
      Event: 'RefundStatusChanged',
      Data: {
        InvoiceId: `INV-${t6.order.id}`,
        PaymentId: `PAY-${t6.order.id}`,
        RefundId: 888888,
        RefundReference: 'REF-EXTERNAL-2',
        RefundStatus: 'Refunded',
        RefundAmount: 5.000,
        Currency: 'KWD'
      }
    };
    const str6 = `Data.Currency=KWD,Data.InvoiceId=INV-${t6.order.id},Data.PaymentId=PAY-${t6.order.id},Data.RefundAmount=5,Data.RefundId=888888,Data.RefundReference=REF-EXTERNAL-2,Data.RefundStatus=Refunded,Event=RefundStatusChanged`;
    const sig6 = crypto.createHmac('sha256', webhookSecret).update(str6).digest('base64');
    
    const whRes2 = await request(app)
      .post('/api/webhook/myfatoorah')
      .set('myfatoorah-signature', sig6)
      .send(payload6);
      
    assert(whRes2.status === 200, 'Valid webhook for known payment accepted');
    const { rows: extRefunds } = await pool.query('SELECT * FROM refunds WHERE provider_refund_id = $1', ['888888']);
    assert(extRefunds.length === 1, 'Unknown external refund safely recorded in DB');
    assert(extRefunds[0].reason === 'External Webhook / Unknown Local Origin', 'External origin correctly flagged');

    // ---------------------------------------------------------
    // 7. PAYMENT / ORDER OWNERSHIP
    // ---------------------------------------------------------
    console.log('\n--- 7. OWNERSHIP TESTS ---');
    const t7a = await createTestOrderAndPayment('10.000');
    const t7b = await createTestOrderAndPayment('20.000');
    try {
      await requestRefund({ orderId: t7a.order.id, paymentId: t7b.payment.id, amount: 5, reason: 'Ownership mismatch' });
      assert(false, 'Should block cross-order payment usage');
    } catch (err) {
      assert(err.message === 'PAYMENT_NOT_FOUND_OR_OWNERSHIP_MISMATCH', 'Cross-order payment usage blocked natively');
    }

    console.log('\n--- TESTS COMPLETE ---');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
  } catch (err) {
    console.error('Fatal Test Error:', err);
  } finally {
    pool.end();
  }
}

runTests();
