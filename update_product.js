const fs = require('fs');
const file = 'frontend/mikyaj-demo/product.html';
let content = fs.readFileSync(file, 'utf8');

const newScript = `<script>
let product = null, qty = 1, selectedShade = null;
window.__productCache = {}; // For cart

document.addEventListener('DOMContentLoaded', async () => {
  const slug = new URLSearchParams(window.location.search).get('slug');
  const id = new URLSearchParams(window.location.search).get('id'); // fallback for older links
  
  if (!slug && !id) {
    document.querySelector('main').innerHTML = '<div class="container" style="padding: 4rem; text-align: center;">Product not found. <a href="shop.html">Return to Shop</a></div>';
    return;
  }

  const searchParam = slug || id; // for now just use slug endpoint, fallback if it matches ID

  try {
    const res = await MikyajAPI.getProduct(searchParam);
    if (res && res.product) {
      product = res.product;
      window.__productCache[product.id] = product;
      renderProduct();
      renderRelated();
    } else {
      throw new Error('Not found');
    }
  } catch (err) {
    document.querySelector('main').innerHTML = '<div class="container" style="padding: 4rem; text-align: center;">Product not found. <a href="shop.html">Return to Shop</a></div>';
  }
  
  MikyajApp.updateCartBadge();
});

function renderProduct() {
  const pName = product.name_en || product.name_ar;
  const pNameAr = product.name_ar || product.name_en || '';
  const pBrand = product.brand ? product.brand.name : '';
  const images = product.images || [];
  if (product.primary_image && !images.find(img => img.url === product.primary_image.url)) {
    images.unshift(product.primary_image);
  }
  
  document.title = pName + ' — Mikyaj Kuwait';
  document.getElementById('breadcrumbName').textContent = pName;
  document.getElementById('productBrand').textContent = pBrand;
  document.getElementById('productName').textContent = pName;
  document.getElementById('productNameAr').textContent = pNameAr;
  
  const mainImg = images.length > 0 ? images[0].url : 'https://placehold.co/400x500?text=No+Image';
  document.getElementById('productMainImg').src = mainImg;
  document.getElementById('productMainImg').alt = pName;
  
  const sellingPrice = parseFloat(product.selling_price);
  const regularPrice = parseFloat(product.regular_price);
  
  document.getElementById('productPrice').textContent = MikyajApp.formatKWD(sellingPrice);
  document.getElementById('productComparePrice').textContent = regularPrice > sellingPrice ? MikyajApp.formatKWD(regularPrice) : '';
  
  if (document.getElementById('volumeDisplay')) {
    document.getElementById('volumeDisplay').parentElement.style.display = 'none'; // API doesn't have volume currently
  }

  // SKU Badges
  const badges = document.getElementById('productBadges');
  if (product.sku) {
    badges.innerHTML += \`<span class="badge badge-secondary" style="font-size: 10px;">SKU: \${product.sku}</span>\`;
  }

  // Thumbnails
  const thumbs = document.getElementById('thumbnails');
  if (images.length > 1) {
    thumbs.innerHTML = '';
    images.forEach((img, i) => {
      thumbs.innerHTML += \`<div style="aspect-ratio:1;overflow:hidden;background:var(--surface-container);border:2px solid \${i===0?'var(--secondary)':'transparent'};cursor:pointer" onclick="document.getElementById('productMainImg').src='\${img.url}';this.parentElement.querySelectorAll('div').forEach(d=>d.style.borderColor='transparent');this.style.borderColor='var(--secondary)'"><img src="\${img.url}" style="width:100%;height:100%;object-fit:cover"/ loading="lazy"></div>\`;
    });
  } else {
    thumbs.style.display = 'none';
  }

  // Cert badges placeholder (can be dynamic if backend supports)
  const certs = document.getElementById('certBadges');
  certs.innerHTML += '<span class="badge badge-outline">100% Authentic</span>';

  // Shades - not currently in Phase 2A schema, hiding
  if (document.getElementById('shadesSection')) {
    document.getElementById('shadesSection').style.display = 'none';
  }

  // Wishlist button
  const inWL = MikyajStore.isInWishlist(product.id);
  document.getElementById('wishlistBtn').className = \`btn \${inWL ? 'btn-secondary' : 'btn-outline'} btn-sm\`;

  // Accordions
  const accs = document.getElementById('accordions');
  const sections = [
    { title: 'Description / الوصف', content: \`<p style="margin-bottom:8px">\${product.short_description_en || product.short_description_ar || ''}</p><p>\${product.short_description_ar || product.short_description_en || ''}</p>\` },
    { title: 'Details / التفاصيل', content: \`<p style="color:var(--on-surface-variant);word-break:break-all">\${product.details_en || product.details_ar || ''}</p>\` },
    { title: 'How to Use / طريقة الاستخدام', content: '<p style="color:var(--on-surface-variant)">Apply a small amount to clean, dry skin. Gently massage in upward motions. Use morning and evening for best results. For external use only.</p>' },
    { title: 'Authentic Kuwait Distributor Guarantee', content: '<p style="color:var(--on-surface-variant)">Every product sold through Mikyaj Kuwait is guaranteed authentic with full batch traceability. Stored in climate-controlled facilities and dispatched with temperature-controlled logistics across Kuwait.</p>' }
  ];
  accs.innerHTML = sections.map((s, i) => \`
    <div style="border-bottom:1px solid var(--outline-variant)">
      <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.chevron').style.transform=this.nextElementSibling.style.display==='none'?'':'rotate(180deg)'" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:1rem;text-align:left;color:var(--on-surface);font-family:var(--font-display);font-size:16px;font-weight:500">
        \${s.title}<span class="material-symbols-outlined chevron" style="transition:transform 0.3s;\${i===0?'transform:rotate(180deg)':''}">expand_more</span>
      </button>
      <div style="padding:0 1rem 1rem;\${i>0?'display:none':''}">\${s.content}</div>
    </div>
  \`).join('');
}

function selectShade(btn, name) {
  selectedShade = name;
  document.getElementById('selectedShadeName').textContent = 'Selected: ' + name;
  document.querySelectorAll('#shadesContainer .shade-dot').forEach(d => { d.classList.remove('active'); d.style.borderColor = 'rgba(255,255,255,0.2)'; });
  btn.classList.add('active'); btn.style.borderColor = 'var(--on-surface)';
}
function changeQty(delta) { qty = Math.max(1, qty + delta); document.getElementById('qtyValue').textContent = qty; }
function addToCartPDP() { for(let i=0;i<qty;i++) MikyajApp.addToCart(product.id, selectedShade); }
function togglePdpWishlist() { MikyajApp.toggleWishlist(product.id); const inWL = MikyajStore.isInWishlist(product.id); document.getElementById('wishlistBtn').className = \`btn \${inWL?'btn-secondary':'btn-outline'} btn-sm\`; }

async function renderRelated() {
  if (!product.category) return;
  const grid = document.getElementById('relatedGrid');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading...</div>';
  try {
    const res = await MikyajAPI.getProducts({ category: product.category.slug, limit: 5 });
    if (res && res.products) {
      let related = res.products.filter(p => p.id !== product.id).slice(0, 4);
      grid.innerHTML = '';
      related.forEach(p => {
        window.__productCache[p.id] = p; // Store in cache for Add to cart
        const pName = p.name_en || p.name_ar;
        const pBrand = p.brand ? p.brand.name : '';
        const imgUrl = p.primary_image ? p.primary_image.url : 'https://placehold.co/400x500?text=No+Image';
        grid.innerHTML += \`
          <div class="product-card">
            <div class="product-image"><img src="\${imgUrl}" alt="\${pName}"/ loading="lazy"><div class="product-actions"><button class="btn btn-primary btn-sm" style="width:100%" onclick="MikyajApp.addToCart('\${p.id}')">Add to Bag</button></div></div>
            <div class="product-info">
              <span class="product-brand">\${pBrand}</span>
              <a href="product.html?slug=\${p.slug}" class="product-name">\${pName}</a>
              <div class="product-price">\${MikyajApp.formatKWD(parseFloat(p.selling_price))}</div>
            </div>
          </div>\`;
      });
    }
  } catch (e) {
    grid.innerHTML = '';
  }
}
</script>`;

content = content.replace(/<script src="js\/catalog-data\.js\?v=1790758685242"><\/script>\s*<script src="js\/store\.js\?v=3"><\/script><script src="js\/seed-data\.js\?v=1790761865252"><\/script><script src="js\/app\.js\?v=3"><\/script>/, '<script src="js/api.js?v=1"></script>\n<script src="js/store.js?v=3"></script>\n<script src="js/app.js?v=3"></script>');
content = content.replace(/<script>[\s\S]*?<\/script>\s*<script src="js\/mobile\.js\?v=1"><\/script>/, newScript + '\n  <script src="js/mobile.js?v=1"></script>');

fs.writeFileSync(file, content);
console.log('product.html updated successfully');
