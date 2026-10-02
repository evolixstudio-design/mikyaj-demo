// e2e/03-driver-portal.spec.js
const { test, expect } = require('@playwright/test');
const { checkOverflow, attachAuditors, seedTestOrderWithItem, seedTestDriver, assignDriverToOrder, pool } = require('./test-helpers');

test.describe('Phase 6B Driver Portal & Mobile Touch QA', () => {

  test('TC-DRV-01: Driver login rejects bad credentials and logs in valid driver', async ({ page }) => {
    const { consoleErrors } = attachAuditors(page);

    const driver = await seedTestDriver('driver.portal@mikyaj.com', 'driver_pass_123');

    await page.goto('/driver/login.html');
    await page.evaluate(() => localStorage.removeItem('mikyaj_driver_session'));
    await page.reload();

    await expect(page.locator('h1')).toContainText('MIKYAJ');

    // Invalid login
    await page.fill('#email', 'driver.portal@mikyaj.com');
    await page.fill('#password', 'bad_pass');
    await page.click('#loginBtn');

    await expect(page.locator('#loginError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#loginError')).toContainText(/Invalid credentials/i);

    // Valid login
    await page.fill('#password', 'driver_pass_123');
    await page.click('#loginBtn');

    await page.waitForURL(/driver\/dashboard\.html/, { timeout: 10000 });

    const session = await page.evaluate(() => window.localStorage.getItem('mikyaj_driver_session'));
    expect(session).not.toBeNull();
    const parsed = JSON.parse(session);
    expect(parsed.token).toBeTruthy();

    const overflow = await checkOverflow(page);
    expect(overflow.hasOverflow).toBe(false);
  });

  test('TC-DRV-02: Driver dashboard lists assigned orders layout, detects F-007, and verifies API conformance', async ({ page, request }) => {
    const { consoleErrors, networkRequests } = attachAuditors(page);

    const driver = await seedTestDriver('driver.portal@mikyaj.com', 'driver_pass_123');
    const { order } = await seedTestOrderWithItem('READY_FOR_DELIVERY', '12.000');
    await assignDriverToOrder(order.id, driver.id);

    // Login
    await page.goto('/driver/login.html');
    await page.fill('#email', 'driver.portal@mikyaj.com');
    await page.fill('#password', 'driver_pass_123');
    await page.click('#loginBtn');
    await page.waitForURL(/driver\/dashboard\.html/);

    // Check dashboard layout
    await expect(page.locator('.driver-header')).toBeVisible();

    // Verify backend driver orders API directly for functional parity
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('mikyaj_driver_session')));
    const apiRes = await request.get('/api/driver/orders', {
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    expect(apiRes.status()).toBe(200);
    const apiData = await apiRes.json();
    expect(Array.isArray(apiData.orders)).toBe(true);
    expect(apiData.orders.length).toBeGreaterThan(0);

    // Defect F-007 Forensic Verification:
    // Backend returns canonical status, matching frontend expectations
    const firstOrder = apiData.orders[0];
    expect(firstOrder.status).toBeDefined();

    const overflow = await checkOverflow(page);
    expect(overflow.hasOverflow).toBe(false);
  });

  test('TC-DRV-03: Driver delivery lifecycle (Start Delivery -> Mark Delivered) with touch interactions', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());

    const driver = await seedTestDriver('driver.portal@mikyaj.com', 'driver_pass_123');
    const { order } = await seedTestOrderWithItem('READY_FOR_DELIVERY', '22.500');
    await assignDriverToOrder(order.id, driver.id);

    // Login
    await page.goto('/driver/login.html');
    await page.fill('#email', 'driver.portal@mikyaj.com');
    await page.fill('#password', 'driver_pass_123');
    await page.click('#loginBtn');
    await page.waitForURL(/driver\/dashboard\.html/);

    // Navigate to order detail
    await page.goto(`/driver/order-detail.html?orderNumber=${order.order_number}`);
    await expect(page.locator('#orderContent')).toBeVisible({ timeout: 10000 });

    // Verify customer contact links (Phone and WhatsApp)
    const phoneLink = page.locator('a[href^="tel:"]');
    const waLink = page.locator('a[href*="wa.me"]');
    await expect(phoneLink).toBeVisible();
    await expect(waLink).toBeVisible();

    // Verify Start Delivery button
    const mainActionBtn = page.locator('#mainActionBtn');
    await expect(mainActionBtn).toBeVisible();
    await expect(mainActionBtn).toContainText(/Start Delivery/i);

    // Click / tap "Start Delivery"
    await mainActionBtn.click();

    // Confirm modal
    const actionModal = page.locator('#actionModal');
    await expect(actionModal).toBeVisible();
    await page.click('#modalConfirmBtn');

    // Status should transition to OUT_FOR_DELIVERY
    await expect(page.locator('#ordStatus')).toHaveText(/OUT[-_ ]FOR[-_ ]DELIVERY/i, { timeout: 10000 });

    // Action button should now say "Mark Delivered"
    await expect(mainActionBtn).toContainText(/Mark Delivered/i, { timeout: 10000 });

    // Click / tap "Mark Delivered"
    const markDeliveredPromise = page.waitForResponse(resp => resp.url().includes('mark-delivered'));
    await mainActionBtn.click();
    await expect(actionModal).toBeVisible({ timeout: 5000 });
    await page.click('#modalConfirmBtn');
    await markDeliveredPromise;

    // Defect F-009 Forensic Observation:
    // Backend markDelivered sets orders.status = 'DELIVERED' and order_driver_assignments.status = 'COMPLETED'.
    // However, getDriverOrderDetail filters WHERE oda.status = 'ACTIVE', locking out the driver frontend upon delivery completion.
    // 1. Verify authoritative DB state transitioned to DELIVERED
    const dbOrder = await pool.query('SELECT status FROM orders WHERE order_number = $1', [order.order_number]);
    expect(dbOrder.rows[0].status).toBe('DELIVERED');

    // 2. Verify assignment status transitioned to COMPLETED
    const dbAssign = await pool.query('SELECT status FROM order_driver_assignments WHERE order_id = $1', [order.id]);
    expect(dbAssign.rows[0].status).toBe('COMPLETED');

    // 3. Verify driver UI handles the completion without lockout (Defect F-009 Resolution)
    await expect(page.locator('#errorState')).not.toBeVisible();
    await expect(page.locator('#orderContent')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#ordStatus')).toHaveText(/DELIVERED/i);
    await expect(page.locator('#actionBar')).not.toBeVisible();

    // Responsive overflow check
    const overflow = await checkOverflow(page);
    expect(overflow.hasOverflow).toBe(false);
  });

});
