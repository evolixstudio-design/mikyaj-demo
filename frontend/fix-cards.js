const fs = require('fs');

// 1. Fix product.html logic
let prodHtml = fs.readFileSync('mikyaj-demo/product.html', 'utf8');
prodHtml = prodHtml.replace(
  'if (!product) { product = MikyajStore.getPublishedProducts()[0]; }',
  'if (!product) { console.warn(`Product ${id} not found, falling back`); product = MikyajStore.getPublishedProducts().find(p=>p.id==id) || MikyajStore.getPublishedProducts()[0]; }'
);
fs.writeFileSync('mikyaj-demo/product.html', prodHtml, 'utf8');

// 2. Make cards clickable in JS (app.js)
let idxHtml = fs.readFileSync('mikyaj-demo/index.html', 'utf8');
idxHtml = idxHtml.replace(/<div class="product-card">/g, '<div class="product-card" onclick="if(!event.target.closest(\'button\') && !event.target.closest(\'a\')) window.location.href=\'product.html?id=${p.id}\'" style="cursor:pointer">');
fs.writeFileSync('mikyaj-demo/index.html', idxHtml, 'utf8');

let shopHtml = fs.readFileSync('mikyaj-demo/shop.html', 'utf8');
shopHtml = shopHtml.replace(/<div class="product-card" style="\$\{currentView==='list'\?'flex-direction:row':''\}" >/g, '<div class="product-card" onclick="if(!event.target.closest(\'button\') && !event.target.closest(\'a\')) window.location.href=\'product.html?id=${p.id}\'" style="cursor:pointer;${currentView===\'list\'?\'flex-direction:row\':\'\'}" >');
fs.writeFileSync('mikyaj-demo/shop.html', shopHtml, 'utf8');

console.log('Cards made clickable.');
