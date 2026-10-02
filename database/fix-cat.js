const fs = require('fs');
let code = fs.readFileSync('mikyaj-demo/js/catalog-data.js', 'utf8');
code = code.replace(/nameAr:\s*['"]الصحة والعافية['"],\s*image:\s*['"]["']/g, "nameAr: 'الصحة والعافية',\n    image: 'assets/images/product_skincare_set.webp'");
fs.writeFileSync('mikyaj-demo/js/catalog-data.js', code);
console.log('Fixed category image');
