const fs = require('fs');

// 1. Fix main.css hover effects and font-display
let css = fs.readFileSync('mikyaj-demo/css/main.css', 'utf8');

css = css.replace(/(\.btn:hover\s*\{[^}]+\})/g, '@media(hover: hover) {\n$1\n}');
css = css.replace(/(\.product-card:hover\s*\{[^}]+\})/g, '@media(hover: hover) {\n$1\n}');
css = css.replace(/(\.product-card:hover \.product-img\s*\{[^}]+\})/g, '@media(hover: hover) {\n$1\n}');

if(!css.includes('font-display: swap')) {
  css = css.replace(/font-family:\s*'Material Symbols Outlined';/g, "font-family: 'Material Symbols Outlined';\n  font-display: swap;");
}

fs.writeFileSync('mikyaj-demo/css/main.css', css, 'utf8');

// 2. Fix HTML labels, compact header, lazy loading
const files = ['mikyaj-demo/index.html', 'mikyaj-demo/shop.html', 'mikyaj-demo/product.html', 'mikyaj-demo/cart.html'];
files.forEach(f => {
  let html = fs.readFileSync(f, 'utf8');
  
  html = html.replace(/<img([^>]*)>/gi, (match, p1) => {
    if (p1.includes('logo') || p1.includes('lazy')) return match;
    return `<img${p1} loading="lazy">`;
  });

  if (f.includes('cart.html')) {
    html = html.replace(/<label class="text-label-caps"[^>]*>Full Name<\/label>\s*<input([^>]*)id="([^"]+)"/g, '<label for="$2" class="text-label-caps" style="display:block;margin-bottom:0.5rem;color:var(--outline)">Full Name</label>\n  <input$1id="$2"');
    html = html.replace(/<label class="text-label-caps"[^>]*>Phone Number<\/label>\s*<input([^>]*)id="([^"]+)"/g, '<label for="$2" class="text-label-caps" style="display:block;margin-bottom:0.5rem;color:var(--outline)">Phone Number</label>\n  <input$1id="$2"');
    html = html.replace(/<label class="text-label-caps"[^>]*>Email Address<\/label>\s*<input([^>]*)id="([^"]+)"/g, '<label for="$2" class="text-label-caps" style="display:block;margin-bottom:0.5rem;color:var(--outline)">Email Address</label>\n  <input$1id="$2"');
    html = html.replace(/<label class="text-label-caps"[^>]*>Delivery Address<\/label>\s*<textarea([^>]*)id="([^"]+)"/g, '<label for="$2" class="text-label-caps" style="display:block;margin-bottom:0.5rem;color:var(--outline)">Delivery Address</label>\n  <textarea$1id="$2"');
  }

  if (html.includes('<header class="site-header">')) {
    html = html.replace('<header class="site-header">', '<header class="site-header" style="padding-top:env(safe-area-inset-top)">');
  }

  fs.writeFileSync(f, html, 'utf8');
});

console.log('Processed main.css and HTML files');
