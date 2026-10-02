const { chromium } = require('@playwright/test');

async function run() {
  const browser = await chromium.launch();
  console.log('--- STARTING STOREFRONT UX VERIFICATION ---');

  // 1. Check Shop Page
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/shop.html', { waitUntil: 'networkidle' });
    const productCards = await page.locator('.product-card').count();
    console.log(`[TEST 1] Shop products count: ${productCards}`);
    if (productCards === 0) throw new Error('Shop page is empty!');
    const firstProductName = await page.locator('.product-card .product-name').first().textContent();
    console.log(`[TEST 1] First product name: "${firstProductName.trim()}"`);
    if (firstProductName.includes('@') || firstProductName.includes('`')) {
      console.warn('Warning: product name might have transliteration artifacts');
    }
    await page.close();
  }

  // 2. Check Home Page Categories & Layout
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });
    const catCards = await page.locator('.category-card').count();
    console.log(`[TEST 2] Categories rendered count: ${catCards}`);
    if (catCards === 0) throw new Error('Categories not rendered!');
    const firstCatTitle = await page.locator('.category-card h3').first().textContent();
    console.log(`[TEST 2] First category title: "${firstCatTitle.trim()}"`);

    // Check no settings icon in storefront
    const settingsIcon = await page.locator('header .material-symbols-outlined:has-text("settings")').count();
    console.log(`[TEST 2] Settings icon in header: ${settingsIcon} (expected 0)`);
    if (settingsIcon > 0) throw new Error('Settings icon still visible in storefront header!');

    // Check no Admin link in main nav
    const adminLink = await page.locator('#mainNav a:has-text("Admin")').count();
    console.log(`[TEST 2] Admin link in mainNav: ${adminLink} (expected 0)`);
    if (adminLink > 0) throw new Error('Admin link still visible in storefront nav!');

    await page.close();
  }

  // 3. Check Mobile Viewport & Menu Open/Close & Bottom Nav
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });

    // Check bottom bar has 4 items: Home, Shop, Brands, Cart
    const bottomNavItems = await page.locator('.bottom-app-bar .nav-item').allTextContents();
    console.log('[TEST 3] Bottom nav items:', bottomNavItems.map(t => t.trim()));
    const navText = bottomNavItems.join(' ');
    if (!navText.includes('Home') || !navText.includes('Shop') || !navText.includes('Brands') || !navText.includes('Cart')) {
      throw new Error(`Bottom nav does not have the 4 required buttons! Found: ${navText}`);
    }

    // Open Drawer
    await page.click('#openDrawerBtn');
    await page.waitForTimeout(400);
    const isOpen = await page.locator('#mobileDrawer').evaluate(el => el.classList.contains('open'));
    console.log(`[TEST 3] Drawer opened: ${isOpen}`);
    if (!isOpen) throw new Error('Drawer failed to open!');

    // Close Drawer via close button
    await page.click('#closeDrawerBtn');
    await page.waitForTimeout(400);
    const isClosed = await page.locator('#mobileDrawer').evaluate(el => !el.classList.contains('open'));
    console.log(`[TEST 3] Drawer closed via close button: ${isClosed}`);
    if (!isClosed) throw new Error('Drawer failed to close via close button!');

    // Open and close via overlay
    await page.click('#openDrawerBtn');
    await page.waitForTimeout(400);
    await page.click('#mobileDrawerOverlay', { position: { x: 350, y: 300 } });
    await page.waitForTimeout(400);
    const isClosedOverlay = await page.locator('#mobileDrawer').evaluate(el => !el.classList.contains('open'));
    console.log(`[TEST 3] Drawer closed via overlay: ${isClosedOverlay}`);

    await page.close();
  }

  // 4. Check Language Toggle Switch
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });
    const initialDir = await page.evaluate(() => document.documentElement.getAttribute('dir') || 'ltr');
    console.log(`[TEST 4] Initial dir: ${initialDir}`);

    // Toggle language
    await page.evaluate(() => MikyajApp.toggleLanguage());
    await page.waitForTimeout(1000);
    const toggledDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    console.log(`[TEST 4] Toggled dir: ${toggledDir}`);
    if (toggledDir !== 'rtl') throw new Error('Language toggle did not set RTL!');

    // Toggle back
    await page.evaluate(() => MikyajApp.toggleLanguage());
    await page.waitForTimeout(1000);
    const resetDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    console.log(`[TEST 4] Reset dir: ${resetDir}`);

    await page.close();
  }

  // 5. Check /admin Routing
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
    const heading = await page.locator('h1').textContent();
    console.log(`[TEST 5] /admin heading: "${heading.trim()}"`);
    const hasLoginBtn = await page.locator('#loginBtn').count();
    console.log(`[TEST 5] /admin login button exists: ${hasLoginBtn > 0}`);
    if (hasLoginBtn === 0) throw new Error('/admin did not open login page!');
    await page.close();
  }

  await browser.close();
  console.log('--- ALL STOREFRONT UX TESTS PASSED ---');
}

run().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
