const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'mikyaj-demo/index.html',
  'mikyaj-demo/shop.html',
  'mikyaj-demo/product.html',
  'mikyaj-demo/cart.html'
];

filesToPatch.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  // Inject CSS
  if (!content.includes('css/mobile.css')) {
    content = content.replace('<link rel="stylesheet" href="css/main.css">', '<link rel="stylesheet" href="css/main.css">\n  <link rel="stylesheet" href="css/mobile.css">');
  }

  // Inject JS
  if (!content.includes('js/mobile.js')) {
    content = content.replace('</body>', '  <script src="js/mobile.js?v=1"></script>\n</body>');
  }

  // Update viewport
  if (!content.includes('viewport-fit=cover')) {
    content = content.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
  }

  fs.writeFileSync(p, content, 'utf8');
});
console.log('Mobile assets injected successfully.');
