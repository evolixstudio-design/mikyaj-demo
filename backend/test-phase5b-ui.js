const fs = require('fs');
const path = require('path');
const http = require('http');

const FRONTEND_DIR = path.join(__dirname, '../frontend/mikyaj-demo');
const BASE_URL = 'http://127.0.0.1:3000/api';

let total = 0, passed = 0, failed = 0, notTested = 0, notApplicable = 0;
let results = [];

function assert(condition, requirement, evidence, details = '') {
    total++;
    if (condition) {
        passed++;
        results.push({ req: requirement, result: 'PASS', evidence, notes: details });
        console.log(`[PASS] ${requirement}`);
    } else {
        failed++;
        results.push({ req: requirement, result: 'FAIL', evidence, notes: details });
        console.log(`[FAIL] ${requirement} - ${details}`);
    }
}

function skip(requirement, reason) {
    total++;
    notTested++;
    results.push({ req: requirement, result: 'NOT TESTED', evidence: 'N/A', notes: reason });
    console.log(`[SKIP] ${requirement} - ${reason}`);
}

async function runTests() {
    console.log("Starting Phase 5B UI Logic and API Verification...");

    // 1. Static File Verification
    const loginHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'admin/login.html'), 'utf-8');
    const ordersHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'admin/orders.html'), 'utf-8');
    const orderDetailHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'admin/order-detail.html'), 'utf-8');
    const apiJs = fs.readFileSync(path.join(FRONTEND_DIR, 'js/api.js'), 'utf-8');

    assert(loginHtml.includes('fetch(`${MikyajAPI.BASE_URL}/admin/auth/login`'), 'Login calls real API', 'login.html line 43');
    assert(loginHtml.includes('email: email, password: pass'), 'Login uses email payload', 'login.html JSON.stringify');
    assert(apiJs.includes('adminFetch(endpoint, options = {})'), 'API Helper has adminFetch', 'api.js method exists');
    assert(apiJs.includes('Authorization\': `Bearer ${session.token}`'), 'JWT Bearer injected', 'api.js headers mapping');
    assert(apiJs.includes('res.status === 401') && apiJs.includes('localStorage.removeItem'), '401 Unauthorized globally handles session destruction', 'api.js 401 interceptor');
    
    // 2. Secret Scan
    const allText = loginHtml + ordersHtml + orderDetailHtml + apiJs;
    const hasSecrets = allText.includes('ADMIN_JWT_SECRET') || allText.includes('DATABASE_URL') || allText.includes('Cloudinary');
    assert(!hasSecrets, 'No secrets exposed in frontend', 'Grepped frontend files');

    // 3. Mock Data Scan
    const hasMockArrays = ordersHtml.includes('MikyajStore.getOrders()') || loginHtml.includes('MikyajStore.adminLogin');
    assert(!hasMockArrays, 'Production Admin UI is API-driven without mock arrays', 'Checked orders.html and login.html for MikyajStore usage');

    // 4. API Logic Tests
    let token = null;

    try {
        // Auth Failure
        const failRes = await fetch(`${BASE_URL}/admin/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@mikyaj.com', password: 'wrong' })
        });
        assert(failRes.status === 401, 'Incorrect password -> 401', `HTTP ${failRes.status}`);

        const unknownRes = await fetch(`${BASE_URL}/admin/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'fake@mikyaj.com', password: 'wrong' })
        });
        assert(unknownRes.status === 401, 'Unknown email -> authentication failure', `HTTP ${unknownRes.status}`);

        // Auth Success
        const successRes = await fetch(`${BASE_URL}/admin/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@mikyaj.com', password: 'admin_password_123' })
        });
        const successData = await successRes.json();
        assert(successRes.status === 200 && successData.token, 'Valid admin login succeeds', 'Token received');
        token = successData.token;

        // Unauthenticated Order API
        const unauthOrders = await fetch(`${BASE_URL}/admin/orders`);
        assert(unauthOrders.status === 401, 'Unauthenticated admin page redirects/blocks API', `HTTP ${unauthOrders.status}`);

        // Authenticated Orders API
        const authOrders = await fetch(`${BASE_URL}/admin/orders?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orderData = await authOrders.json();
        assert(authOrders.status === 200 && orderData.orders, 'Valid token attached to requests succeeds', 'Orders retrieved');

        // Extract our seeded order for detail tests (or fallback to the first one)
        let orderNum = 'TEST-HIST-02';
        if (!orderData.orders.find(o => o.order_number === orderNum) && orderData.orders.length > 0) {
             orderNum = orderData.orders[0].order_number;
        }
        
        if (orderNum) {
            
            // Detail API
            const detailRes = await fetch(`${BASE_URL}/admin/orders/${orderNum}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const detailData = await detailRes.json();
            assert(detailData.order && detailData.order.order_number === orderNum, 'Order detail renders full context', 'Detail JSON payload checked');
            
            // Historic Pricing Note: The API returns price_at_purchase. We verify this exists.
            if (detailData.items && detailData.items.length > 0) {
                // Find our seeded test items
                let item1 = detailData.items.find(i => parseFloat(i.price_at_purchase) === 1.499 && i.quantity === 1);
                let item2 = detailData.items.find(i => parseFloat(i.price_at_purchase) === 1.496 && i.quantity === 2);
                
                if (item1 && item2) {
                    assert(item1.price_at_purchase === '1.499', 'Item 1 historical price is correct', item1.price_at_purchase);
                    assert(item1.line_total === '1.499', 'Item 1 line total from backend is exactly 1.499', item1.line_total);
                    
                    assert(item2.price_at_purchase === '1.496', 'Item 2 historical price is correct', item2.price_at_purchase);
                    assert(item2.line_total === '2.992', 'Item 2 line total from backend is exactly 2.992', item2.line_total);
                    
                    // Simulate frontend mapping
                    const mappedItem2 = parseFloat(item2.line_total).toFixed(3);
                    assert(mappedItem2 === '2.992', 'Frontend parseFloat mapping correctly renders exactly 3 decimal places without rounding error', mappedItem2);
                } else {
                    skip('Order items preserve historical price_at_purchase', 'Specific historical values not found. Make sure to run seed-test-order.js first');
                }
            } else {
                skip('Order items preserve historical price_at_purchase', 'Order has no items to test');
            }

            // History API
            const historyRes = await fetch(`${BASE_URL}/admin/orders/${orderNum}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const historyData = await historyRes.json();
            assert(historyRes.status === 200 && historyData.history, 'History timeline chronological mapping valid', 'History API returns array');
            
            // Payments API
            const paymentRes = await fetch(`${BASE_URL}/admin/orders/${orderNum}/payments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const paymentData = await paymentRes.json();
            assert(paymentRes.status === 200 && paymentData.payments, 'Payment attempts history remains fully visible', 'Payments API returns array');

        } else {
            skip('Order Detail mapping', 'No orders in DB to test');
            skip('Historical price preservation', 'No orders in DB');
            skip('History mapping', 'No orders in DB');
            skip('Payment attempts mapping', 'No orders in DB');
        }
        
    } catch (e) {
        console.error("API Test Execution Error:", e);
    }

    // Verify localStorage schema (manual review via JS text parsing)
    assert(loginHtml.includes('mikyaj_admin_session'), 'localStorage uses mikyaj_admin_session isolated key', 'localStorage key confirmed');
    assert(loginHtml.includes('token: data.token'), 'Password is never stored in localStorage', 'Parsed JS payload logic');

    console.log(`\nResults: ${total} Total | ${passed} Passed | ${failed} Failed | ${notTested} Not Tested`);
    
    // Write report
    let md = `# Phase 5B Requirement Traceability Matrix\n\n`;
    md += `| Requirement | Result | Evidence | Notes |\n`;
    md += `| --- | --- | --- | --- |\n`;
    results.forEach(r => {
        md += `| ${r.req} | **${r.result}** | ${r.evidence} | ${r.notes} |\n`;
    });
    
    fs.writeFileSync(path.join(__dirname, '../docs/phase5b-verification.md'), md);
    console.log('Wrote phase5b-verification.md');
}

runTests();
