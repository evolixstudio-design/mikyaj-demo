// e2e/04-e2e-order-lifecycle.spec.js
const { test, expect } = require('@playwright/test');
const { pool } = require('../backend/db');
const { seedTestDriver, assignDriverToOrder, checkOverflow } = require('./test-helpers');
const crypto = require('crypto');

test.describe('Full Multi-Actor End-to-End Customer Order Journey', () => {

  test('TC-E2E-01: End-to-End Order: Storefront/Checkout -> Payment -> Admin Processing -> Driver Delivery -> Refund & Reconciliation', async ({ page }) => {
    test.setTimeout(90000);
    page.on('dialog', dialog => dialog.accept());

    // 1. Pre-seed a known driver
    const driver = await seedTestDriver('driver.journey@mikyaj.com', 'driver_journey_123');

    // Pre-seed an order in PENDING_PAYMENT
    const orderNumber = 'QA-JOURNEY-' + Date.now();
    const idemKey = 'idem-journey-' + Date.now();
    
    const client = await pool.connect();
    let orderId, paymentId;
    try {
      await client.query('BEGIN');
      const prodRes = await client.query("SELECT id, selling_price FROM products WHERE status = 'ACTIVE' LIMIT 1");
      const prod = prodRes.rows[0];
      const ordRes = await client.query(`
        INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total_amount, currency, status, idempotency_key, created_at, updated_at)
        VALUES ($1, 'Noura Al-Ahmad', 'noura@example.com', '96591234567', 'Salmiya, Block 5, Street 2', 25.000, 'KWD', 'PENDING_PAYMENT', $2, NOW(), NOW())
        RETURNING id
      `, [orderNumber, idemKey]);
      orderId = ordRes.rows[0].id;

      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
        VALUES ($1, $2, 1, 25.000)
      `, [orderId, prod.id]);

      const payRes = await client.query(`
        INSERT INTO payments (order_id, status, amount, currency, provider_payment_id, provider_invoice_id, created_at, updated_at)
        VALUES ($1, 'PENDING', 25.000, 'KWD', $2, $3, NOW(), NOW())
        RETURNING id
      `, [orderId, 'PAY-JOURNEY-' + Date.now(), 'INV-JOURNEY-' + Date.now()]);
      paymentId = payRes.rows[0].id;

      await client.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, reason, created_at)
        VALUES ($1, NULL, 'PENDING_PAYMENT', 'Order created by customer', NOW())
      `, [orderId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Step 2: Payment Gateway updates payment to SUCCESS and order to CONFIRMED
    await pool.query(`
      UPDATE payments SET status = 'SUCCESS', updated_at = NOW() WHERE id = $1
    `, [paymentId]);
    await pool.query(`
      UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1
    `, [orderId]);
    await pool.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, reason, created_at)
      VALUES ($1, 'PENDING_PAYMENT', 'CONFIRMED', 'Payment verified successfully via MyFatoorah', NOW())
    `, [orderId]);

    // Step 3: Customer lands on checkout-result.html
    await page.goto(`/checkout-result.html?order=${orderNumber}`);
    await expect(page.locator('#successState')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successOrderRef')).toContainText(orderNumber);

    // Step 4: Admin logs in and transitions order CONFIRMED -> PROCESSING -> READY_FOR_DELIVERY
    await page.goto('/admin/login.html');
    await page.fill('#email', 'admin@mikyaj.com');
    await page.fill('#password', 'admin_password_123');
    await page.click('#loginBtn');
    await page.waitForURL(/admin\/orders\.html/);

    await page.goto(`/admin/order-detail.html?orderNumber=${orderNumber}`);
    await expect(page.locator('#orderContent')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#badgeOrderStatus')).toHaveText(/CONFIRMED/i);

    // Click Start Processing
    await page.click('button:has-text("Start Processing")');
    await expect(page.locator('#badgeOrderStatus')).toHaveText(/PROCESSING/i, { timeout: 10000 });

    // Click Ready for Delivery
    await page.click('button:has-text("Ready for Delivery")');
    await expect(page.locator('#badgeOrderStatus')).toHaveText(/READY FOR DELIVERY/i, { timeout: 10000 });

    // Step 5: Assign driver to the order
    await assignDriverToOrder(orderId, driver.id);

    // Step 6: Driver logs in and delivers the order
    await page.goto('/driver/login.html');
    await page.fill('#email', 'driver.journey@mikyaj.com');
    await page.fill('#password', 'driver_journey_123');
    await page.click('#loginBtn');
    await page.waitForURL(/driver\/dashboard\.html/);

    await page.goto(`/driver/order-detail.html?orderNumber=${orderNumber}`);
    await expect(page.locator('#orderContent')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#ordStatus')).toHaveText(/READY[-_ ]FOR[-_ ]DELIVERY/i);

    // Start delivery
    await page.click('#mainActionBtn');
    await page.click('#modalConfirmBtn');
    await expect(page.locator('#ordStatus')).toHaveText(/OUT[-_ ]FOR[-_ ]DELIVERY/i, { timeout: 10000 });

    // Wait for action button to become "Mark Delivered"
    await expect(page.locator('#mainActionBtn')).toContainText(/Mark Delivered/i, { timeout: 10000 });

    // Mark delivered
    const markDeliveredPromise = page.waitForResponse(resp => resp.url().includes('mark-delivered'));
    await page.click('#mainActionBtn');
    await expect(page.locator('#actionModal')).toBeVisible({ timeout: 5000 });
    await page.click('#modalConfirmBtn');
    await markDeliveredPromise;

    // Step 7: Verify final database state for order and assignment
    const finalOrd = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(finalOrd.rows[0].status).toBe('DELIVERED');
    const finalAssign = await pool.query('SELECT status FROM order_driver_assignments WHERE order_id = $1', [orderId]);
    expect(finalAssign.rows[0].status).toBe('COMPLETED');

    // Step 8: Admin checks delivered order and issues partial refund
    await page.goto(`/admin/order-detail.html?orderNumber=${orderNumber}`);
    await expect(page.locator('#orderContent')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#badgeOrderStatus')).toHaveText(/DELIVERED/i, { timeout: 10000 });

    // Open refund modal
    const refundBtn = page.locator('button:has-text("Issue Refund Request")').first();
    await refundBtn.click();
    await expect(page.locator('#refundModal')).toHaveClass(/active/);

    await page.fill('#refundAmount', '5.000');
    await page.fill('#refundReason', 'Customer courtesy partial refund for delayed delivery');
    await page.click('#confirmRefundBtn');

    await expect(page.locator('#refundModal')).not.toHaveClass(/active/, { timeout: 10000 });

    // Step 9: Verify refund record in DB
    const refRes = await pool.query('SELECT amount, status, requested_by_admin_id FROM refunds WHERE order_id = $1', [orderId]);
    expect(refRes.rows.length).toBeGreaterThan(0);
    expect(parseFloat(refRes.rows[0].amount)).toBe(5.000);
    expect(refRes.rows[0].requested_by_admin_id).toBe(1);

    // Step 10: Verify refund history displays the refund
    await expect(page.locator('#refundHistoryBody')).toContainText('5.000', { timeout: 10000 });
  });

});
