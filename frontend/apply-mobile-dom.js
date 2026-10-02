const fs = require('fs');
const files = ['mikyaj-demo/index.html', 'mikyaj-demo/shop.html', 'mikyaj-demo/product.html', 'mikyaj-demo/cart.html'];

const bottomNav = `
<!-- STATIC BOTTOM NAV -->
<nav class="bottom-app-bar mobile-only">
  <a href="index.html" class="nav-item"><span class="material-symbols-outlined icon">home</span><span class="label">Home</span></a>
  <a href="shop.html" class="nav-item"><span class="material-symbols-outlined icon">search</span><span class="label">Shop</span></a>
  <a href="wishlist.html" class="nav-item"><span class="material-symbols-outlined icon">favorite</span><span class="label">Wishlist</span></a>
  <a href="cart.html" class="nav-item">
    <span style="position:relative">
      <span class="material-symbols-outlined icon">shopping_bag</span>
      <span class="cart-badge" id="mobileCartBadge" style="display:none;position:absolute;top:-4px;inset-inline-end:-8px;background:var(--primary);color:var(--on-primary);font-size:10px;width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-weight:bold">0</span>
    </span>
    <span class="label">Cart</span>
  </a>
</nav>`;

const drawer = `
<!-- MOBILE DRAWER & SEARCH -->
<div class="drawer-overlay" id="mobileDrawerOverlay"></div>
<div class="mobile-drawer" id="mobileDrawer">
  <div class="drawer-header" style="display:flex;justify-content:space-between;padding:1rem;border-bottom:1px solid var(--outline-variant)">
    <span class="text-headline-sm">Menu</span>
    <button class="btn-icon" id="closeDrawerBtn"><span class="material-symbols-outlined">close</span></button>
  </div>
  <div class="drawer-content" style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
    <a href="index.html" class="drawer-link">Home</a>
    <a href="shop.html" class="drawer-link">Shop All</a>
    <a href="wishlist.html" class="drawer-link">Wishlist</a>
    <a href="admin/login.html" class="drawer-link">Admin Panel</a>
  </div>
</div>
<div class="search-overlay" id="searchOverlay" style="position:fixed;top:0;left:0;right:0;background:var(--surface);z-index:100;padding:1rem;transform:translateY(-100%);transition:transform 0.3s;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
  <div class="container flex" style="align-items:center;gap:1rem">
    <form style="flex:1;position:relative" action="shop.html" method="GET" class="flex">
      <span class="material-symbols-outlined" style="position:absolute;inset-inline-start:1rem;top:50%;transform:translateY(-50%)">search</span>
      <input type="search" enterkeyhint="search" name="q" class="form-input" placeholder="Search..." style="padding-inline-start:3rem;border-radius:24px;width:100%" autofocus>
    </form>
    <button class="btn-icon" id="closeSearchBtn"><span class="material-symbols-outlined">close</span></button>
  </div>
</div>
`;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (!content.includes('id="mobileDrawer"')) {
    content = content.replace('</header>', '</header>\n' + drawer);
  }
  if (!content.includes('class="bottom-app-bar mobile-only"')) {
    content = content.replace('</body>', bottomNav + '\n</body>');
  }

  // Update footer accordions
  content = content.replace(/<h4 class="text-headline-sm" style="margin-bottom:1rem">/g, '<h4 class="text-headline-sm footer-accordion-toggle" style="margin-bottom:1rem;cursor:pointer">');
  
  fs.writeFileSync(f, content, 'utf8');
});

// Update checkout inputs in cart.html for autocomplete/inputmode
let cartHtml = fs.readFileSync('mikyaj-demo/cart.html', 'utf8');
cartHtml = cartHtml.replace('type="text" id="checkoutName"', 'type="text" id="checkoutName" autocomplete="name" enterkeyhint="next"');
cartHtml = cartHtml.replace('type="tel" id="checkoutPhone"', 'type="tel" id="checkoutPhone" inputmode="tel" autocomplete="tel" enterkeyhint="next"');
cartHtml = cartHtml.replace('type="email" id="checkoutEmail"', 'type="email" id="checkoutEmail" inputmode="email" autocomplete="email" enterkeyhint="next"');
cartHtml = cartHtml.replace('type="text" id="checkoutAddress"', 'type="text" id="checkoutAddress" autocomplete="street-address" enterkeyhint="done"');
fs.writeFileSync('mikyaj-demo/cart.html', cartHtml, 'utf8');

console.log('HTML files heavily patched for phase 5-13.');
