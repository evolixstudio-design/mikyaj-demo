// e2e/01-customer-checkout.spec.js
const { test, expect } = require('@playwright/test');
const { checkOverflow, attachAuditors, seedTestOrderWithItem } = require('./test-helpers');

test.describe('Phase 4 & Customer Checkout UI & Mobile QA', () => {

  test('TC-CHK-01: Empty cart redirects to cart.html', async ({ page }) => {
    const { consoleErrors } = attachAuditors(page);
    await page.goto('/checkout.html');
    await expect(page).toHaveURL(/cart\.html/);
  });

  test('TC-CHK-02: Checkout page renders cart items, totals, and responsive layout', async ({ page }) => {
    const { consoleErrors, networkRequests } = attachAuditors(page);

    // Pre-populate cart in localStorage before loading
    await page.addInitScript(() => {
      window.localStorage.setItem('mikyaj_cart', JSON.stringify([
        {
          productId: 1,
          name: 'Classic Velvet Lipstick',
          price: 5.250,
          qty: 2,
          image: ''
        },
        {
          productId: 2,
          name: 'Matte Finish Liquid Foundation',
          price: 9.500,
          qty: 1,
          image: ''
        }
      ]));
    });

    await page.goto('/checkout.html');
    await expect(page.locator('h2')).toContainText('Delivery Details');

    // Check items rendered
    const items = page.locator('#checkoutItems');
    await expect(items).toBeVisible();
    await expect(items).toContainText('Classic Velvet Lipstick');
    await expect(items).toContainText('Matte Finish Liquid Foundation');

    // Expected total = (5.250 * 2) + 9.500 = 10.500 + 9.500 = 20.000 KWD
    await expect(page.locator('#summaryTotal')).toHaveText('20.000 KWD');

    // Fill customer fields
    await page.fill('#custName', 'Fatima Al-Sabah');
    await page.fill('#custPhone', '+965 99112233');
    await page.fill('#custEmail', 'fatima@example.com');
    await page.fill('#custAddress', 'Al-Daiya, Block 2, Street 15, House 4');

    // Verify submit button is active
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled();

    // Check responsive overflow
    const overflow = await checkOverflow(page);
    expect(overflow.hasOverflow).toBe(false);

    // Verify no secret exposure in network requests
    networkRequests.forEach(req => {
      expect(req.url).not.toMatch(/api_key|secret|password/i);
    });
  });

  test('TC-CHK-03: Cart is retained on failed/pending order, cleared ONLY on verified success', async ({ page }) => {
    // 1. Seed a PENDING_PAYMENT order in DB
    const { order: pendingOrder } = await seedTestOrderWithItem('PENDING_PAYMENT', '10.500');

    // Setup cart
    await page.addInitScript(() => {
      window.localStorage.setItem('mikyaj_cart', JSON.stringify([
        { productId: 1, name: 'Sample Item', price: 10.500, qty: 1 }
      ]));
    });

    // Visit checkout-result with pending order
    await page.goto(`/checkout-result.html?order=${pendingOrder.order_number}`);
    await expect(page.locator('#errorState')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#errorMsg')).toContainText('has not been paid yet');

    // Check localStorage cart is NOT cleared
    const cartAfterPending = await page.evaluate(() => window.localStorage.getItem('mikyaj_cart'));
    expect(cartAfterPending).not.toBeNull();
    expect(JSON.parse(cartAfterPending).length).toBe(1);

    // 2. Seed a CONFIRMED order in DB
    const { order: confirmedOrder } = await seedTestOrderWithItem('CONFIRMED', '10.500');

    // Visit checkout-result with confirmed order
    await page.goto(`/checkout-result.html?order=${confirmedOrder.order_number}`);
    await expect(page.locator('#successState')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#successOrderRef')).toContainText(confirmedOrder.order_number);

    // Check localStorage cart IS cleared after verified success
    const cartAfterSuccess = await page.evaluate(() => window.localStorage.getItem('mikyaj_cart'));
    expect(cartAfterSuccess).toBe('[]');

    // Check responsive overflow on result page
    const overflow = await checkOverflow(page);
    expect(overflow.hasOverflow).toBe(false);
  });

});
