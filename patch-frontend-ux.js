const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'frontend/mikyaj-demo');

// 1. PATCH INDEX.HTML
{
  const file = path.join(ROOT, 'index.html');
  let content = fs.readFileSync(file, 'utf8');

  // Replace top bar lang
  content = content.replace(
    /<div class="flex gap-sm" style="align-items:center;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">[\s\S]*?<\/div>(\s*<\/div>\s*<\/div>)/,
    `<div class="flex gap-sm" style="align-items:center;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">
      <button onclick="MikyajApp.toggleLanguage()" style="background:none;border:none;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:4px;padding:2px 6px">
        <span class="lang-indicator-en">EN</span>
        <span style="opacity:0.6">|</span>
        <span class="lang-indicator-ar">العربية</span>
      </button>
      <span style="opacity:0.6;margin-left:8px">|</span>
      <span style="margin-left:8px;letter-spacing:0.15em">KWD</span>
    </div>$1`
  );

  // Header: add hamburger button on mobile, remove Admin link
  content = content.replace(
    /<div class="flex gap-xl" style="align-items:center">\s*<a href="index\.html"/,
    `<div class="flex gap-xl" style="align-items:center">
      <button class="btn-icon mobile-only mobile-menu-btn" id="openDrawerBtn" aria-label="Open Navigation Menu" style="background:none;border:none;color:var(--on-surface);cursor:pointer;display:none;align-items:center;justify-content:center;width:40px;height:40px">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <a href="index.html"`
  );

  content = content.replace(
    /<a href="admin\/login\.html" class="text-label-caps" style="color:var\(--on-surface-variant\)">Admin<\/a>/g,
    ''
  );

  // Mobile drawer: remove Admin Panel, add language switch, proper links
  content = content.replace(
    /<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">[\s\S]*?<\/div>\s*<\/div>/,
    `<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
    <a href="index.html" class="drawer-link">Home / الرئيسية</a>
    <a href="shop.html" class="drawer-link">Shop All / تسوق الكل</a>
    <a href="shop.html?cat=lny-blwjh" class="drawer-link">Skincare / العناية بالبشرة</a>
    <a href="shop.html?cat=lmkyj" class="drawer-link">Makeup / المكياج</a>
    <a href="shop.html?cat=ltwr-wlbkhwr" class="drawer-link">Fragrance / العطور</a>
    <a href="index.html#brandsRow" class="drawer-link">Brands / العلامات التجارية</a>
    <a href="cart.html" class="drawer-link">Shopping Bag / سلة التسوق</a>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--outline-variant)">
      <button class="btn btn-outline btn-sm" onclick="MikyajApp.toggleLanguage()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
        <span class="material-symbols-outlined">translate</span> Switch to العربية / English
      </button>
    </div>
  </div>
</div>`
  );

  // Bottom nav: Home, Shop, Brands, Cart
  content = content.replace(
    /<nav class="bottom-app-bar mobile-only">[\s\S]*?<\/nav>/,
    `<nav class="bottom-app-bar mobile-only">
  <a href="index.html" class="nav-item active"><span class="material-symbols-outlined icon">home</span><span class="label">Home</span></a>
  <a href="shop.html" class="nav-item"><span class="material-symbols-outlined icon">storefront</span><span class="label">Shop</span></a>
  <a href="index.html#brandsRow" class="nav-item"><span class="material-symbols-outlined icon">verified</span><span class="label">Brands</span></a>
  <a href="cart.html" class="nav-item">
    <span style="position:relative;display:inline-flex">
      <span class="material-symbols-outlined icon">shopping_bag</span>
      <span class="cart-badge" id="mobileCartBadge" style="display:none;position:absolute;top:-4px;inset-inline-end:-8px;background:var(--secondary);color:var(--on-secondary);font-size:10px;width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold">0</span>
    </span>
    <span class="label">Cart</span>
  </a>
</nav>`
  );

  // Category rendering script & product formatting
  const categoryScriptReplacement = `// Category icons map
  const categoryIcons = {
    'ltwr-wlbkhwr': 'local_florist',
    'lmkyj': 'brush',
    'lny-blwjh': 'spa',
    'lny-blshr': 'content_cut',
    'lny-bljsm': 'clean_hands',
    'lktrwnyt': 'devices',
    'lzywt': 'water_drop',
    'twnr-wsyrwm': 'science',
    'bkyjt': 'redeem',
    'zfr': 'back_hand',
    'dwt-lnyh': 'auto_fix_high',
    'dwt-wksswrt-lshr': 'styler',
    'lny-blyn-wlhwjb': 'visibility',
    'lny-blydyn-wlqdm': 'do_not_step',
    'lny-blfm-wlsnn': 'sentiment_very_satisfied',
    'lny-lshkhsy': 'self_improvement',
    'lshb-wlbwdrt': 'eco',
    'tkhsys': 'fitness_center',
    'lsh-wlfy': 'favorite',
    'jmy-lmntjt': 'grid_view',
    'uncategorized': 'category'
  };

  // Render Categories
  const cats = await MikyajAPI.getCategories() || [];
  const catGrid = document.getElementById('categoriesGrid');
  const isAr = (localStorage.getItem('mikyaj_lang') || 'en') === 'ar';
  
  if (cats.length > 0) {
    cats.forEach(cat => {
      const icon = categoryIcons[cat.slug] || 'category';
      const title = isAr ? (cat.name_ar || cat.name_en) : (cat.name_en || cat.name_ar);
      const sub = isAr ? (cat.name_en || '') : (cat.name_ar || '');
      catGrid.innerHTML += \`
        <a href="shop.html?cat=\${cat.slug}" class="category-card" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;padding:1.5rem 1rem;background:var(--surface-container-low);border:1px solid var(--outline-variant);border-radius:12px;transition:all 0.25s ease;text-align:center">
          <div style="width:54px;height:54px;border-radius:50%;background:var(--surface-container-high);display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem;color:var(--secondary);border:1px solid var(--outline-variant)">
            <span class="material-symbols-outlined" style="font-size:28px">\${icon}</span>
          </div>
          <h3 class="text-headline-sm" style="font-size:14px;font-weight:600;margin-bottom:3px;color:var(--on-surface)">\${title}</h3>
          <span class="text-label-caps" style="font-size:11px;color:var(--secondary)">\${sub}</span>
        </a>\`;
    });
  } else {
    catGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No categories available.</div>';
  }`;

  content = content.replace(/\/\/ Render Categories[\s\S]*?catGrid\.innerHTML = '<div style="grid-column: 1\/-1; text-align: center; padding: 2rem;">No categories available\.<\/div>';\s*}/, categoryScriptReplacement);

  // In renderProductGrid, use MikyajApp.formatProductName
  content = content.replace(
    /const pName = p\.name_en \|\| p\.name_ar;/,
    `const pName = MikyajApp.formatProductName(p);
    const pSubtitle = MikyajApp.formatProductSubtitle(p);`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] index.html updated');
}

// 2. PATCH SHOP.HTML
{
  const file = path.join(ROOT, 'shop.html');
  let content = fs.readFileSync(file, 'utf8');

  // Top bar language toggle
  content = content.replace(
    /<span class="text-label-caps" style="font-size:10px">EN \| العربية \| KWD<\/span>/,
    `<button onclick="MikyajApp.toggleLanguage()" style="background:none;border:none;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:4px;padding:2px 6px">
      <span class="lang-indicator-en">EN</span>
      <span style="opacity:0.6">|</span>
      <span class="lang-indicator-ar">العربية</span>
    </button>
    <span style="opacity:0.6;margin-left:8px">|</span>
    <span style="margin-left:8px;letter-spacing:0.15em">KWD</span>`
  );

  // Add hamburger in header on mobile
  content = content.replace(
    /<div class="flex gap-xl" style="align-items:center">\s*<a href="index\.html"/,
    `<div class="flex gap-xl" style="align-items:center">
      <button class="btn-icon mobile-only mobile-menu-btn" id="openDrawerBtn" aria-label="Open Navigation Menu" style="background:none;border:none;color:var(--on-surface);cursor:pointer;display:none;align-items:center;justify-content:center;width:40px;height:40px">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <a href="index.html"`
  );

  // Remove Admin links
  content = content.replace(
    /<a href="admin\/login\.html" class="text-label-caps" style="color:var\(--on-surface-variant\)">Admin<\/a>/g,
    ''
  );
  content = content.replace(
    /<a href="admin\/login\.html">Admin<\/a>/g,
    ''
  );

  // Mobile drawer
  content = content.replace(
    /<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">[\s\S]*?<\/div>\s*<\/div>/,
    `<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
    <a href="index.html" class="drawer-link">Home / الرئيسية</a>
    <a href="shop.html" class="drawer-link">Shop All / تسوق الكل</a>
    <a href="index.html#brandsRow" class="drawer-link">Brands / العلامات التجارية</a>
    <a href="cart.html" class="drawer-link">Shopping Bag / سلة التسوق</a>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--outline-variant)">
      <button class="btn btn-outline btn-sm" onclick="MikyajApp.toggleLanguage()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
        <span class="material-symbols-outlined">translate</span> Switch to العربية / English
      </button>
    </div>
  </div>
</div>`
  );

  // Bottom nav: Home, Shop, Brands, Cart
  content = content.replace(
    /<nav class="bottom-app-bar mobile-only">[\s\S]*?<\/nav>/,
    `<nav class="bottom-app-bar mobile-only">
  <a href="index.html" class="nav-item"><span class="material-symbols-outlined icon">home</span><span class="label">Home</span></a>
  <a href="shop.html" class="nav-item active"><span class="material-symbols-outlined icon">storefront</span><span class="label">Shop</span></a>
  <a href="shop.html#brandFilters" class="nav-item"><span class="material-symbols-outlined icon">verified</span><span class="label">Brands</span></a>
  <a href="cart.html" class="nav-item">
    <span style="position:relative;display:inline-flex">
      <span class="material-symbols-outlined icon">shopping_bag</span>
      <span class="cart-badge" id="mobileCartBadge" style="display:none;position:absolute;top:-4px;inset-inline-end:-8px;background:var(--secondary);color:var(--on-secondary);font-size:10px;width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold">0</span>
    </span>
    <span class="label">Cart</span>
  </a>
</nav>`
  );

  // Product name formatting in shop grid
  content = content.replace(
    /const pName = p\.name_en \|\| p\.name_ar;\s*const pNameAr = p\.name_ar \|\| p\.name_en \|\| '';/,
    `const pName = MikyajApp.formatProductName(p);
    const pNameAr = MikyajApp.formatProductSubtitle(p);`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] shop.html updated');
}

// 3. PATCH CART.HTML
{
  const file = path.join(ROOT, 'cart.html');
  let content = fs.readFileSync(file, 'utf8');

  // Top bar language toggle
  content = content.replace(
    /<span class="text-label-caps" style="font-size:10px">EN \| العربية \| KWD<\/span>/,
    `<button onclick="MikyajApp.toggleLanguage()" style="background:none;border:none;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:4px;padding:2px 6px">
      <span class="lang-indicator-en">EN</span>
      <span style="opacity:0.6">|</span>
      <span class="lang-indicator-ar">العربية</span>
    </button>
    <span style="opacity:0.6;margin-left:8px">|</span>
    <span style="margin-left:8px;letter-spacing:0.15em">KWD</span>`
  );

  // Header: add hamburger button on mobile
  content = content.replace(
    /<div class="flex gap-xl" style="align-items:center">\s*<a href="index\.html"/,
    `<div class="flex gap-xl" style="align-items:center">
      <button class="btn-icon mobile-only mobile-menu-btn" id="openDrawerBtn" aria-label="Open Navigation Menu" style="background:none;border:none;color:var(--on-surface);cursor:pointer;display:none;align-items:center;justify-content:center;width:40px;height:40px">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <a href="index.html"`
  );

  // Mobile drawer: remove Admin Panel, add language switch
  content = content.replace(
    /<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">[\s\S]*?<\/div>\s*<\/div>/,
    `<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
    <a href="index.html" class="drawer-link">Home / الرئيسية</a>
    <a href="shop.html" class="drawer-link">Shop All / تسوق الكل</a>
    <a href="index.html#brandsRow" class="drawer-link">Brands / العلامات التجارية</a>
    <a href="cart.html" class="drawer-link">Shopping Bag / سلة التسوق</a>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--outline-variant)">
      <button class="btn btn-outline btn-sm" onclick="MikyajApp.toggleLanguage()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
        <span class="material-symbols-outlined">translate</span> Switch to العربية / English
      </button>
    </div>
  </div>
</div>`
  );

  // Bottom nav: Home, Shop, Brands, Cart
  content = content.replace(
    /<nav class="bottom-app-bar mobile-only">[\s\S]*?<\/nav>/,
    `<nav class="bottom-app-bar mobile-only">
  <a href="index.html" class="nav-item"><span class="material-symbols-outlined icon">home</span><span class="label">Home</span></a>
  <a href="shop.html" class="nav-item"><span class="material-symbols-outlined icon">storefront</span><span class="label">Shop</span></a>
  <a href="index.html#brandsRow" class="nav-item"><span class="material-symbols-outlined icon">verified</span><span class="label">Brands</span></a>
  <a href="cart.html" class="nav-item active">
    <span style="position:relative;display:inline-flex">
      <span class="material-symbols-outlined icon">shopping_bag</span>
      <span class="cart-badge" id="mobileCartBadge" style="display:none;position:absolute;top:-4px;inset-inline-end:-8px;background:var(--secondary);color:var(--on-secondary);font-size:10px;width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold">0</span>
    </span>
    <span class="label">Cart</span>
  </a>
</nav>`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] cart.html updated');
}

// 4. PATCH PRODUCT.HTML
{
  const file = path.join(ROOT, 'product.html');
  let content = fs.readFileSync(file, 'utf8');

  // Top bar language toggle
  content = content.replace(
    /<span class="text-label-caps" style="font-size:10px">EN \| العربية \| KWD<\/span>/,
    `<button onclick="MikyajApp.toggleLanguage()" style="background:none;border:none;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:4px;padding:2px 6px">
      <span class="lang-indicator-en">EN</span>
      <span style="opacity:0.6">|</span>
      <span class="lang-indicator-ar">العربية</span>
    </button>
    <span style="opacity:0.6;margin-left:8px">|</span>
    <span style="margin-left:8px;letter-spacing:0.15em">KWD</span>`
  );

  // Header: add hamburger button on mobile
  content = content.replace(
    /<div class="flex gap-xl" style="align-items:center">\s*<a href="index\.html"/,
    `<div class="flex gap-xl" style="align-items:center">
      <button class="btn-icon mobile-only mobile-menu-btn" id="openDrawerBtn" aria-label="Open Navigation Menu" style="background:none;border:none;color:var(--on-surface);cursor:pointer;display:none;align-items:center;justify-content:center;width:40px;height:40px">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <a href="index.html"`
  );

  // Mobile drawer: remove Admin Panel, add language switch
  content = content.replace(
    /<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">[\s\S]*?<\/div>\s*<\/div>/,
    `<div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
    <a href="index.html" class="drawer-link">Home / الرئيسية</a>
    <a href="shop.html" class="drawer-link">Shop All / تسوق الكل</a>
    <a href="index.html#brandsRow" class="drawer-link">Brands / العلامات التجارية</a>
    <a href="cart.html" class="drawer-link">Shopping Bag / سلة التسوق</a>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--outline-variant)">
      <button class="btn btn-outline btn-sm" onclick="MikyajApp.toggleLanguage()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
        <span class="material-symbols-outlined">translate</span> Switch to العربية / English
      </button>
    </div>
  </div>
</div>`
  );

  // Bottom nav: Home, Shop, Brands, Cart
  content = content.replace(
    /<nav class="bottom-app-bar mobile-only">[\s\S]*?<\/nav>/,
    `<nav class="bottom-app-bar mobile-only">
  <a href="index.html" class="nav-item"><span class="material-symbols-outlined icon">home</span><span class="label">Home</span></a>
  <a href="shop.html" class="nav-item"><span class="material-symbols-outlined icon">storefront</span><span class="label">Shop</span></a>
  <a href="index.html#brandsRow" class="nav-item"><span class="material-symbols-outlined icon">verified</span><span class="label">Brands</span></a>
  <a href="cart.html" class="nav-item">
    <span style="position:relative;display:inline-flex">
      <span class="material-symbols-outlined icon">shopping_bag</span>
      <span class="cart-badge" id="mobileCartBadge" style="display:none;position:absolute;top:-4px;inset-inline-end:-8px;background:var(--secondary);color:var(--on-secondary);font-size:10px;width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold">0</span>
    </span>
    <span class="label">Cart</span>
  </a>
</nav>`
  );

  // Product name formatting in details
  content = content.replace(
    /const pName = product\.name_en \|\| product\.name_ar \|\| 'Unknown Product';\s*const pNameAr = product\.name_ar \|\| product\.name_en \|\| '';/,
    `const pName = MikyajApp.formatProductName(product);
    const pNameAr = MikyajApp.formatProductSubtitle(product);`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] product.html updated');
}

console.log('All storefront pages successfully patched.');
