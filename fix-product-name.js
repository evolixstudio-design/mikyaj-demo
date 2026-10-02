const fs = require('fs');
let content = fs.readFileSync('frontend/mikyaj-demo/product.html', 'utf8');
content = content.replace(/const pName = product\.name_en \|\| product\.name_ar;/g, "const pName = product.name_en || product.name_ar || 'Unknown Product';");
fs.writeFileSync('frontend/mikyaj-demo/product.html', content);
console.log('Fixed product name fallback in product.html');
