require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const request = require('supertest');
const { pool } = require('./backend/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import services and routers
const myfatoorah = require('./backend/services/myfatoorah');
const { requestRefund } = require('./backend/services/refund-service');
const { changeOrderStatus } = require('./backend/services/order-service');
const deliveryService = require('./backend/services/delivery-service');

const healthRouter = require('./backend/routes/health');
const checkoutRouter = require('./backend/routes/checkout');
const paymentRouter = require('./backend/routes/payment');
const webhookRouter = require('./backend/routes/webhook');
const adminAuthRouter = require('./backend/routes/admin-auth');
const adminOrdersRouter = require('./backend/routes/admin-orders');
const adminDriversRouter = require('./backend/routes/admin-drivers');
const adminRefundsRouter = require('./backend/routes/admin-refunds');
const driverAuthRouter = require('./backend/routes/driver-auth');
const driverOrdersRouter = require('./backend/routes/driver-orders');
const { requireAdminAuth } = require('./backend/middleware/admin-auth');

// Build test express app
const app = express();
app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin/orders', requireAdminAuth, adminOrdersRouter);
app.use('/api/admin/drivers', adminDriversRouter);
app.use('/api/admin', adminRefundsRouter);
app.use('/api/driver/auth', driverAuthRouter);
app.use('/api/driver/orders', driverOrdersRouter);

async function runTargetedTests() {
  console.log('====================================================');
  console.log('STARTING TARGETED VERIFICATION: F-001, F-002, F-003/F-004');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, evidence = '') {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName} | ${evidence}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${testName} | ${evidence}`);
    }
  }

  // 1. Admin login & token setup
  const adminLoginRes = await request(app)
    .post('/api/admin/auth/login')
    .send({ email: 'admin@mikyaj.com', password: 'admin_password_123' });

  assert(adminLoginRes.status === 200, 'Admin login succeeds', `Status: ${adminLoginRes.status}`);
  const adminLoginData = adminLoginRes.body;
  const adminToken = adminLoginData.token;
  const decodedAdmin = jwt.decode(adminToken);

  function computeSignature(payload, secret) {
    function flattenObj(obj, prefix = '') {
      let result = {};
      for (const key in obj) {
        const val = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (val === '' || Array.isArray(val)) continue;
        if (val === null) { result[newKey] = ''; continue; }
        if (typeof val === 'object') {
          result = { ...result, ...flattenObj(val, newKey) };
        } else {
          result[newKey] = val;
        }
      }
      return result;
    }
    const flat = flattenObj(payload);
    const sortedKeys = Object.keys(flat).sort();
    const stringToSign = sortedKeys.map(k => `${k}=${flat[k]}`).join(',');
    return crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
  }
  const actualAdminId = decodedAdmin.id;
  assert(actualAdminId > 0, 'Admin token contains valid DB admin id', `Admin ID: ${actualAdminId}`);

  // Driver token for role rejection
  const driverToken = jwt.sign({ id: 9999, role: 'DRIVER', email: 'driver@test.com' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '1h' });
  const invalidToken = 'invalid.jwt.token';

  // =========================================================================
  // FINDING F-001: ADMIN REFUND AUTHORIZATION CONTEXT BUG
  // =========================================================================
  console.log('\n--- FINDING F-001: ADMIN REFUND AUTHORIZATION CONTEXT TESTS ---');

  // Create an eligible order and payment
  const orderNum1 = 'F001-ORD-' + Date.now();
  const { rows: o1Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Admin Auth Test', 'auth@test.com', '5551234', 'Kuwait City', 45.000, 'CONFIRMED')
    RETURNING id, order_number
  `, [orderNum1]);
  const o1 = o1Rows[0];

  const { rows: p1Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, provider_payment_id, status, amount, currency)
    VALUES ($1, 'INV-AUTH-1', 'PAY-AUTH-1', 'SUCCESS', 45.000, 'KWD')
    RETURNING id
  `, [o1.id]);
  const p1 = p1Rows[0];

  // Test: Unauthenticated request rejected (no token) -> 401
  const unauthRes = await request(app)
    .post(`/api/admin/orders/${orderNum1}/refunds`)
    .send({ payment_id: p1.id, amount: 10.000, reason: 'Test Auth' });
  assert(unauthRes.status === 401, 'F-001: Unauthenticated request rejected (no token)', `Status: ${unauthRes.status}`);

  // Test: Invalid token rejected -> 401
  const invalidTokenRes = await request(app)
    .post(`/api/admin/orders/${orderNum1}/refunds`)
    .set('Authorization', `Bearer ${invalidToken}`)
    .send({ payment_id: p1.id, amount: 10.000, reason: 'Test Auth' });
  assert(invalidTokenRes.status === 401, 'F-001: Invalid token rejected (401)', `Status: ${invalidTokenRes.status}`);

  // Test: Non-admin (DRIVER) token rejected -> 403
  const nonAdminRes = await request(app)
    .post(`/api/admin/orders/${orderNum1}/refunds`)
    .set('Authorization', `Bearer ${driverToken}`)
    .send({ payment_id: p1.id, amount: 10.000, reason: 'Test Auth' });
  assert(nonAdminRes.status === 403, 'F-001: Non-admin (DRIVER) token rejected (403)', `Status: ${nonAdminRes.status}`);

  // Mock makeRefund for the authenticated route call
  const origMakeRefund = myfatoorah.makeRefund;
  myfatoorah.makeRefund = async function() {
    return { RefundId: 888123, RefundReference: 'REF-ROUTE-1', RefundStatus: 'REFUNDED' };
  };

  // Test: Authenticated refund creation with valid admin token -> 200
  const authRefundRes = await request(app)
    .post(`/api/admin/orders/${orderNum1}/refunds`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      payment_id: p1.id,
      amount: 15.000,
      reason: 'Customer requested cancellation of item',
      idempotency_key: 'idem-f001-' + Date.now()
    });
  assert(authRefundRes.status === 200 && authRefundRes.body.success, 'F-001: Authenticated refund creation succeeds (200)', `Status: ${authRefundRes.status}`);

  // Verify in database: requested_by_admin_id populated with actual admin ID (from req.admin.id)
  const { rows: refundCheck } = await pool.query(
    'SELECT id, requested_by_admin_id, order_id, payment_id, amount, status FROM refunds WHERE id = $1',
    [authRefundRes.body.refund.id]
  );
  const createdRefund = refundCheck[0];
  assert(
    createdRefund && createdRefund.requested_by_admin_id === actualAdminId,
    'F-001: requested_by_admin_id populated with authenticated admin DB ID',
    `DB requested_by_admin_id: ${createdRefund.requested_by_admin_id} === actualAdminId: ${actualAdminId}`
  );

  // Test: Database FK integrity preserved against admin_users(id)
  const { rows: adminUserCheck } = await pool.query(
    'SELECT email FROM admin_users WHERE id = $1',
    [createdRefund.requested_by_admin_id]
  );
  assert(adminUserCheck.length > 0, 'F-001: Database FK integrity verified against admin_users', `Admin email: ${adminUserCheck[0].email}`);

  // Test: Refund ownership preserved (cannot refund payment belonging to another order)
  const otherOrderNum = 'F001-OTHER-' + Date.now();
  await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Other Order', 'other@test.com', '5551234', 'Kuwait City', 10.000, 'CONFIRMED')
  `, [otherOrderNum]);
  const crossRefundRes = await request(app)
    .post(`/api/admin/orders/${otherOrderNum}/refunds`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ payment_id: p1.id, amount: 5.000, reason: 'Cross order mismatch attempt' });
  assert(crossRefundRes.status === 400 || crossRefundRes.status === 404, 'F-001: Refund ownership preserved across orders', `Status: ${crossRefundRes.status}`);

  // =========================================================================
  // FINDING F-003 / F-004: PAID VS CONFIRMED ORDER STATE INCONSISTENCY
  // =========================================================================
  console.log('\n--- FINDING F-003 / F-004: ORDER STATUS TRANSITION (CONFIRMED) TESTS ---');

  const origGetPaymentStatus = myfatoorah.getPaymentStatus;

  // Test 1: Verified successful callback transitions order to CONFIRMED and payment to SUCCESS
  const orderNum2 = 'F003-ORD-' + Date.now();
  const { rows: o2Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Callback Success', 'cb@test.com', '5551234', 'Kuwait City', 25.500, 'PENDING_PAYMENT')
    RETURNING id, order_number
  `, [orderNum2]);
  const o2 = o2Rows[0];

  const invoiceId2 = String(Math.floor(Date.now() / 1000) + 10);
  const mockPaymentId2 = 'PAY-CB-' + Date.now();
  const { rows: p2Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, status, amount, currency)
    VALUES ($1, $2, 'PENDING', 25.500, 'KWD')
    RETURNING id
  `, [o2.id, invoiceId2]);
  const p2 = p2Rows[0];

  myfatoorah.getPaymentStatus = async function(key, keyType) {
    return {
      InvoiceId: invoiceId2,
      InvoiceStatus: 'Paid',
      InvoiceReference: 'REF-' + key,
      InvoiceValue: '25.500',
      InvoiceDisplayValue: '25.500',
      InvoiceTransactions: [{
        PaymentId: key,
        TransactionStatus: 'Succss',
        TransationValue: '25.500'
      }],
      CustomerReference: orderNum2
    };
  };

  // Perform callback request
  const cbRes = await request(app)
    .get(`/api/payment/callback?paymentId=${mockPaymentId2}`);
  assert(cbRes.status === 302, 'F-003/F-004: Payment callback redirects 302', `Location: ${cbRes.headers.location}`);

  // Verify in database: payment.status = SUCCESS, order.status = CONFIRMED
  const { rows: orderCheck2 } = await pool.query('SELECT status FROM orders WHERE id = $1', [o2.id]);
  const { rows: payCheck2 } = await pool.query('SELECT status FROM payments WHERE id = $1', [p2.id]);
  assert(payCheck2[0].status === 'SUCCESS', 'F-003/F-004: payment.status = SUCCESS after verified payment', `Status: ${payCheck2[0].status}`);
  assert(orderCheck2[0].status === 'CONFIRMED', 'F-003/F-004: order.status = CONFIRMED (not PAID)', `Status: ${orderCheck2[0].status}`);

  // Test 2: Callback replay safety (idempotent callback maintains CONFIRMED / SUCCESS)
  const cbReplayRes = await request(app)
    .get(`/api/payment/callback?paymentId=${mockPaymentId2}`);
  assert(cbReplayRes.status === 302, 'F-003/F-004: Callback replay returns 302', `Status: ${cbReplayRes.status}`);
  const { rows: orderCheck2Replay } = await pool.query('SELECT status FROM orders WHERE id = $1', [o2.id]);
  const { rows: payCheck2Replay } = await pool.query('SELECT status FROM payments WHERE id = $1', [p2.id]);
  assert(orderCheck2Replay[0].status === 'CONFIRMED' && payCheck2Replay[0].status === 'SUCCESS', 'F-003/F-004: Callback replay safe (retains CONFIRMED and SUCCESS)', `Order: ${orderCheck2Replay[0].status}, Payment: ${payCheck2Replay[0].status}`);

  // Test 3: Verified successful webhook transitions order to CONFIRMED and payment to SUCCESS
  const orderNum3 = 'F003-WH-' + Date.now();
  const { rows: o3Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Webhook Success', 'wh@test.com', '5551234', 'Kuwait City', 30.000, 'PENDING_PAYMENT')
    RETURNING id, order_number
  `, [orderNum3]);
  const o3 = o3Rows[0];

  const invoiceId3 = String(Math.floor(Date.now() / 1000) + 20);
  const mockPaymentId3 = 'PAY-WH-' + Date.now();
  const { rows: p3Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, status, amount, currency)
    VALUES ($1, $2, 'PENDING', 30.000, 'KWD')
    RETURNING id
  `, [o3.id, invoiceId3]);
  const p3 = p3Rows[0];

  myfatoorah.getPaymentStatus = async function(key, keyType) {
    return {
      InvoiceId: invoiceId3,
      InvoiceStatus: 'Paid',
      InvoiceReference: 'REF-' + key,
      InvoiceValue: '30.000',
      InvoiceDisplayValue: '30.000',
      InvoiceTransactions: [{
        PaymentId: key,
        TransactionStatus: 'Succss',
        TransationValue: '30.000'
      }],
      CustomerReference: orderNum3
    };
  };

  const webhookSecret = process.env.MYFATOORAH_WEBHOOK_SECRET || 'test-secret';
  const webhookBody = {
    Event: 'TransactionsStatusChanged',
    DateTime: new Date().toISOString(),
    Data: {
      PaymentId: mockPaymentId3,
      InvoiceId: parseInt(invoiceId3, 10),
      InvoiceReference: 'REF-' + mockPaymentId3,
      CustomerReference: orderNum3
    }
  };
  const bodyString = JSON.stringify(webhookBody);
  const signature = computeSignature(webhookBody, webhookSecret);

  const whRes = await request(app)
    .post('/api/webhook/myfatoorah')
    .set('Content-Type', 'application/json')
    .set('MyFatoorah-Signature', signature)
    .send(bodyString);
  assert(whRes.status === 200, 'F-003/F-004: Webhook returns 200', `Status: ${whRes.status}`);

  const { rows: orderCheck3 } = await pool.query('SELECT status FROM orders WHERE id = $1', [o3.id]);
  const { rows: payCheck3 } = await pool.query('SELECT status FROM payments WHERE id = $1', [p3.id]);
  assert(payCheck3[0].status === 'SUCCESS', 'F-003/F-004: Webhook sets payment.status = SUCCESS', `Status: ${payCheck3[0].status}`);
  assert(orderCheck3[0].status === 'CONFIRMED', 'F-003/F-004: Webhook sets order.status = CONFIRMED (not PAID)', `Status: ${orderCheck3[0].status}`);

  // Test 4: Webhook replay safety
  const whReplayRes = await request(app)
    .post('/api/webhook/myfatoorah')
    .set('Content-Type', 'application/json')
    .set('MyFatoorah-Signature', signature)
    .send(bodyString);
  assert(whReplayRes.status === 200, 'F-003/F-004: Webhook replay returns 200', `Status: ${whReplayRes.status}`);
  const { rows: orderCheck3Replay } = await pool.query('SELECT status FROM orders WHERE id = $1', [o3.id]);
  assert(orderCheck3Replay[0].status === 'CONFIRMED', 'F-003/F-004: Webhook replay safe (retains CONFIRMED)', `Status: ${orderCheck3Replay[0].status}`);

  // Test 5: Callback + Webhook race safe (concurrent processing)
  const orderNumRace = 'F003-RACE-' + Date.now();
  const { rows: oRaceRows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Race Test', 'race@test.com', '5551234', 'Kuwait City', 40.000, 'PENDING_PAYMENT')
    RETURNING id, order_number
  `, [orderNumRace]);
  const oRace = oRaceRows[0];

  const invoiceIdRace = String(Math.floor(Date.now() / 1000) + 30);
  const mockPaymentIdRace = 'PAY-RACE-' + Date.now();
  const { rows: pRaceRows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, status, amount, currency)
    VALUES ($1, $2, 'PENDING', 40.000, 'KWD')
    RETURNING id
  `, [oRace.id, invoiceIdRace]);

  myfatoorah.getPaymentStatus = async function(key) {
    return {
      InvoiceId: invoiceIdRace,
      InvoiceStatus: 'Paid',
      InvoiceReference: 'REF-' + key,
      InvoiceValue: '40.000',
      InvoiceTransactions: [{ PaymentId: key, TransactionStatus: 'Succss', TransationValue: '40.000' }],
      CustomerReference: orderNumRace
    };
  };

  const raceWebhookBody = {
    Event: 'TransactionsStatusChanged',
    DateTime: new Date().toISOString(),
    Data: { PaymentId: mockPaymentIdRace, InvoiceId: parseInt(invoiceIdRace, 10), CustomerReference: orderNumRace }
  };
  const raceBodyString = JSON.stringify(raceWebhookBody);
  const raceSig = computeSignature(raceWebhookBody, webhookSecret);

  const [raceCb, raceWh] = await Promise.all([
    request(app).get(`/api/payment/callback?paymentId=${mockPaymentIdRace}`),
    request(app).post('/api/webhook/myfatoorah').set('Content-Type', 'application/json').set('MyFatoorah-Signature', raceSig).send(raceBodyString)
  ]);
  const { rows: orderCheckRace } = await pool.query('SELECT status FROM orders WHERE id = $1', [oRace.id]);
  const { rows: payCheckRace } = await pool.query('SELECT status FROM payments WHERE id = $1', [pRaceRows[0].id]);
  assert(orderCheckRace[0].status === 'CONFIRMED' && payCheckRace[0].status === 'SUCCESS', 'F-003/F-004: Callback + Webhook race safe (row locks resolve cleanly)', `Order: ${orderCheckRace[0].status}, Payment: ${payCheckRace[0].status}`);

  // Test 6: Amount mismatch does not confirm order
  const orderNum4 = 'F003-MISMATCH-' + Date.now();
  const { rows: o4Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Mismatch Test', 'mm@test.com', '5551234', 'Kuwait City', 50.000, 'PENDING_PAYMENT')
    RETURNING id, order_number
  `, [orderNum4]);
  const o4 = o4Rows[0];
  const invoiceId4 = String(Math.floor(Date.now() / 1000) + 40);
  const mockPaymentId4 = 'PAY-MM-' + Date.now();
  const { rows: p4Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, status, amount, currency)
    VALUES ($1, $2, 'PENDING', 50.000, 'KWD')
    RETURNING id
  `, [o4.id, invoiceId4]);
  const p4 = p4Rows[0];

  myfatoorah.getPaymentStatus = async function() {
    return {
      InvoiceId: invoiceId4,
      InvoiceStatus: 'Paid',
      InvoiceValue: '10.000', // Expected 50.000, got 10.000!
      InvoiceDisplayValue: '10.000',
      InvoiceTransactions: [{ PaymentId: mockPaymentId4, TransactionStatus: 'Succss', TransationValue: '10.000' }],
      CustomerReference: orderNum4
    };
  };

  await request(app).get(`/api/payment/callback?paymentId=${mockPaymentId4}`);
  const { rows: orderCheck4 } = await pool.query('SELECT status FROM orders WHERE id = $1', [o4.id]);
  const { rows: payCheck4 } = await pool.query('SELECT status FROM payments WHERE id = $1', [p4.id]);
  assert(payCheck4[0].status === 'AMOUNT_MISMATCH', 'F-003/F-004: Amount mismatch sets payment.status = AMOUNT_MISMATCH', `Status: ${payCheck4[0].status}`);
  assert(orderCheck4[0].status === 'PENDING_PAYMENT', 'F-003/F-004: Amount mismatch leaves order in PENDING_PAYMENT', `Status: ${orderCheck4[0].status}`);

  // Test 7: Failed payment leaves order in PENDING_PAYMENT
  const orderNum5 = 'F003-FAILED-' + Date.now();
  const { rows: o5Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'Failed Test', 'fail@test.com', '5551234', 'Kuwait City', 15.000, 'PENDING_PAYMENT')
    RETURNING id, order_number
  `, [orderNum5]);
  const o5 = o5Rows[0];
  const invoiceId5 = String(Math.floor(Date.now() / 1000) + 50);
  const mockPaymentId5 = 'PAY-FAIL-' + Date.now();
  const { rows: p5Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, status, amount, currency)
    VALUES ($1, $2, 'PENDING', 15.000, 'KWD')
    RETURNING id
  `, [o5.id, invoiceId5]);
  const p5 = p5Rows[0];

  myfatoorah.getPaymentStatus = async function() {
    return {
      InvoiceId: invoiceId5,
      InvoiceStatus: 'Failed',
      InvoiceValue: '15.000',
      InvoiceTransactions: [{ PaymentId: mockPaymentId5, TransactionStatus: 'Failed' }],
      CustomerReference: orderNum5
    };
  };

  await request(app).get(`/api/payment/callback?paymentId=${mockPaymentId5}`);
  const { rows: orderCheck5 } = await pool.query('SELECT status FROM orders WHERE id = $1', [o5.id]);
  const { rows: payCheck5 } = await pool.query('SELECT status FROM payments WHERE id = $1', [p5.id]);
  assert(payCheck5[0].status === 'FAILED', 'F-003/F-004: Failed payment sets payment.status = FAILED', `Status: ${payCheck5[0].status}`);
  assert(orderCheck5[0].status === 'PENDING_PAYMENT', 'F-003/F-004: Failed payment leaves order in PENDING_PAYMENT', `Status: ${orderCheck5[0].status}`);

  // Test 8: Operational transition: Admin can move CONFIRMED -> PROCESSING
  const patchProcRes = await request(app)
    .patch(`/api/admin/orders/${orderNum2}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'PROCESSING', reason: 'Order verified and sent to fulfillment warehouse' });
  assert(patchProcRes.status === 200 && patchProcRes.body.status === 'PROCESSING', 'F-003/F-004: Operational transition: CONFIRMED -> PROCESSING succeeds', `Status: ${patchProcRes.status}`);

  // Test 9: Operational transition: Admin can move PROCESSING -> READY_FOR_DELIVERY
  const patchReadyRes = await request(app)
    .patch(`/api/admin/orders/${orderNum2}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'READY_FOR_DELIVERY', reason: 'Packaging complete, ready for driver assignment' });
  assert(patchReadyRes.status === 200 && patchReadyRes.body.status === 'READY_FOR_DELIVERY', 'F-003/F-004: Operational transition: PROCESSING -> READY_FOR_DELIVERY succeeds', `Status: ${patchReadyRes.status}`);

  // Test 10: Driver assignment workflow functional on READY_FOR_DELIVERY
  const { rows: driverRows } = await pool.query("SELECT id FROM drivers WHERE status = 'ACTIVE' LIMIT 1");
  const testDriverId = driverRows[0].id;

  const assignRes = await request(app)
    .post(`/api/admin/orders/${orderNum2}/assign-driver`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ driver_id: testDriverId, notes: 'Fragile cosmetics' });
  assert(assignRes.status === 200, 'F-003/F-004: Driver assignment functional on order transitioned to READY_FOR_DELIVERY', `Status: ${assignRes.status}`);

  // Test 11: Driver delivery workflow remains fully functional
  const driverLoginRes = await request(app)
    .post('/api/driver/auth/login')
    .send({ email: 'driverA@test.com', password: 'password123' });
  const dToken = driverLoginRes.body.token || jwt.sign({ id: testDriverId, role: 'DRIVER', email: 'driver@test.com' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '1h' });

  // Start Delivery
  const startDelivRes = await request(app)
    .post(`/api/driver/orders/${orderNum2}/start-delivery`)
    .set('Authorization', `Bearer ${dToken}`);
  assert(startDelivRes.status === 200, 'F-003/F-004: Driver can start delivery (OUT_FOR_DELIVERY)', `Status: ${startDelivRes.status}`);

  // Mark Delivered
  const markDelivRes = await request(app)
    .post(`/api/driver/orders/${orderNum2}/mark-delivered`)
    .set('Authorization', `Bearer ${dToken}`);
  assert(markDelivRes.status === 200, 'F-003/F-004: Driver can mark delivered (DELIVERED)', `Status: ${markDelivRes.status}`);

  // Test 12: Public safe status route (/api/payment/status/:orderNumber) returns CONFIRMED
  const pubStatusRes = await request(app).get(`/api/payment/status/${orderNum3}`);
  assert(pubStatusRes.status === 200 && pubStatusRes.body.status === 'CONFIRMED', 'F-003/F-004: Public payment status route returns CONFIRMED', `Status: ${pubStatusRes.body.status}`);

  myfatoorah.getPaymentStatus = origGetPaymentStatus;

  // =========================================================================
  // FINDING F-002: DOUBLE client.release() IN REFUND SERVICE
  // =========================================================================
  console.log('\n--- FINDING F-002: DATABASE CLIENT RELEASE & TRANSACTION LIFECYCLE TESTS ---');

  // Monitor stderr for "Release called on client which has already been released"
  let doubleReleaseDetected = false;
  let doubleReleaseMessage = '';
  const originalStderrWrite = process.stderr.write;
  process.stderr.write = function(chunk) {
    const str = chunk.toString();
    if (str.includes('Release called on client which has already been released')) {
      doubleReleaseDetected = true;
      doubleReleaseMessage = str;
    }
    return originalStderrWrite.apply(process.stderr, arguments);
  };

  myfatoorah.makeRefund = async function() {
    return { RefundId: 999001, RefundReference: 'REF-F002-1', RefundStatus: 'REFUNDED' };
  };

  const { rows: oF2Rows } = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
    VALUES ($1, 'F002 Order', 'f002@test.com', '5551234', 'Kuwait City', 100.000, 'CONFIRMED')
    RETURNING id, order_number
  `, ['F002-ORD-' + Date.now()]);
  const oF2 = oF2Rows[0];

  const { rows: pF2Rows } = await pool.query(`
    INSERT INTO payments (order_id, provider_invoice_id, provider_payment_id, status, amount, currency)
    VALUES ($1, 'INV-F002-1', 'PAY-F002-1', 'SUCCESS', 100.000, 'KWD')
    RETURNING id
  `, [oF2.id]);
  const pF2 = pF2Rows[0];

  // Test 1: Successful refund: clean release
  const ref1 = await requestRefund({
    orderId: oF2.id,
    paymentId: pF2.id,
    amount: 20.000,
    reason: 'F002 Test Partial',
    adminId: actualAdminId,
    idempotencyKey: 'idem-f002-p1-' + Date.now()
  });
  assert(ref1 && ref1.status === 'REFUNDED', 'F-002: Successful refund completed cleanly', `Status: ${ref1.status}`);
  assert(!doubleReleaseDetected, 'F-002: No double release on successful refund', `Double release detected: ${doubleReleaseDetected}`);

  // Test 2: Idempotent refund retry: early return with client.release() in finally
  const idemKeyF002 = 'idem-f002-retry-' + Date.now();
  const ref2a = await requestRefund({
    orderId: oF2.id,
    paymentId: pF2.id,
    amount: 15.000,
    reason: 'F002 Test Idempotency Retry',
    adminId: actualAdminId,
    idempotencyKey: idemKeyF002
  });
  const ref2b = await requestRefund({
    orderId: oF2.id,
    paymentId: pF2.id,
    amount: 15.000,
    reason: 'F002 Test Idempotency Retry',
    adminId: actualAdminId,
    idempotencyKey: idemKeyF002
  });
  assert(ref2a.id === ref2b.id, 'F-002: Early idempotency return works cleanly and matches ID', `ID: ${ref2a.id} === ${ref2b.id}`);
  assert(!doubleReleaseDetected, 'F-002: No double release on idempotency retry', `Double release detected: ${doubleReleaseDetected}`);

  // Test 3: Provider error behaviour preserved with clean release
  myfatoorah.makeRefund = async function() {
    throw new Error('ETIMEDOUT: Connection timed out to provider gateway');
  };
  const ref3 = await requestRefund({
    orderId: oF2.id,
    paymentId: pF2.id,
    amount: 10.000,
    reason: 'F002 Provider Error Test',
    adminId: actualAdminId,
    idempotencyKey: 'idem-f002-timeout-' + Date.now()
  });
  assert(ref3 && ref3.status === 'PROVIDER_ERROR', 'F-002: Provider error behaviour preserved (status = PROVIDER_ERROR)', `Status: ${ref3.status}`);
  assert(!doubleReleaseDetected, 'F-002: No double release on provider error', `Double release detected: ${doubleReleaseDetected}`);

  // Test 4: Transaction rollback on amount exceeding remaining balance
  let rollbackCaught = false;
  try {
    await requestRefund({
      orderId: oF2.id,
      paymentId: pF2.id,
      amount: 999.000, // Exceeds balance!
      reason: 'Excessive amount',
      adminId: actualAdminId
    });
  } catch (err) {
    rollbackCaught = err.message === 'AMOUNT_EXCEEDS_REMAINING_BALANCE';
  }
  assert(rollbackCaught, 'F-002: Transaction rollback on amount exceeding remaining balance', `Caught: ${rollbackCaught}`);
  assert(!doubleReleaseDetected, 'F-002: No double release on rollback', `Double release detected: ${doubleReleaseDetected}`);

  // Test 5: Concurrent refund safety with connection pool
  myfatoorah.makeRefund = async function() {
    return { RefundId: 999002, RefundReference: 'REF-CONCURRENT', RefundStatus: 'REFUNDED' };
  };
  const concurrentResults = await Promise.allSettled([
    requestRefund({ orderId: oF2.id, paymentId: pF2.id, amount: 20.000, reason: 'Concurrent A', adminId: actualAdminId }),
    requestRefund({ orderId: oF2.id, paymentId: pF2.id, amount: 20.000, reason: 'Concurrent B', adminId: actualAdminId })
  ]);
  const successfulConcurrent = concurrentResults.filter(r => r.status === 'fulfilled');
  assert(successfulConcurrent.length > 0, 'F-002: Concurrent refunds execute without deadlock or pool exhaustion', `Success count: ${successfulConcurrent.length}`);
  assert(!doubleReleaseDetected, 'F-002: No double release on concurrent executions', `Double release detected: ${doubleReleaseDetected}`);

  process.stderr.write = originalStderrWrite;
  myfatoorah.makeRefund = origMakeRefund;

  // =========================================================================
  // DATABASE VERIFICATION
  // =========================================================================
  console.log('\n--- DATABASE INTEGRITY VERIFICATION ---');

  // Check 1: No orphan records in payments
  const { rows: orphanPayments } = await pool.query(`
    SELECT p.id FROM payments p LEFT JOIN orders o ON p.order_id = o.id WHERE o.id IS NULL
  `);
  assert(orphanPayments.length === 0, 'Database: No orphan payments', `Count: ${orphanPayments.length}`);

  // Check 2: No orphan records in refunds
  const { rows: orphanRefunds } = await pool.query(`
    SELECT r.id FROM refunds r LEFT JOIN orders o ON r.order_id = o.id LEFT JOIN payments p ON r.payment_id = p.id WHERE o.id IS NULL OR p.id IS NULL
  `);
  assert(orphanRefunds.length === 0, 'Database: No orphan refunds', `Count: ${orphanRefunds.length}`);

  // Check 3: No invalid order statuses
  const { rows: invalidOrderStatuses } = await pool.query(`
    SELECT DISTINCT status FROM orders WHERE status NOT IN ('PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')
  `);
  assert(invalidOrderStatuses.length === 0, 'Database: No invalid order statuses in DB', `Invalid statuses: ${invalidOrderStatuses.map(r => r.status).join(', ') || 'None'}`);

  // Check 4: No refund total > payment amount for any completed refund
  const { rows: overRefundedPayments } = await pool.query(`
    SELECT p.id, p.amount, SUM(r.amount) AS total_refunded
    FROM payments p
    JOIN refunds r ON p.id = r.payment_id
    WHERE r.status IN ('REFUNDED', 'COMPLETED')
    GROUP BY p.id, p.amount
    HAVING SUM(r.amount) > p.amount + 0.001
  `);
  assert(overRefundedPayments.length === 0, 'Database: No refund total > payment amount', `Violating payments: ${overRefundedPayments.length}`);

  // Check 5: requested_by_admin_id correctly populated for admin refunds
  const { rows: unpopulatedAdminRefunds } = await pool.query(`
    SELECT id, requested_by_admin_id FROM refunds WHERE requested_by_admin_id IS NULL AND reason LIKE '%Customer requested%'
  `);
  assert(unpopulatedAdminRefunds.length === 0, 'Database: requested_by_admin_id correctly populated on admin created refunds', `Unpopulated count: ${unpopulatedAdminRefunds.length}`);

  // Check 6: order_status_history consistency
  const { rows: statusHistoryOrphans } = await pool.query(`
    SELECT osh.id FROM order_status_history osh LEFT JOIN orders o ON osh.order_id = o.id WHERE o.id IS NULL
  `);
  assert(statusHistoryOrphans.length === 0, 'Database: No orphan status history records', `Count: ${statusHistoryOrphans.length}`);

  // =========================================================================
  // SECURITY REGRESSION
  // =========================================================================
  console.log('\n--- SECURITY REGRESSION VERIFICATION ---');

  // Sec 1: No secrets exposed in responses
  assert(adminLoginData.token && !adminLoginData.password_hash, 'Security: Admin login returns JWT without password_hash', 'Safe');

  // Sec 2: Webhook signature enforcement
  const invalidSigRes = await request(app)
    .post('/api/webhook/myfatoorah')
    .set('Content-Type', 'application/json')
    .set('MyFatoorah-Signature', 'bad-sig')
    .send(JSON.stringify({ Event: 'TransactionsStatusChanged', Data: { InvoiceId: 1 } }));
  assert(invalidSigRes.status === 403, 'Security: Webhook rejects invalid HMAC signature (403)', `Status: ${invalidSigRes.status}`);

  // Sec 3: Frontend cannot force order CONFIRMED without server-side verification
  const fakeStatusPatch = await request(app)
    .patch(`/api/admin/orders/${orderNum4}/status`)
    .send({ status: 'CONFIRMED' }); // No admin token
  assert(fakeStatusPatch.status === 401, 'Security: Unauthenticated request cannot force CONFIRMED (401)', `Status: ${fakeStatusPatch.status}`);

  console.log('\n====================================================');
  console.log(`TARGETED TESTING COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTargetedTests().catch(e => {
  console.error('Targeted test execution error:', e);
  process.exit(1);
});
