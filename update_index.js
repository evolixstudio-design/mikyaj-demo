const fs = require('fs');
const file = 'frontend/mikyaj-demo/index.html';
let content = fs.readFileSync(file, 'utf8');

const newScript = `<script>
window.__productCache = {}; // For cart

document.addEventListener('DOMContentLoaded', async () => {
  // Render Categories
  const cats = await MikyajAPI.getCategories() || [];
  const catNames = { 'cat-skincare':'العناية بالبشرة','cat-makeup':'المكياج','cat-haircare':'العناية بالشعر','cat-bodycare':'العناية بالجسم','cat-fragrance':'العطور','cat-tools':'الأدوات والمجموعات' };
  const catGrid = document.getElementById('categoriesGrid');
  
  if (cats.length > 0) {
    cats.forEach(cat => {
      catGrid.innerHTML += \`
        <a href="shop.html?cat=\${cat.slug}" class="product-card" style="text-decoration:none">
          <div class="product-image"><img src="https://placehold.co/400x400?text=\${cat.name_en}" alt="\${cat.name_en}"/ loading="lazy"></div>
          <div style="padding:1rem;text-align:center">
            <h3 class="text-headline-sm" style="margin-bottom:2px">\${cat.name_en || cat.name_ar}</h3>
            <span class="text-label-caps" style="color:var(--on-surface-variant)">\${cat.name_ar || ''}</span>
          </div>
        </a>\`;
    });
  } else {
    catGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No categories available.</div>';
  }

  // Fetch some products for Best Sellers and New Arrivals
  try {
    const res = await MikyajAPI.getProducts({ limit: 8 });
    if (res && res.products) {
      const all = res.products;
      
      // Render Best Sellers (just using first 4 for demo)
      renderProductGrid(all.slice(0, 4), document.getElementById('bestSellersGrid'));

      // Render New Arrivals (using next 4)
      renderProductGrid(all.slice(4, 8), document.getElementById('newArrivalsGrid'));
    }
  } catch (err) {
     document.getElementById('bestSellersGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Unable to load products.</div>';
  }

  // Render Brands
  const brands = await MikyajAPI.getBrands() || [];
  const brandsRow = document.getElementById('brandsRow');
  if (brands.length > 0) {
    brands.slice(0,6).forEach(b => {
      brandsRow.innerHTML += \`
        <a href="shop.html?brand=\${b.slug}" class="card" style="padding:1rem 2rem;text-align:center;text-decoration:none;min-width:140px">
          <div class="text-headline-sm" style="font-style:italic;margin-bottom:2px">\${b.name.split(' ')[0]}</div>
          <div class="text-body-sm" style="color:var(--on-surface-variant)">\${b.name}</div>
        </a>\`;
    });
  } else {
    brandsRow.innerHTML = '<div style="padding: 2rem; text-align: center; width: 100%;">No brands available.</div>';
  }

  MikyajApp.updateCartBadge();
});

function renderProductGrid(products, container) {
  container.innerHTML = '';
  products.forEach(p => {
    window.__productCache[p.id] = p; // Store in cache for Add to cart
    const inWishlist = MikyajStore.isInWishlist(p.id);
    const pName = p.name_en || p.name_ar;
    const pBrand = p.brand ? p.brand.name : '';
    const imgUrl = p.primary_image ? p.primary_image.url : 'https://placehold.co/400x500?text=No+Image';
    const priceStr = MikyajApp.formatKWD(parseFloat(p.selling_price));
    const compStr = parseFloat(p.regular_price) > parseFloat(p.selling_price) ? MikyajApp.formatKWD(parseFloat(p.regular_price)) : '';

    container.innerHTML += \`
      <div class="product-card" onclick="if(!event.target.closest('button') && !event.target.closest('a')) window.location.href='product.html?slug=\${p.slug}'" style="cursor:pointer">
        <div class="product-image">
          \${p.tags?.includes('bestseller') ? '<span class="product-badge badge badge-primary">Best Seller</span>' : ''}
          <button class="wishlist-btn \${inWishlist?'active':''}" onclick="MikyajApp.toggleWishlist('\${p.id}',this)">
            <span class="material-symbols-outlined" style="font-size:18px">favorite</span>
          </button>
          <a href="product.html?slug=\${p.slug}"><img src="\${imgUrl}" alt="\${pName}" loading="lazy" style="width:100%;object-fit:cover;aspect-ratio:1/1"/></a>
          <div class="product-actions">
            <button class="btn btn-primary btn-sm" style="width:100%" onclick="MikyajApp.addToCart('\${p.id}')">
              <span class="material-symbols-outlined" style="font-size:16px">shopping_bag</span>
              Add to Bag • أضف للحقيبة
            </button>
          </div>
        </div>
        <div class="product-info">
          <span class="product-brand">\${pBrand}</span>
          <a href="product.html?slug=\${p.slug}" class="product-name">\${pName}</a>
          <p class="text-body-sm" style="color:var(--on-surface-variant);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0.75rem">\${p.short_description_en || p.short_description_ar || ''}</p>
          <div class="product-price">
            \${priceStr}
            \${compStr ? \`<span class="compare-price">\${compStr}</span>\` : ''}
          </div>
        </div>
      </div>\`;
  });
}
</script>`;

content = content.replace(/<script src="js\/catalog-data\.js\?v=1790758685241"><\/script>\s*<script src="js\/store\.js\?v=3"><\/script>\s*<script src="js\/seed-data\.js\?v=1790761865250"><\/script>\s*<script src="js\/app\.js\?v=3"><\/script>/, '<script src="js/api.js?v=1"></script>\n<script src="js/store.js?v=3"></script>\n<script src="js/app.js?v=3"></script>');
content = content.replace(/<script>[\s\S]*?<\/script>\s*<script src="js\/mobile\.js\?v=1"><\/script>/, newScript + '\n  <script src="js/mobile.js?v=1"></script>');

fs.writeFileSync(file, content);
console.log('index.html updated successfully');
