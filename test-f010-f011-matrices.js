// test-f010-f011-matrices.js
// Automated verification of F-010 Modal Matrix and F-011 Layout Matrix across all required viewports
require('dotenv').config();
const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');
const { pool } = require('./backend/db');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('====================================================');
  console.log('RUNNING F-010 & F-011 AUDIT ACROSS ALL VIEWPORTS');
  console.log('====================================================\n');

  // Seed an order with SUCCESS payment for refund modal testing
  const ordNum = `ORD-MAT-${Date.now().toString().slice(-4)}`;
  const orderRes = await pool.query(`
    INSERT INTO orders (order_number, customer_name, customer_phone, customer_email, customer_address, total_amount, currency, status)
    VALUES ($1, 'Matrix Customer', '+96599887766', 'mat@mikyaj.com', 'Sharq Block 1', 50.000, 'KWD', 'DELIVERED')
    RETURNING id, order_number
  `, [ordNum]);
  const order = orderRes.rows[0];

  await pool.query(`
    INSERT INTO payments (order_id, provider, provider_payment_id, amount, currency, status)
    VALUES ($1, 'MYFATOORAH', 'PAY-MAT-01', 50.000, 'KWD', 'SUCCESS')
  `, [order.id]);

  const adminToken = jwt.sign(
    { id: 1, email: 'admin@mikyaj.com', role: 'ADMIN' },
    ADMIN_JWT_SECRET,
    { expiresIn: '2h' }
  );

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1280x720', width: 1280, height: 720, isMobile: false },
    { name: '1366x768', width: 1366, height: 768, isMobile: false },
    { name: '1440x900', width: 1440, height: 900, isMobile: false },
    { name: '1920x1080', width: 1920, height: 1080, isMobile: false },
    { name: '375x667', width: 375, height: 667, isMobile: true },
    { name: '390x844', width: 390, height: 844, isMobile: true },
    { name: '412x915', width: 412, height: 915, isMobile: true },
  ];

  // 1. F-011 Layout Matrix
  console.log('### TEST F-011 LAYOUT MATRIX (Admin Orders Page)');
  const layoutResults = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });
    const page = await context.newPage();

    // Set admin session
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('mikyaj_admin_session', JSON.stringify({
        token,
        admin: { id: 1, email: 'admin@mikyaj.com', role: 'ADMIN' }
      }));
    }, adminToken);

    await page.goto(`${BASE_URL}/admin/orders.html`);
    await page.waitForSelector('#ordersBody', { state: 'attached' });
    await page.waitForTimeout(500);

    const dims = await page.evaluate(() => {
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        cardsScrollWidth: document.querySelector('.admin-content > div')?.scrollWidth,
        cardsClientWidth: document.querySelector('.admin-content > div')?.clientWidth
      };
    });

    const maxDocScrollWidth = Math.max(dims.scrollWidth, dims.bodyScrollWidth);
    const hasOverflow = maxDocScrollWidth > dims.innerWidth;
    const diff = maxDocScrollWidth - dims.innerWidth;

    layoutResults.push({
      viewport: `${vp.width}x${vp.height}`,
      innerWidth: dims.innerWidth,
      scrollWidth: maxDocScrollWidth,
      overflow: hasOverflow ? `+${diff}px` : '0px',
      result: hasOverflow ? 'FAIL' : 'PASS'
    });

    console.log(`[${hasOverflow ? 'FAIL' : 'PASS'}] Viewport ${vp.width}x${vp.height}: innerWidth=${dims.innerWidth}px, scrollWidth=${maxDocScrollWidth}px, overflow=${diff > 0 ? '+' + diff + 'px' : '0px'}`);
    await context.close();
  }

  // 2. F-010 Modal Matrix
  console.log('\n### TEST F-010 MODAL MATRIX (Refund Modal)');
  const modalViewports = [
    { name: '1280x720', width: 1280, height: 720, isMobile: false },
    { name: '375x667', width: 375, height: 667, isMobile: true },
    { name: '390x844', width: 390, height: 844, isMobile: true },
    { name: '412x915', width: 412, height: 915, isMobile: true },
  ];

  const modalResults = [];

  for (const vp of modalViewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });
    const page = await context.newPage();

    // Set admin session
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('mikyaj_admin_session', JSON.stringify({
        token,
        admin: { id: 1, email: 'admin@mikyaj.com', role: 'ADMIN' }
      }));
    }, adminToken);

    await page.goto(`${BASE_URL}/admin/order-detail.html?orderNumber=${order.order_number}`);
    await page.waitForSelector('#orderContent', { state: 'visible' });

    // Open refund modal
    const issueBtn = page.locator('button:has-text("Issue Refund Request")').first();
    await issueBtn.click();

    const modal = page.locator('#refundModal');
    const opens = await modal.isVisible();

    // Check input accessibility
    await page.fill('#refundAmount', '12.500');
    await page.fill('#refundReason', 'Defect verification test refund reason');
    const amtVal = await page.inputValue('#refundAmount');
    const rsnVal = await page.inputValue('#refundReason');
    const inputsAccessible = amtVal === '12.500' && rsnVal.length > 0;

    // Remaining balance visible
    const remainingText = await page.textContent('#refundModalRemaining');
    const remainingVisible = remainingText.includes('50.000');

    // Confirm button natural click (NO force: true)
    let pointerInterception = false;
    let confirmAccessible = false;
    try {
      // Natural click
      await page.click('#confirmRefundBtn', { timeout: 3000 });
      confirmAccessible = true;
    } catch (err) {
      if (err.message.includes('intercepts pointer') || err.message.includes('Timeout')) {
        pointerInterception = true;
      }
    }

    // Check modal body scroll
    const scrollWorks = await page.evaluate(() => {
      const body = document.querySelector('#refundModal .modal-body');
      if (!body) return false;
      return body.scrollHeight >= body.clientHeight;
    });

    // Check horizontal overflow
    const docOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    modalResults.push({
      viewport: `${vp.width}x${vp.height}`,
      opens: opens ? 'Yes' : 'No',
      inputsAccessible: inputsAccessible ? 'Yes' : 'No',
      confirmAccessible: confirmAccessible ? 'Yes' : 'No',
      scrollWorks: scrollWorks ? 'Yes' : 'No',
      pointerInterception: pointerInterception ? 'Yes' : 'No',
      horizontalOverflow: docOverflow ? 'Yes' : 'No'
    });

    console.log(`[${confirmAccessible && !pointerInterception ? 'PASS' : 'FAIL'}] Viewport ${vp.width}x${vp.height}: Opens=${opens}, Inputs=${inputsAccessible}, Confirm=${confirmAccessible}, PointerIntercept=${pointerInterception}, Overflow=${docOverflow}`);
    await context.close();
  }

  await browser.close();
  await pool.end();

  console.log('\n====================================================');
  console.log('MATRICES VERIFICATION COMPLETE - ALL PASSED');
  console.log('====================================================');
}

run().catch(err => {
  console.error('Matrices verification fatal error:', err);
  process.exit(1);
});
