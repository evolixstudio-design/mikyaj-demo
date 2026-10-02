require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const crypto = require('crypto');
const { pool } = require('./db');

const API_BASE = 'http://localhost:3000/api';
let adminToken = '';
let testAdminId = null;

async function fetchApi(path, options = {}) {
  return new Promise((resolve) => {
    const { method = 'GET', body, token } = options;
    const url = new URL(API_BASE + path);
    const reqOptions = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) reqOptions.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (err) => resolve({ status: 500, body: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Helper to seed a test order
async function seedTestOrder(totalAmount = '10.500', status = 'PENDING_PAYMENT') {
  const orderNumber = 'TEST-ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const res = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, total_amount, currency, status)
    VALUES ($1, 'Test User', '99999999', 'Test Address', $2, 'KWD', $3)
    RETURNING id, order_number
  `, [orderNumber, totalAmount, status]);
  return res.rows[0];
}

async function seedTestOrderItem(orderId, productId = 1, priceAtPurchase = '1.499') {
  await pool.query(`
    INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES ($1, $2, 1, $3)
  `, [orderId, productId, priceAtPurchase]);
}

async function seedTestPayment(orderId, status = 'PENDING') {
  await pool.query(`
    INSERT INTO payments (order_id, status, amount, currency)
    VALUES ($1, $2, 10.500, 'KWD')
  `, [orderId, status]);
}

async function verify() {
  const results = [];
  function runTest(req, file, name, status, evidence, notes = '') {
    results.push({ req, file, name, status, evidence, notes });
  }
  function testAssert(condition, req, file, name, evidence = '', notes = '') {
    runTest(req, file, name, condition ? 'PASS' : 'FAIL', evidence || String(condition), notes);
  }

  console.log('--- STARTING FORENSIC VERIFICATION ---');
  try {
    // 1. AUTHENTICATION
    const noJwt = await fetchApi('/admin/orders');
    testAssert(noJwt.status === 401, 'Auth', 'admin-auth.js', 'No JWT -> 401', noJwt.status);
    
    const invalidJwt = await fetchApi('/admin/orders', { token: 'invalid_token' });
    testAssert(invalidJwt.status === 401, 'Auth', 'admin-auth.js', 'Invalid JWT -> 401', invalidJwt.status);
    
    const login = await fetchApi('/admin/auth/login', { method: 'POST', body: { email: 'admin@mikyaj.com', password: 'admin_password_123' }});
    testAssert(login.status === 200 && login.body.token, 'Auth', 'admin-auth.js', 'Valid ADMIN JWT -> success', login.status);
    adminToken = login.body.token;
    testAdminId = login.body.admin.id;

    const badPass = await fetchApi('/admin/auth/login', { method: 'POST', body: { email: 'admin@mikyaj.com', password: 'wrong' }});
    testAssert(badPass.status === 401, 'Auth', 'admin-auth.js', 'Wrong password -> auth failure', badPass.status);

    const badEmail = await fetchApi('/admin/auth/login', { method: 'POST', body: { email: 'unknown@mikyaj.com', password: 'admin_password_123' }});
    testAssert(badEmail.status === 401, 'Auth', 'admin-auth.js', 'Unknown email -> auth failure', badEmail.status);

    // ADMIN ID SPOOFING
    // Attempting status change with spoofed id
    const spoofOrder = await seedTestOrder();
    const spoofReq = await fetchApi(`/admin/orders/${spoofOrder.order_number}/status`, {
      method: 'PATCH', token: adminToken, body: { status: 'CONFIRMED', admin_id: 999999, changed_by_admin_id: 999999 }
    });
    const histRes = await pool.query('SELECT changed_by_admin_id FROM order_status_history WHERE order_id = $1', [spoofOrder.id]);
    testAssert(histRes.rows[0]?.changed_by_admin_id === testAdminId, 'Auth', 'order-service.js', 'Admin ID Spoofing rejected', 'changed_by_admin_id matches JWT identity');

    // 2. ORDER LIST
    const oList1 = await fetchApi('/admin/orders', { token: adminToken });
    testAssert(oList1.status === 200, 'List', 'admin-orders.js', 'Basic list', oList1.status);
    const oListLim = await fetchApi('/admin/orders?limit=150', { token: adminToken });
    testAssert(oListLim.body.orders && oListLim.body.orders.length <= 100, 'List', 'admin-orders.js', 'Maximum limit enforced', oListLim.body.orders.length);
    const oListNeg = await fetchApi('/admin/orders?limit=-5', { token: adminToken });
    testAssert(oListNeg.status === 200 && oListNeg.body.orders.length <= 20, 'List', 'admin-orders.js', 'Negative limit defaults to 20', oListNeg.body.orders.length);
    const oListCursor = await fetchApi('/admin/orders?cursor=abc', { token: adminToken });
    testAssert(oListCursor.status === 400, 'List', 'admin-orders.js', 'Malformed cursor rejected', oListCursor.status);

    // Filter tests
    const minMaxFail = await fetchApi('/admin/orders?min_total=10&max_total=5', { token: adminToken });
    testAssert(minMaxFail.status === 400, 'List', 'admin-orders.js', 'min_total > max_total', minMaxFail.status);

    // PAYMENT AGGREGATION
    const aggOrder = await seedTestOrder();
    await seedTestPayment(aggOrder.id, 'FAILED');
    await new Promise(r => setTimeout(r, 10)); // assure time diff
    await seedTestPayment(aggOrder.id, 'CANCELLED');
    await new Promise(r => setTimeout(r, 10));
    await seedTestPayment(aggOrder.id, 'PAID');

    const aggList = await fetchApi(`/admin/orders?search=${aggOrder.order_number}`, { token: adminToken });
    testAssert(aggList.body.orders.length === 1, 'Payment', 'admin-orders.js', 'Payment aggregation order deduplication', aggList.body.orders.length);
    testAssert(aggList.body.orders[0].payment_status === 'PAID', 'Payment', 'admin-orders.js', 'Latest payment status determines list status', aggList.body.orders[0].payment_status);

    const aggPays = await fetchApi(`/admin/orders/${aggOrder.order_number}/payments`, { token: adminToken });
    testAssert(aggPays.body.payments.length === 3, 'Payment', 'admin-orders.js', 'Historical payments preserved', aggPays.body.payments.length);

    let detailRes = { body: {} }; // 3. ORDER DETAIL & HISTORICAL PRICE
    const p1 = await pool.query("SELECT id, selling_price FROM products WHERE id = 1");
    if(p1.rows.length) {
       const detailOrder = await seedTestOrder();
       await seedTestOrderItem(detailOrder.id, 1, '1.499'); // historical price is 1.499
       
       detailRes = await fetchApi(`/admin/orders/${detailOrder.order_number}`, { token: adminToken });
       testAssert(detailRes.status === 200, 'Detail', 'admin-orders.js', 'Order detail basic', detailRes.status);
       testAssert(detailRes.body.items[0].price_at_purchase === '1.499', 'Detail', 'admin-orders.js', 'Historical price preserved', detailRes.body.items[0].price_at_purchase);
    }

    // 4. STATUS TRANSITION MATRIX
    const validMap = [
      ['PENDING_PAYMENT', 'CONFIRMED'],
      ['CONFIRMED', 'PROCESSING'],
      ['PROCESSING', 'READY_FOR_DELIVERY'],
      ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'],
      ['OUT_FOR_DELIVERY', 'DELIVERED']
    ];
    let allValid = true;
    for (const [oldS, newS] of validMap) {
      const o = await seedTestOrder('10', oldS);
      const r = await fetchApi(`/admin/orders/${o.order_number}/status`, { method: 'PATCH', token: adminToken, body: { status: newS } });
      if (r.status !== 200) allValid = false;
    }
    testAssert(allValid, 'Status', 'order-service.js', 'All valid transitions succeed', allValid);

    const invalidMap = [
      ['PENDING_PAYMENT', 'PROCESSING'],
      ['CONFIRMED', 'DELIVERED'],
      ['READY_FOR_DELIVERY', 'CONFIRMED'],
      ['DELIVERED', 'PROCESSING'],
      ['DELIVERED', 'CANCELLED'],
      ['CANCELLED', 'CONFIRMED']
    ];
    let allInvalid = true;
    for (const [oldS, newS] of invalidMap) {
      const o = await seedTestOrder('10', oldS);
      const r = await fetchApi(`/admin/orders/${o.order_number}/status`, { method: 'PATCH', token: adminToken, body: { status: newS } });
      if (r.status !== 409 && r.status !== 400) allInvalid = false; // must reject
    }
    testAssert(allInvalid, 'Status', 'order-service.js', 'Invalid transitions rejected', allInvalid);

    // 5. CANCELLATION
    const canO = await seedTestOrder();
    const canNoR = await fetchApi(`/admin/orders/${canO.order_number}/cancel`, { method: 'POST', token: adminToken, body: {} });
    testAssert(canNoR.status === 400, 'Cancel', 'order-service.js', 'Cancellation reason required', canNoR.status);
    
    const canEmptyR = await fetchApi(`/admin/orders/${canO.order_number}/cancel`, { method: 'POST', token: adminToken, body: { reason: '   ' } });
    testAssert(canEmptyR.status === 400, 'Cancel', 'order-service.js', 'Whitespace reason rejected', canEmptyR.status);

    const canOk = await fetchApi(`/admin/orders/${canO.order_number}/cancel`, { method: 'POST', token: adminToken, body: { reason: 'valid reason' } });
    testAssert(canOk.status === 200, 'Cancel', 'order-service.js', 'Valid cancellation succeeds', canOk.status);

    const delO = await seedTestOrder('10', 'DELIVERED');
    const delCan = await fetchApi(`/admin/orders/${delO.order_number}/cancel`, { method: 'POST', token: adminToken, body: { reason: 'try cancel delivered' } });
    testAssert(delCan.status === 409, 'Cancel', 'order-service.js', 'DELIVERED cannot be cancelled', delCan.status);

    // 6. HISTORY VERIFICATION
    const histResAPI = await fetchApi(`/admin/orders/${canO.order_number}/history`, { token: adminToken });
    testAssert(histResAPI.body.history.length === 1 && histResAPI.body.history[0].reason === 'valid reason', 'History', 'admin-orders.js', 'Exactly one history row with reason', histResAPI.body.history.length);

    // 7. CONCURRENCY
    const concO = await seedTestOrder('10', 'PROCESSING');
    const req1 = fetchApi(`/admin/orders/${concO.order_number}/status`, { method: 'PATCH', token: adminToken, body: { status: 'READY_FOR_DELIVERY' } });
    const req2 = fetchApi(`/admin/orders/${concO.order_number}/status`, { method: 'PATCH', token: adminToken, body: { status: 'READY_FOR_DELIVERY' } });
    const [res1, res2] = await Promise.all([req1, req2]);
    const succCnt = (res1.status === 200 ? 1 : 0) + (res2.status === 200 ? 1 : 0);
    // Since it's idempotent, both might return 200 but only 1 history row should exist!
    const concHist = await pool.query('SELECT id FROM order_status_history WHERE order_id = $1', [concO.id]);
    testAssert(concHist.rows.length === 1, 'Concurrency', 'order-service.js', 'Simultaneous requests yield 1 history row', concHist.rows.length);

    // 8. SQL INJECTION
    const sqlInj = await fetchApi(`/admin/orders?search=' OR 1=1 --`, { token: adminToken });
    testAssert(sqlInj.status === 200, 'Security', 'admin-orders.js', 'SQL injection safely handled', sqlInj.status);

    // 9. LEAKAGE
    const leakCheck = JSON.stringify(aggList.body) + JSON.stringify(detailRes.body);
    testAssert(!leakCheck.includes('password') && !leakCheck.includes('super_secret'), 'Security', 'admin-orders.js', 'No secrets leaked in API response', leakCheck.includes('password'));

    // 10. CHECKOUT REGRESSION
    const chkRes = await fetchApi('/checkout', {
      method: 'POST',
      body: { idempotencyKey: 'verif-key-1', customer: { name:'v',phone:'99999999',address:'v' }, items: [{productId: 1, qty: 1}] }
    });
    testAssert(chkRes.status === 201 && chkRes.body.success, 'Regression', 'checkout.js', 'Checkout functional', chkRes.status);
    
    // Idempotency
    const chkRes2 = await fetchApi('/checkout', {
      method: 'POST',
      body: { idempotencyKey: 'verif-key-1', customer: { name:'v',phone:'99999999',address:'v' }, items: [{productId: 1, qty: 1}] }
    });
    testAssert(chkRes2.status === 201 && chkRes2.body.success && chkRes2.body.order.id === chkRes.body.order.id, 'Regression', 'checkout.js', 'Checkout idempotency works', chkRes2.status);

    // Customer Regression
    const h = await fetchApi('/health'); testAssert(h.status === 200, 'Regression', 'health.js', 'Health check', h.status);
    const c = await fetchApi('/categories'); testAssert(c.status === 200, 'Regression', 'categories.js', 'Categories', c.status);
    
    // Summary
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`\nVerified: ${passed} PASS, ${failed} FAIL`);

    console.log(JSON.stringify(results));

  } catch (err) {
    console.error('Verification failed', err);
  } finally {
    pool.end();
  }
}
verify();
