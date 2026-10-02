const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simulate the frontend by parsing the API behavior the frontend expects
const BASE_URL = 'http://127.0.0.1:3000/api';

async function runUITests() {
  console.log('--- Phase 6B Driver UI / API Backend Conformance Test ---');
  
  // Create an admin token first to seed drivers & orders
  const adminRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mikyaj.com', password: 'admin_password_123' })
  });
  if (!adminRes.ok) {
    console.error('Admin login failed. Start server and seed.');
    process.exit(1);
  }
  const adminToken = (await adminRes.json()).token;
  const adminFetch = (p, o = {}) => fetch(`${BASE_URL}${p}`, { ...o, headers: { ...o.headers, 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }});

  // Seed Driver
  const driverEmail = `uidriver_${Date.now()}@test.com`;
  const driverPass = 'ui_password_123';
  const cRes = await adminFetch('/admin/drivers', {
    method: 'POST',
    body: JSON.stringify({ name: 'UI Driver', email: driverEmail, phone: '5550000', password: driverPass })
  });
  const driverData = await cRes.json();
  const driverId = driverData.driver.id;
  
  // Seed Order
  const chkRes = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `ui-test-${Date.now()}`,
      customer: { name: 'UI Cust', phone: '12345', email: 'c@t.com', address: 'UI Addr' },
      items: [{ productId: 1, qty: 1 }]
    })
  });
  const orderNumber = (await chkRes.json()).order.order_number;
  
  await adminFetch(`/admin/orders/${orderNumber}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CONFIRMED' }) });
  await adminFetch(`/admin/orders/${orderNumber}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'PROCESSING' }) });
  await adminFetch(`/admin/orders/${orderNumber}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'READY_FOR_DELIVERY' }) });
  await adminFetch(`/admin/orders/${orderNumber}/assign-driver`, { method: 'POST', body: JSON.stringify({ driver_id: driverId }) });
  
  console.log('[Setup] Seeded driver and assigned order');

  // AUTH TESTS
  // 1. wrong password
  const badLogin = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverEmail, password: 'wrong' })
  });
  assert(badLogin.status === 401, 'Wrong password rejected');
  console.log('[UI-AUTH] 401 Wrong password verified');

  // 2. valid login
  const goodLogin = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverEmail, password: driverPass })
  });
  assert(goodLogin.status === 200, 'Valid login accepted');
  const sessionToken = (await goodLogin.json()).token;
  console.log('[UI-AUTH] Login success verified');
  
  const uiFetch = (p, o = {}) => fetch(`${BASE_URL}${p}`, { ...o, headers: { ...o.headers, 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }});

  // DASHBOARD TESTS
  // 3. dashboard load
  const dashRes = await uiFetch('/driver/orders');
  assert(dashRes.status === 200, 'Dashboard loaded');
  const dashData = await dashRes.json();
  assert(dashData.orders.some(o => o.order_number === orderNumber), 'Order appears in dashboard');
  console.log('[UI-DASH] Assigned orders load verified');

  // DETAIL TESTS
  // 4. order detail load
  const detRes = await uiFetch(`/driver/orders/${orderNumber}`);
  assert(detRes.status === 200, 'Detail loaded');
  const detData = await detRes.json();
  assert(detData.order.customer_name === 'UI Cust', 'Customer info present');
  console.log('[UI-DETAIL] Order detail loads correctly');

  // 5. unauthorized order access handling
  // Try accessing an unassigned order
  const chkRes2 = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: `ui-test2-${Date.now()}`, customer: { name: 'A', phone: '1', email: 'a@a', address: 'A' }, items: [{ productId: 1, qty: 1 }] })
  });
  const unauthOrder = (await chkRes2.json()).order.order_number;
  const badDetRes = await uiFetch(`/driver/orders/${unauthOrder}`);
  assert(badDetRes.status === 403, 'Unauthorized order returns 403');
  console.log('[UI-DETAIL] 403 on unauthorized order verified');

  // DELIVERY ACTIONS
  // 6. Start delivery
  const startRes = await uiFetch(`/driver/orders/${orderNumber}/start-delivery`, { method: 'POST' });
  assert(startRes.status === 200, 'Start delivery success');
  console.log('[UI-DELIV] Start Delivery action verified');

  // 7. Duplicate start delivery protection (UI 409 handling trigger)
  const dupStart = await uiFetch(`/driver/orders/${orderNumber}/start-delivery`, { method: 'POST' });
  assert(dupStart.status === 409, 'Duplicate start throws 409 for UI refresh');
  console.log('[UI-DELIV] 409 Conflict protection verified');

  // 8. Mark delivered
  const doneRes = await uiFetch(`/driver/orders/${orderNumber}/mark-delivered`, { method: 'POST' });
  assert(doneRes.status === 200, 'Mark delivered success');
  console.log('[UI-DELIV] Mark Delivered action verified');

  // 9. Delivered state terminal check
  const checkState = await uiFetch(`/driver/orders/${orderNumber}/start-delivery`, { method: 'POST' });
  assert(checkState.status === 409 || checkState.status === 403, 'Terminal state protection');
  console.log('[UI-DELIV] Terminal state (Delivered) verified');

  // SECURITY: DEACTIVATED DRIVER
  await adminFetch(`/admin/drivers/${driverId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'INACTIVE' }) });
  const blockRes = await uiFetch('/driver/orders');
  assert(blockRes.status === 403, 'Deactivated driver blocked');
  console.log('[UI-SEC] Deactivated driver block verified');

  // STATIC FILE SECURITY TESTS
  const loginHtml = fs.readFileSync(path.join(__dirname, 'frontend/mikyaj-demo/driver/login.html'), 'utf-8');
  const dashHtml = fs.readFileSync(path.join(__dirname, 'frontend/mikyaj-demo/driver/dashboard.html'), 'utf-8');
  const detailHtml = fs.readFileSync(path.join(__dirname, 'frontend/mikyaj-demo/driver/order-detail.html'), 'utf-8');
  const htmls = loginHtml + dashHtml + detailHtml;
  assert(!htmls.includes('admin_session'), 'Driver UI must not use admin session');
  assert(!htmls.includes('MYFATOORAH'), 'Driver UI must not expose secrets');
  console.log('[UI-SEC] Session isolation and zero secrets in source verified');

  console.log('\n--- ALL UI API/SECURITY VALIDATIONS PASSED ---');
  process.exit(0);
}

runUITests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
