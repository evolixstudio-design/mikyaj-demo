const fs = require('fs');
let seedJs = fs.readFileSync('mikyaj-demo/js/seed-data.js', 'utf8');

// Replace the original seedMikyajData signature
let fallbackContent = seedJs.replace('function seedMikyajData() {', '').replace(/document\.addEventListener\('DOMContentLoaded', seedMikyajData\);/, '');

const newSeedJs = `
async function seedMikyajData() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) {
      console.warn('API not running, falling back to local catalog...');
      return fallbackSeed();
    }
    const products = await res.json();
    
    // Save to store
    MikyajStore._set(MikyajStore.KEYS.PRODUCTS, products);
    console.log('Database synced successfully with Neon!');
    
    // If the UI is already rendered with empty data, we can reload it
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      if (typeof MikyajApp !== 'undefined' && MikyajApp.init) {
        MikyajApp.init();
      } else {
        window.location.reload();
      }
    } else if (window.location.pathname.includes('shop.html') || window.location.pathname.includes('product.html')) {
        window.location.reload();
    }
    
  } catch(e) {
    console.error('Failed to connect to Neon DB API', e);
    fallbackSeed();
  }
}

function fallbackSeed() {
  ${fallbackContent}
}

document.addEventListener('DOMContentLoaded', seedMikyajData);
`;

fs.writeFileSync('mikyaj-demo/js/seed-data.js', newSeedJs, 'utf8');
console.log('Updated seed-data.js');
