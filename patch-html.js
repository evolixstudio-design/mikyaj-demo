const fs = require('fs');
const path = require('path');

const rootFiles = ['index.html','shop.html','product.html','cart.html'];
const adminFiles = ['brands.html','categories.html','customers.html','dashboard.html','erp.html','login.html','orders.html','product-form.html','products.html','reports.html'];

rootFiles.forEach(f => {
  const p = path.join(__dirname, 'mikyaj-demo', f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('catalog-data.js')) {
      content = content.replace('<script src="js/store.js"></script>', '<script src="js/catalog-data.js"></script>\n  <script src="js/store.js"></script>');
      fs.writeFileSync(p, content);
    }
  }
});

adminFiles.forEach(f => {
  const p = path.join(__dirname, 'mikyaj-demo', 'admin', f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('catalog-data.js')) {
      content = content.replace('<script src="../js/store.js"></script>', '<script src="../js/catalog-data.js"></script>\n  <script src="../js/store.js"></script>');
      fs.writeFileSync(p, content);
    }
  }
});
