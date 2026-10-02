const fs = require('fs');
const file = 'frontend/mikyaj-demo/shop.html';
let content = fs.readFileSync(file, 'utf8');

const newScript = `<script>
let currentView = 'grid';
let filters = { category: null, brand: null, minPrice: 0, maxPrice: 999, search: '', cursor: null };
let fetchedProducts = [];
let nextCursor = null;
let isFetching = false;
window.__productCache = {}; 

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cat')) filters.category = params.get('cat');
  if (params.get('brand')) filters.brand = params.get('brand');
  if (params.get('q')) filters.search = params.get('q');
  
  MikyajApp.updateCartBadge();
  await initFilters();
  
  const searchForm = document.querySelector('form[action="shop.html"]');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchForm.querySelector('input[name="q"]').value;
      filters.search = q;
      filters.cursor = null;
      document.getElementById('searchOverlay').style.transform = 'translateY(-100%)';
      applyFilters(true);
    });
  }
  applyFilters(true);
});

async function initFilters() {
  const cats = await MikyajAPI.getCategories() || [];
  const brands = await MikyajAPI.getBrands() || [];
  
  document.getElementById('categoryFilters').innerHTML = cats.map(c => \`
    <label class="form-checkbox text-body-sm"><input type="checkbox" value="\${c.slug}" \${filters.category===c.slug?'checked':''} onchange="toggleCatFilter('\${c.slug}')"/> \${c.name_en || c.name_ar}</label>
  \`).join('');

  document.getElementById('brandFilters').innerHTML = brands.slice(0,8).map(b => \`
    <label class="form-checkbox text-body-sm"><input type="checkbox" value="\${b.slug}" \${filters.brand===b.slug?'checked':''} onchange="toggleBrandFilter('\${b.slug}')"/> \${b.name}</label>
  \`).join('');
  
  document.getElementById('concernFilters').innerHTML = ''; 
}

function toggleCatFilter(slug) { filters.category = filters.category === slug ? null : slug; applyFilters(true); }
function toggleBrandFilter(slug) { filters.brand = filters.brand === slug ? null : slug; applyFilters(true); }
function resetFilters() { 
  filters = { category:null, brand:null, minPrice:0, maxPrice:999, search: '', cursor: null }; 
  document.getElementById('priceMin').value = '0';
  document.getElementById('priceMax').value = '999';
  document.getElementById('sortSelect').value='featured';
  initFilters(); 
  applyFilters(true); 
}

async function applyFilters(reset = false) {
  if (isFetching) return;
  isFetching = true;
  if (reset) {
    filters.cursor = null;
    fetchedProducts = [];
    document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading products...</div>';
  }
  filters.minPrice = parseFloat(document.getElementById('priceMin').value) || 0;
  filters.maxPrice = parseFloat(document.getElementById('priceMax').value) || 999;
  
  // Create search URL params explicitly to support array
  const q = new URLSearchParams();
  q.append('limit', 12);
  if (filters.cursor) q.append('cursor', filters.cursor);
  if (filters.category) q.append('category', filters.category);
  if (filters.brand) q.append('brand', filters.brand);
  if (filters.minPrice > 0) q.append('min_price', filters.minPrice);
  if (filters.maxPrice < 999) q.append('max_price', filters.maxPrice);
  if (filters.search) q.append('search', filters.search);

  try {
    const res = await MikyajAPI.fetchJson('/products?' + q.toString());
    if (res && res.products) {
      if (reset) fetchedProducts = [];
      res.products.forEach(p => {
        if (!fetchedProducts.find(fp => fp.id === p.id)) {
          fetchedProducts.push(p);
          window.__productCache[p.id] = p; 
        }
      });
      nextCursor = res.next_cursor;
      
      if (filters.category && res.products.length > 0 && res.products[0].category) {
        document.getElementById('breadcrumbCat').textContent = res.products[0].category.name_en || 'Shop';
        document.getElementById('pageTitle').textContent = res.products[0].category.name_en || 'Shop All';
      } else if (!filters.category) {
         document.getElementById('breadcrumbCat').textContent = 'Shop All';
         document.getElementById('pageTitle').textContent = 'The Prestige Collection';
      }
      document.getElementById('productCount').textContent = fetchedProducts.length + (nextCursor ? '+' : '') + ' Curated Formulas';
      const af = document.getElementById('activeFilters');
      af.innerHTML = '';
      if (filters.category) af.innerHTML += \`<span class="badge badge-outline" style="cursor:pointer" onclick="toggleCatFilter('\${filters.category}')">\${filters.category} ×</span>\`;
      if (filters.brand) af.innerHTML += \`<span class="badge badge-outline" style="cursor:pointer" onclick="toggleBrandFilter('\${filters.brand}')">\${filters.brand} ×</span>\`;
      if (filters.search) af.innerHTML += \`<span class="badge badge-outline" style="cursor:pointer" onclick="filters.search=''; applyFilters(true)">"\${filters.search}" ×</span>\`;
      document.getElementById('showingCount').textContent = \`Showing \${fetchedProducts.length} products\`;
      if (fetchedProducts.length === 0) {
        document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No products found.</div>';
      } else {
        renderShopGrid(fetchedProducts);
      }
      renderPagination();
    } else {
      if (reset) document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No products found.</div>';
      renderPagination();
    }
  } catch(e) {
      console.error(e);
      if (reset) document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--error);">Unable to load products. Try again.</div>';
  } finally {
    isFetching = false;
  }
}

function renderShopGrid(products) {
  const grid = document.getElementById('productsGrid');
  grid.style.gridTemplateColumns = currentView === 'grid' ? 'repeat(3,1fr)' : '1fr';
  grid.innerHTML = products.map(p => {
    const inWL = MikyajStore.isInWishlist(p.id);
    const pName = p.name_en || p.name_ar;
    const pNameAr = p.name_ar || p.name_en || '';
    const pBrand = p.brand ? p.brand.name : '';
    const imgUrl = p.primary_image ? p.primary_image.url : 'https://placehold.co/400x500?text=No+Image';
    const priceStr = MikyajApp.formatKWD(parseFloat(p.selling_price));
    const compStr = parseFloat(p.regular_price) > parseFloat(p.selling_price) ? MikyajApp.formatKWD(parseFloat(p.regular_price)) : '';
    return \`
      <div class="product-card" onclick="if(!event.target.closest('button') && !event.target.closest('a')) window.location.href='product.html?slug=\${p.slug}'" style="cursor:pointer;\${currentView==='list'?'flex-direction:row':''}" >
        <div class="product-image" style="\${currentView==='list'?'width:200px;aspect-ratio:auto':''}">
          <button class="wishlist-btn \${inWL?'active':''}" onclick="MikyajApp.toggleWishlist('\${p.id}',this)"><span class="material-symbols-outlined" style="font-size:18px">favorite</span></button>
          <a href="product.html?slug=\${p.slug}"><img src="\${imgUrl}" alt="\${pName}" loading="lazy" style="width:100%;object-fit:cover;aspect-ratio:1/1"/></a>
          <div class="product-actions"><button class="btn btn-primary btn-sm" style="width:100%" onclick="MikyajApp.addToCart('\${p.id}')"><span class="material-symbols-outlined" style="font-size:16px">shopping_bag</span>Add to Bag</button></div>
        </div>
        <div class="product-info">
          <span class="product-brand">\${pBrand}</span>
          <a href="product.html?slug=\${p.slug}" class="product-name">\${pName}</a>
          <span class="text-body-sm" style="color:var(--on-surface-variant)">\${pNameAr}</span>
          \${p.sku ? \`<span class="text-label-caps" style="color:var(--outline);font-size:9px">SKU: \${p.sku}</span>\` : ''}
          <div class="product-price" style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--outline-variant)">
            <span>\${priceStr} \${compStr ? \`<span class="compare-price">\${compStr}</span>\` : ''}</span>
            <div class="flex gap-xs" style="align-items:center">
              <button class="btn btn-outline btn-sm" style="padding:4px 8px;min-height:28px" onclick="MikyajApp.addToCart('\${p.id}')"><span class="material-symbols-outlined" style="font-size:16px">shopping_bag</span> BAG</button>
            </div>
          </div>
        </div>
      </div>\`;
  }).join('');
}

function renderPagination() {
  const pg = document.getElementById('pagination');
  pg.innerHTML = '';
  if (nextCursor) {
    pg.innerHTML = \`<button class="btn btn-outline btn-sm" onclick="loadMore()">Load More Products</button>\`;
  }
}

function loadMore() {
  if (nextCursor && !isFetching) {
    filters.cursor = nextCursor;
    applyFilters(false);
  }
}

function setView(v) { currentView = v; document.getElementById('gridViewBtn').style.color = v==='grid'?'var(--secondary)':''; document.getElementById('listViewBtn').style.color = v==='list'?'var(--secondary)':''; renderShopGrid(fetchedProducts); }
</script>`;

content = content.replace(/<script>[\s\S]*?<\/script>\s*<script src="js\/mobile\.js\?v=1"><\/script>/, newScript + '\n  <script src="js/mobile.js?v=1"></script>');

fs.writeFileSync(file, content);
console.log('shop.html updated successfully');
