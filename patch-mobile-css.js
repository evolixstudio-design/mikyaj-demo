const fs = require('fs');

// 1. main.css
let mainCss = fs.readFileSync('frontend/mikyaj-demo/css/main.css', 'utf8');
if (!mainCss.includes('mobile.css')) {
  mainCss = mainCss.replace("@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');", "@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');\n@import url('mobile.css');");
  fs.writeFileSync('frontend/mikyaj-demo/css/main.css', mainCss, 'utf8');
  console.log('main.css updated with mobile.css import');
}

// 2. Remove display:none from #openDrawerBtn in html files
['index.html', 'shop.html', 'cart.html', 'product.html'].forEach(f => {
  const p = 'frontend/mikyaj-demo/' + f;
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('display:none;align-items:center;justify-content:center', 'align-items:center;justify-content:center');
  fs.writeFileSync(p, html, 'utf8');
  console.log(f, 'button style updated');
});
