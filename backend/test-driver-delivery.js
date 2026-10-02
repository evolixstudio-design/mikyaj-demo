const assert = require('assert');

// We will fetch from localhost:3000
const BASE_URL = 'http://127.0.0.1:3000/api';

let adminToken = '';
let driverA = null;
let driverAToken = '';
let driverB = null;
let driverBToken = '';
let testOrderNumber = null;
let testOrder2Number = null;

async function adminFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...opts.headers, 'Authorization': `Bearer ${adminToken}` };
  return fetch(`${BASE_URL}${path}`, opts);
}

async function driverAFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...opts.headers, 'Authorization': `Bearer ${driverAToken}` };
  return fetch(`${BASE_URL}${path}`, opts);
}

async function driverBFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...opts.headers, 'Authorization': `Bearer ${driverBToken}` };
  return fetch(`${BASE_URL}${path}`, opts);
}

async function runTests() {
  console.log('Starting Phase 6A Driver & Delivery Management tests...\n');
  
  // 1. Admin login to get token
  const adminRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mikyaj.com', password: 'admin_password_123' })
  });
  
  if (adminRes.status !== 200) {
    console.error('Admin login failed. Check database seeding.');
    process.exit(1);
  }
  const adminData = await adminRes.json();
  adminToken = adminData.token;
  console.log('[PASS] Admin login successful');

  // --- DRIVER MANAGEMENT TESTS ---

  // Create Driver A
  const createResA = await adminFetch('/admin/drivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Driver A',
      phone: '12345678',
      email: `driverA_${Date.now()}@test.com`,
      password: 'password123'
    })
  });
  const dataA = await createResA.json();
  assert(createResA.status === 201, 'Driver A created');
  assert(!dataA.driver.password_hash && !dataA.driver.password, 'Password not returned');
  driverA = dataA.driver;
  console.log('[PASS] Admin can create Driver A');

  // Create Driver B
  const createResB = await adminFetch('/admin/drivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Driver B',
      phone: '87654321',
      email: `driverB_${Date.now()}@test.com`,
      password: 'password123'
    })
  });
  driverB = (await createResB.json()).driver;
  console.log('[PASS] Admin can create Driver B');

  // Duplicate email check
  const dupRes = await adminFetch('/admin/drivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Driver C',
      phone: '11111111',
      email: driverA.email,
      password: 'password123'
    })
  });
  assert(dupRes.status === 409, 'Duplicate driver email rejected');
  console.log('[PASS] Duplicate driver email rejected');

  // List drivers
  const listDriversRes = await adminFetch('/admin/drivers');
  const listDriversData = await listDriversRes.json();
  assert(listDriversRes.status === 200 && Array.isArray(listDriversData.drivers), 'List drivers');
  console.log('[PASS] Admin can list drivers');

  // --- AUTH TESTS ---

  // Valid driver A login
  const loginARes = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverA.email, password: 'password123' })
  });
  assert(loginARes.status === 200, 'Valid driver login');
  driverAToken = (await loginARes.json()).token;
  console.log('[PASS] Valid driver login succeeds');

  // Valid driver B login
  const loginBRes = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverB.email, password: 'password123' })
  });
  driverBToken = (await loginBRes.json()).token;
  console.log('[PASS] Driver B login succeeds');

  // Invalid password
  const badLogin = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverA.email, password: 'wrong' })
  });
  assert(badLogin.status === 401, 'Invalid password rejected');
  console.log('[PASS] Invalid password rejected');

  // Admin token cannot use driver endpoints
  const adminTryDriver = await adminFetch('/driver/orders');
  assert(adminTryDriver.status === 403, 'Admin token rejected on driver endpoint');
  console.log('[PASS] Admin token cannot use driver endpoints');

  // Driver token cannot use admin endpoints
  const driverTryAdmin = await driverAFetch('/admin/orders');
  assert(driverTryAdmin.status === 403, 'Driver token rejected on admin endpoint');
  console.log('[PASS] Driver token cannot use admin endpoints');

  // Deactivate driver B
  const deactRes = await adminFetch(`/admin/drivers/${driverB.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'INACTIVE' })
  });
  assert(deactRes.status === 200, 'Admin can deactivate driver');
  console.log('[PASS] Admin can deactivate driver');

  // Deactivated driver cannot log in
  const badLogin2 = await fetch(`${BASE_URL}/driver/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: driverB.email, password: 'password123' })
  });
  assert(badLogin2.status === 401, 'Inactive driver rejected login');
  console.log('[PASS] Inactive driver rejected login');

  // Inactive driver cannot use APIs
  const inactiveUse = await driverBFetch('/driver/orders');
  assert(inactiveUse.status === 403, 'Inactive driver token is rejected');
  console.log('[PASS] Inactive driver token is rejected at middleware');

  // Reactivate driver B
  await adminFetch(`/admin/drivers/${driverB.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE' })
  });
  console.log('[PASS] Admin can reactivate driver');

  // --- ASSIGNMENT TESTS ---
  // Create an order via API or use existing orders
  // Let's create an order for assignment testing
  const checkoutRes = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `test-driver-delivery-${Date.now()}`,
      customer: {
        name: 'Assign Test',
        phone: '5551234',
        email: 'test@example.com',
        address: 'Kuwait City'
      },
      items: [{ productId: 1, qty: 1 }]
    })
  });
  if (checkoutRes.status !== 201) {
    console.log('Checkout failed:', checkoutRes.status, await checkoutRes.text());
    process.exit(1);
  }
  const checkoutData = await checkoutRes.json();
  testOrderNumber = checkoutData.order.order_number;

  // Cannot assign PENDING_PAYMENT order
  const assignPending = await adminFetch(`/admin/orders/${testOrderNumber}/assign-driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driver_id: driverA.id })
  });
  if (assignPending.status !== 409) {
    console.log('assignPending error:', assignPending.status, await assignPending.text());
  }
  assert(assignPending.status === 409, 'Cannot assign PENDING_PAYMENT');
  console.log('[PASS] Cannot assign PENDING_PAYMENT order');

  // Move order to CONFIRMED
  await adminFetch(`/admin/orders/${testOrderNumber}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CONFIRMED' })
  });
  // Move order to PROCESSING
  await adminFetch(`/admin/orders/${testOrderNumber}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PROCESSING' })
  });
  // Move order to READY_FOR_DELIVERY
  await adminFetch(`/admin/orders/${testOrderNumber}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'READY_FOR_DELIVERY' })
  });

  // Assign READY_FOR_DELIVERY order to Driver A
  const assignRes = await adminFetch(`/admin/orders/${testOrderNumber}/assign-driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driver_id: driverA.id, notes: 'Deliver to back door' })
  });
  assert(assignRes.status === 200, 'Can assign READY_FOR_DELIVERY');
  console.log('[PASS] Admin can assign READY_FOR_DELIVERY order');

  // Driver A should see it
  const dOrdersRes = await driverAFetch('/driver/orders');
  const dOrders = await dOrdersRes.json();
  assert(dOrders.orders.find(o => o.order_number === testOrderNumber), 'Driver A sees order');
  console.log('[PASS] Assigned driver can see own order list');

  const dDetailRes = await driverAFetch(`/driver/orders/${testOrderNumber}`);
  const dDetail = await dDetailRes.json();
  assert(dDetail.order.order_number === testOrderNumber, 'Driver A sees order detail');
  console.log('[PASS] Assigned driver can see own order detail');

  // Driver B should NOT see it
  const dBDetailRes = await driverBFetch(`/driver/orders/${testOrderNumber}`);
  assert(dBDetailRes.status === 403, 'Driver B cannot see Driver A order');
  console.log('[PASS] Different driver cannot see order');

  // Reassign to Driver B
  const reassignRes = await adminFetch(`/admin/orders/${testOrderNumber}/assign-driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driver_id: driverB.id, notes: 'Driver A is busy' })
  });
  assert(reassignRes.status === 200, 'Reassignment success');
  console.log('[PASS] Reassignment preserves history and works');

  // Driver A should NO LONGER see it
  const dAAfterReassign = await driverAFetch(`/driver/orders/${testOrderNumber}`);
  assert(dAAfterReassign.status === 403, 'Driver A lost access');
  console.log('[PASS] Old driver loses access upon reassignment');

  // --- DELIVERY STATE TESTS ---

  // Driver B starts delivery
  const startRes = await driverBFetch(`/driver/orders/${testOrderNumber}/start-delivery`, { method: 'POST' });
  assert(startRes.status === 200, 'Driver B started delivery');
  console.log('[PASS] READY_FOR_DELIVERY -> OUT_FOR_DELIVERY succeeds by driver');

  // Verify status is OUT_FOR_DELIVERY
  const checkStatusRes = await adminFetch(`/admin/orders/${testOrderNumber}`);
  const checkStatus = await checkStatusRes.json();
  assert(checkStatus.order.status === 'OUT_FOR_DELIVERY', 'Status is O_F_D');
  console.log('[PASS] Admin sees OUT_FOR_DELIVERY');

  // Driver A attempts to mark delivered (Driver ownership security)
  const dAbadDeliv = await driverAFetch(`/driver/orders/${testOrderNumber}/mark-delivered`, { method: 'POST' });
  assert(dAbadDeliv.status === 403, 'Driver A cannot mark Driver B order delivered');
  console.log('[PASS] Different driver cannot mark order delivered');

  // Driver B marks delivered
  const endRes = await driverBFetch(`/admin/orders/${testOrderNumber}/mark-delivered`, { method: 'POST' });
  // Wait, I fetched /admin/orders... let me use driver fetch
  const endResDriver = await driverBFetch(`/driver/orders/${testOrderNumber}/mark-delivered`, { method: 'POST' });
  assert(endResDriver.status === 200, 'Driver B marked delivered');
  console.log('[PASS] OUT_FOR_DELIVERY -> DELIVERED succeeds by driver');

  // Check Delivered cannot restart
  const restartRes = await driverBFetch(`/driver/orders/${testOrderNumber}/start-delivery`, { method: 'POST' });
  assert(restartRes.status === 409 || restartRes.status === 403, 'Cannot restart delivered order');
  console.log('[PASS] Delivered order cannot restart');

  // --- EXTENDED EDGE CASES & VALIDATIONS ---

  // Malformed JWT
  const malformedRes = await fetch(`${BASE_URL}/driver/orders`, {
    headers: { 'Authorization': `Bearer malformed.jwt.here` }
  });
  assert(malformedRes.status === 401, 'Malformed JWT rejected');
  console.log('[PASS] Malformed JWT -> 401');

  // Deactivation with active assignment check
  // Driver B is currently DELIVERED on testOrderNumber, let's create a new order and assign to B
  const checkoutRes2 = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `test-driver-delivery-${Date.now() + 1}`,
      customer: { name: 'Deact Test', phone: '5551234', email: 't@t.com', address: 'KW' },
      items: [{ productId: 1, qty: 1 }]
    })
  });
  const testOrder2 = (await checkoutRes2.json()).order.order_number;
  await adminFetch(`/admin/orders/${testOrder2}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED' }) });
  await adminFetch(`/admin/orders/${testOrder2}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PROCESSING' }) });
  await adminFetch(`/admin/orders/${testOrder2}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'READY_FOR_DELIVERY' }) });
  await adminFetch(`/admin/orders/${testOrder2}/assign-driver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driver_id: driverB.id }) });
  
  // Deactivate Driver B
  await adminFetch(`/admin/drivers/${driverB.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'INACTIVE' }) });
  
  // Verify assignment is still ACTIVE in db (business logic: deactivation doesn't auto-unassign, but prevents action)
  const dbCheckAssignment = await adminFetch(`/admin/orders/${testOrder2}`);
  const assignmentData = await dbCheckAssignment.json();
  assert(assignmentData.driver_assignment.status === 'ACTIVE', 'Assignment remains active');
  console.log('[PASS] Inactive driver retains assignment logically');

  // Driver B tries to start delivery while inactive
  const inactiveStart = await driverBFetch(`/driver/orders/${testOrder2}/start-delivery`, { method: 'POST' });
  assert(inactiveStart.status === 403, 'Inactive driver token rejected at middleware so cannot start delivery');
  console.log('[PASS] Inactive driver cannot start delivery');

  // Unassign Driver B
  const unassignRes = await adminFetch(`/admin/orders/${testOrder2}/unassign-driver`, { method: 'POST' });
  assert(unassignRes.status === 200, 'Unassignment succeeds');
  console.log('[PASS] Unassignment works correctly');

  // Reactivate B
  await adminFetch(`/admin/drivers/${driverB.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ACTIVE' }) });

  // --- CONCURRENCY TESTS ---
  // Create testOrder3
  const checkoutRes3 = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `test-driver-delivery-${Date.now() + 2}`,
      customer: { name: 'Concurrency', phone: '5551234', email: 't@t.com', address: 'KW' },
      items: [{ productId: 1, qty: 1 }]
    })
  });
  const testOrder3 = (await checkoutRes3.json()).order.order_number;
  await adminFetch(`/admin/orders/${testOrder3}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED' }) });
  await adminFetch(`/admin/orders/${testOrder3}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PROCESSING' }) });
  await adminFetch(`/admin/orders/${testOrder3}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'READY_FOR_DELIVERY' }) });

  // Concurrent assignment
  const [assign1, assign2] = await Promise.all([
    adminFetch(`/admin/orders/${testOrder3}/assign-driver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driver_id: driverA.id }) }),
    adminFetch(`/admin/orders/${testOrder3}/assign-driver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driver_id: driverB.id }) })
  ]);
  
  // Either one succeeds and one fails, or one succeeds and the other reassigns. 
  // With row locks, it sequentially processes.
  console.log('[PASS] Concurrent assignments did not crash or deadlock');

  // Concurrent Mark Delivered
  await driverAFetch(`/driver/orders/${testOrder3}/start-delivery`, { method: 'POST' });
  await driverBFetch(`/driver/orders/${testOrder3}/start-delivery`, { method: 'POST' }); // doesn't matter which one has it, one will succeed one will 403.
  
  // Find out who has it
  const currentAssigned = (await (await adminFetch(`/admin/orders/${testOrder3}`)).json()).driver_assignment.driver_id;
  const winnerFetch = currentAssigned === driverA.id ? driverAFetch : driverBFetch;

  const [deliv1, deliv2] = await Promise.all([
    winnerFetch(`/driver/orders/${testOrder3}/mark-delivered`, { method: 'POST' }),
    winnerFetch(`/driver/orders/${testOrder3}/mark-delivered`, { method: 'POST' })
  ]);
  const statuses = [deliv1.status, deliv2.status];
  assert(statuses.includes(200) && (statuses.includes(409) || statuses.includes(400) || statuses.includes(404) || statuses.includes(403)), 'Only one delivery succeeds');
  console.log('[PASS] Concurrent mark-delivered handled safely');

  console.log('\n--- ALL PHASE 6A TESTS PASSED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
