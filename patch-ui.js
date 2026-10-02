const fs = require('fs');
const path = require('path');

const walk = function(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const spaLogoHtml = /<span style="width:36px;height:36px;background:var\(--secondary\);border-radius:50%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:20px;color:var\(--on-secondary\)">spa<\/span><\/span>/g;
const imgLogoHtml = `<img src="/assets/images/logo.png" style="height:36px; object-fit:contain; border-radius: 50%;" alt="Mikyaj">`;

walk('frontend/mikyaj-demo', function(err, results) {
  if (err) throw err;
  
  results.filter(f => f.endsWith('.html')).forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add favicon if not present
    if (!content.includes('rel="icon"')) {
      content = content.replace('</head>', '  <link rel="icon" type="image/png" href="/assets/images/logo.png">\n</head>');
    }
    
    // Replace logo
    content = content.replace(spaLogoHtml, imgLogoHtml);
    
    // Inject watermark wrapper into image logic
    content = content.replace(/p\.primary_image\.url/g, "MikyajAPI.watermark(p.primary_image.url)");
    content = content.replace(/img\.url === product\.primary_image\.url/g, "img.url === product.primary_image.url"); // Ignore this one
    content = content.replace(/MikyajAPI\.watermark\(MikyajAPI\.watermark/g, "MikyajAPI.watermark"); // Deduplicate if ran twice
    
    fs.writeFileSync(file, content);
  });
  
  // Also add MikyajAPI.watermark to api.js
  let apiFile = 'frontend/mikyaj-demo/js/api.js';
  let apiContent = fs.readFileSync(apiFile, 'utf8');
  if (!apiContent.includes('watermark(url)')) {
    const watermarkFunc = `
  watermark(url) {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com/')) return url;
    return url.replace('/image/upload/', '/image/upload/l_mikyaj_logo,w_100,g_north_west,x_20,y_20,o_80/');
  },
  async fetchJson`;
    apiContent = apiContent.replace('async fetchJson', watermarkFunc);
    fs.writeFileSync(apiFile, apiContent);
  }
  
  // Also patch product.html gallery specifically for the main image
  let productHtml = 'frontend/mikyaj-demo/product.html';
  let productContent = fs.readFileSync(productHtml, 'utf8');
  productContent = productContent.replace(/document\.getElementById\('mainProductImage'\)\.src = product\.primary_image\.url;/g, "document.getElementById('mainProductImage').src = MikyajAPI.watermark(product.primary_image.url);");
  fs.writeFileSync(productHtml, productContent);
  
  console.log('UI patched with logo, favicon, and watermarks!');
});
