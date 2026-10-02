const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'mikyaj-demo/index.html',
  'mikyaj-demo/shop.html',
  'mikyaj-demo/product.html',
  'mikyaj-demo/cart.html',
  'mikyaj-demo/admin/brands.html',
  'mikyaj-demo/admin/categories.html',
  'mikyaj-demo/admin/customers.html',
  'mikyaj-demo/admin/dashboard.html',
  'mikyaj-demo/admin/erp.html',
  'mikyaj-demo/admin/login.html',
  'mikyaj-demo/admin/orders.html',
  'mikyaj-demo/admin/product-form.html',
  'mikyaj-demo/admin/products.html',
  'mikyaj-demo/admin/reports.html'
];

filesToPatch.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  // Inject catalog-data and cache bust
  const v = '?v=3';
  if (f.startsWith('mikyaj-demo/admin/')) {
    content = content.replace('<script src="../js/store.js"></script>', `<script src="../js/catalog-data.js${v}"></script>\n  <script src="../js/store.js${v}"></script>`);
    content = content.replace('<script src="../js/seed-data.js"></script>', `<script src="../js/seed-data.js${v}"></script>`);
    content = content.replace('<script src="../js/app.js"></script>', `<script src="../js/app.js${v}"></script>`);
  } else {
    content = content.replace('<script src="js/store.js"></script>', `<script src="js/catalog-data.js${v}"></script>\n  <script src="js/store.js${v}"></script>`);
    content = content.replace('<script src="js/seed-data.js"></script>', `<script src="js/seed-data.js${v}"></script>`);
    content = content.replace('<script src="js/app.js"></script>', `<script src="js/app.js${v}"></script>`);
  }

  // Wrap images in a tag and add lazy load
  if (['mikyaj-demo/index.html', 'mikyaj-demo/shop.html'].includes(f)) {
    content = content.replace(
      '<img src="${p.images[0]}" alt="${p.name}"/>', 
      '<a href="product.html?id=${p.id}"><img src="${p.images[0]}" alt="${p.name}" loading="lazy" style="width:100%;object-fit:cover;aspect-ratio:1/1"/></a>'
    );
  }

  fs.writeFileSync(p, content, 'utf8');
});
console.log('HTML files patched successfully.');
