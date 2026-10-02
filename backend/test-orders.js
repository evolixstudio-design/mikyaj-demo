require('dotenv').config();
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function fetchApi(path, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body, token } = options;
    const url = new URL(API_BASE + path);

    const reqOptions = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      reqOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING ORDER MANAGEMENT TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Auth tests
    console.log('\n--- AUTHENTICATION ---');
    const { status: authStatus, body: authBody } = await fetchApi('/admin/auth/login', {
      method: 'POST',
      body: { email: 'admin@mikyaj.com', password: 'admin_password_123' }
    });
    assert(authStatus === 200 && authBody.success === true && authBody.token, 'Login successful with valid credentials');
    
    const adminToken = authBody.token;

    const { status: badAuthStatus } = await fetchApi('/admin/auth/login', {
      method: 'POST',
      body: { email: 'admin@mikyaj.com', password: 'wrong' }
    });
    assert(badAuthStatus === 401, 'Login rejected with bad password');

    const { status: noTokenStatus } = await fetchApi('/admin/orders');
    assert(noTokenStatus === 401, 'Order list requires authentication token');

    const { status: badTokenStatus } = await fetchApi('/admin/orders', { token: 'invalid_token_here' });
    assert(badTokenStatus === 401, 'Order list rejects invalid token');

    // 2. Order List
    console.log('\n--- ORDER LIST ---');
    const { status: listStatus, body: listBody } = await fetchApi('/admin/orders?limit=5', { token: adminToken });
    assert(listStatus === 200 && Array.isArray(listBody.orders), 'List orders returns array');
    
    const { status: invalidLimitStatus, body: invalidLimitBody } = await fetchApi('/admin/orders?min_total=10&max_total=5', { token: adminToken });
    assert(invalidLimitStatus === 400, 'Rejects min_total > max_total');

    // 3. Order Details
    console.log('\n--- ORDER DETAIL ---');
    if (listBody.orders.length > 0) {
      const sampleOrder = listBody.orders[0];
      const { status: detailStatus, body: detailBody } = await fetchApi(`/admin/orders/${sampleOrder.order_number}`, { token: adminToken });
      
      assert(detailStatus === 200, 'Order detail successful');
      assert(detailBody.order && detailBody.order.order_number === sampleOrder.order_number, 'Returns correct order details');
      assert(Array.isArray(detailBody.items), 'Returns order items');
      assert(detailBody.payment, 'Returns payment history wrapper');
      assert(detailBody.order.status, 'Order status field exists');

      // 4. Status Transition
      console.log('\n--- STATUS TRANSITIONS ---');
      const startStatus = detailBody.order.status;

      // PENDING_PAYMENT -> CONFIRMED
      if (startStatus === 'PENDING_PAYMENT') {
        const { status: patchStatus, body: patchBody } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'CONFIRMED' }
        });
        assert(patchStatus === 200 && patchBody.success === true, 'Can transition PENDING_PAYMENT to CONFIRMED');

        // Check history
        const { status: histStatus, body: histBody } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/history`, { token: adminToken });
        assert(histStatus === 200 && Array.isArray(histBody.history) && histBody.history.length > 0, 'History record created');

        // CONFIRMED -> PROCESSING
        const { status: patch2Status } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'PROCESSING' }
        });
        assert(patch2Status === 200, 'Can transition CONFIRMED to PROCESSING');

        // Invalid transition: PROCESSING -> DELIVERED
        const { status: invalidStatus } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'DELIVERED' }
        });
        assert(invalidStatus === 409, 'Rejects invalid transition PROCESSING -> DELIVERED');
        
        // CANCELLATION
        console.log('\n--- CANCELLATION ---');
        const { status: cancelNoReasonStatus } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/cancel`, {
          method: 'POST',
          token: adminToken,
          body: {} // no reason
        });
        assert(cancelNoReasonStatus === 400, 'Cancellation requires a reason');

        const { status: cancelStatus } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/cancel`, {
          method: 'POST',
          token: adminToken,
          body: { reason: 'Customer requested' }
        });
        assert(cancelStatus === 200, 'Valid cancellation succeeds');

        const { status: cancelAgainStatus } = await fetchApi(`/admin/orders/${sampleOrder.order_number}/cancel`, {
          method: 'POST',
          token: adminToken,
          body: { reason: 'Another attempt' }
        });
        assert(cancelAgainStatus === 200, 'Cancellation is idempotent / safe if already cancelled');
      } else {
        console.log('Skipping status transition tests because first order is not PENDING_PAYMENT');
      }

    } else {
      console.log('No orders found to test order detail endpoint.');
    }

    console.log(`\nTests completed: ${passed} passed, ${failed} failed`);

  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

runTests();
