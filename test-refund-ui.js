const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function runTests() {
  console.log('--- STARTING PHASE 7B UI TESTS ---');
  let passed = 0; let failed = 0;
  function assert(condition, message) {
    if (condition) { passed++; console.log('✅ PASS: ' + message); }
    else { failed++; console.error('❌ FAIL: ' + message); }
  }

  const htmlPath = path.join(__dirname, 'frontend/mikyaj-demo/admin/order-detail.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  htmlContent = htmlContent.replace(/<script src="[^"]+"><\/script>/g, ''); // Remove external scripts

  // Setup fake DOM
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/admin/order-detail.html?orderNumber=MKJ-TEST-UI',
    runScripts: 'dangerously',
    resources: 'usable'
  });

  const window = dom.window;
  const document = window.document;

  // Mock localStorage
  let storage = {};
  window.localStorage = {
    getItem: key => storage[key] || null,
    setItem: (key, val) => storage[key] = val,
    removeItem: key => delete storage[key]
  };

  // Mock confirm and alert
  window.confirm = () => true;
  window.alert = () => {};

  // Mock MikyajApp
  window.MikyajApp = {
    showToast: (msg, type) => { console.log(`Toast [${type}]: ${msg}`); },
    formatDateTime: () => '2026-10-02 12:00:00'
  };

  // Mock API responses
  let apiLog = [];
  window.MikyajAPI = {
    adminFetch: async (url, opts) => {
      apiLog.push({ url, opts });
      const session = storage['mikyaj_admin_session'] ? JSON.parse(storage['mikyaj_admin_session']) : null;
      if (!session || !session.token) {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      }
      
      if (url.includes('/admin/orders/MKJ-TEST-UI/reconciliation')) {
        return {
          reconciliation: {
            reconciliationState: 'RECONCILED',
            paidAmount: 100.000,
            refundedCompletedAmount: 20.000,
            refundedPendingAmount: 0,
            remainingRefundableAmount: 80.000,
            paymentStatus: 'SUCCESS',
            paymentId: 1,
            warnings: [],
            refunds: [
              { amount: 20.000, status: 'REFUNDED', reason: 'Test reason' }
            ]
          }
        };
      }
      if (url.includes('/admin/orders/MKJ-TEST-UI/refunds')) {
        // Handle POST refund
        if (opts && opts.body && parseFloat(opts.body.amount) > 80) {
          const err = new Error('AMOUNT_EXCEEDS_REMAINING_BALANCE');
          err.status = 400;
          throw err;
        }
        return { success: true };
      }
      if (url.includes('/admin/orders/MKJ-TEST-UI/history')) {
        return { history: [] };
      }
      if (url.includes('/admin/orders/MKJ-TEST-UI/payments')) {
        return { payments: [] };
      }
      if (url.includes('/admin/orders/MKJ-TEST-UI')) {
        return {
          order: { order_number: 'MKJ-TEST-UI', status: 'CONFIRMED', total_amount: 100 },
          payment: { status: 'PAID' },
          items: []
        };
      }
    }
  };

  try {
    // 1. Unauthenticated Redirect
    await window.loadOrderDetail();
    assert(document.getElementById('errorState').style.display === 'block', 'Unauthenticated user shows error or blocks load');
    
    // Authenticate
    window.localStorage.setItem('mikyaj_admin_session', JSON.stringify({ token: 'valid-token', admin: { email: 'admin@mikyaj.com' } }));
    
    // Load normally
    await window.loadOrderDetail();
    await new Promise(r => setTimeout(r, 100)); // allow async UI functions to run
    
    // Verify Reconciliation loads
    const recBody = document.getElementById('reconciliationBody').innerHTML;
    assert(recBody.includes('RECONCILED'), 'Reconciliation status rendered');
    assert(recBody.includes('80.000 KWD'), 'Remaining refundable rendered at 3 decimal places');
    assert(recBody.includes('Issue Refund Request'), 'Refund button is visible for SUCCESS payment');
    
    // Verify Refund History
    const historyBody = document.getElementById('refundHistoryBody').innerHTML;
    assert(historyBody.includes('20.000 KWD'), 'Refund history rendered properly');
    assert(historyBody.includes('REFUNDED'), 'Completed status shown');
    
    // Test Modal
    window.openRefundModal();
    assert(document.getElementById('refundModal').classList.contains('active'), 'Refund modal opened');
    
    // Validation
    const btn = document.getElementById('confirmRefundBtn');
    document.getElementById('refundAmount').value = '';
    await window.submitRefund();
    assert(document.getElementById('refundError').textContent === 'Amount is required.', 'Empty amount blocked locally');
    
    document.getElementById('refundAmount').value = '-10';
    await window.submitRefund();
    assert(document.getElementById('refundError').textContent === 'Amount must be a positive number.', 'Negative amount blocked locally');
    
    document.getElementById('refundAmount').value = '10';
    document.getElementById('refundReason').value = '';
    await window.submitRefund();
    assert(document.getElementById('refundError').textContent === 'Refund reason is required.', 'Empty reason blocked locally');
    
    // Preview logic
    document.getElementById('refundAmount').value = '100';
    document.getElementById('refundAmount').dispatchEvent(new window.Event('input'));
    assert(document.getElementById('refundPreview').textContent.includes('exceeds remaining balance'), 'Preview shows over-refund warning correctly');
    
    // Backend Reject Test
    document.getElementById('refundAmount').value = '100';
    document.getElementById('refundReason').value = 'Testing';
    await window.submitRefund();
    assert(document.getElementById('refundError').textContent === 'AMOUNT_EXCEEDS_REMAINING_BALANCE', 'Backend over-refund natively handled');
    
    // Valid Request Test
    document.getElementById('refundAmount').value = '25.000';
    document.getElementById('refundReason').value = 'Valid Test';
    await window.submitRefund();
    const lastApi = apiLog[apiLog.length - 1];
    assert(lastApi.url === '/admin/orders/MKJ-TEST-UI/refunds', 'Refund API called');
    assert(lastApi.opts.method === 'POST', 'Used POST method');
    assert(lastApi.opts.body.amount === '25.000', 'Sent exactly formatted 3-decimal amount');
    assert(lastApi.opts.body.reason === 'Valid Test', 'Sent proper reason');
    assert(!document.getElementById('refundModal').classList.contains('active'), 'Modal closed on success');

  } catch (err) {
    console.error('Fatal test error:', err);
  }
  
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
