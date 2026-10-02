const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const slugify = require('slugify');

const BASE_DIR = __dirname;
const CATALOG_DIR = path.join(BASE_DIR, 'AttarKuwait_Catalog', 'AttarKuwait_Catalog');
const CSV_FILE = path.join(CATALOG_DIR, '_metadata', 'catalog.csv');
const OUT_JS = path.join(BASE_DIR, 'mikyaj-demo', 'js', 'catalog-data.js');
const DEST_IMG_DIR = path.join(BASE_DIR, 'mikyaj-demo', 'assets', 'products');

const categoryMapping = {
  'العناية بالوجه': { id: 'cat-skincare', name: 'Skincare', nameAr: 'العناية بالوجه', image: 'assets/images/product_serum.jpg' },
  'العناية بالشعر': { id: 'cat-haircare', name: 'Hair Care', nameAr: 'العناية بالشعر', image: 'assets/images/product_skincare_set.jpg' },
  'العناية بالجسم': { id: 'cat-bodycare', name: 'Body Care', nameAr: 'العناية بالجسم', image: 'assets/images/product_cream.jpg' },
  'ادوات العنايه': { id: 'cat-tools', name: 'Tools & Sets', nameAr: 'ادوات العنايه', image: 'assets/images/product_eyeshadow.jpg' },
  'العناية الشخصية': { id: 'cat-personal', name: 'Personal Care', nameAr: 'العناية الشخصية', image: 'assets/images/product_cream.jpg' },
  'عطور': { id: 'cat-fragrance', name: 'Fragrance', nameAr: 'عطور', image: 'assets/images/product_perfume.jpg' }
};

if (!fs.existsSync(DEST_IMG_DIR)) {
  fs.mkdirSync(DEST_IMG_DIR, { recursive: true });
}

const csvData = fs.readFileSync(CSV_FILE, 'utf8').replace(/^\uFEFF/, '');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

console.log("First record keys:", Object.keys(records[0] || {}));

const products = [];
const brandsMap = {};
const newCategoriesMap = {};

let missingImageCount = 0;

records.forEach(row => {
  const {
    product_name, category, categories, brand, sku, 
    source_price, regular_price, selling_price, description, 
    product_url, image_count, image_folder
  } = row;

  if (!product_name) return;

  const safeSku = sku || 'NO-SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const slugBase = slugify(product_name, { lower: true, remove: /[*+~.()'"!:@]/g }) || 'product';
  const slug = `${slugBase}-${safeSku}`;
  
  const mappedCat = categoryMapping[category] || { 
    id: 'cat-' + slugify(category || 'uncategorized', { lower: true }), 
    name: category || 'Uncategorized', 
    nameAr: category || 'Uncategorized',
    image: ''
  };
  
  if (!newCategoriesMap[mappedCat.id]) {
    newCategoriesMap[mappedCat.id] = mappedCat;
  }
  
  if (brand) {
    const brandId = 'brand-' + slugify(brand, { lower: true });
    brandsMap[brandId] = { id: brandId, name: brand, country: 'Imported', active: true };
  }

  // Handle images
  const images = [];
  if (image_folder) {
    const sourceFolder = path.join(CATALOG_DIR, image_folder);
    if (fs.existsSync(sourceFolder)) {
      const files = fs.readdirSync(sourceFolder);
      
      const targetFolder = path.join(DEST_IMG_DIR, safeSku);
      if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

      files.forEach(file => {
        if (file.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          const srcPath = path.join(sourceFolder, file);
          const destPath = path.join(targetFolder, file);
          fs.copyFileSync(srcPath, destPath);
          images.push(`assets/products/${safeSku}/${file}`);
        }
      });
    }
  }

  if (images.length > 0 && !newCategoriesMap[mappedCat.id].image) {
    newCategoriesMap[mappedCat.id].image = images[0];
  }

  if (images.length === 0) missingImageCount++;

  const sPrice = parseFloat(selling_price) || 0;
  const rPrice = parseFloat(regular_price) || 0;
  
  const cleanDesc = description ? description.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') : '';

  products.push({
    id: `ATTAR-${safeSku}`,
    name: product_name,
    nameAr: product_name,
    slug: slug,
    brand: brand || null,
    brandId: brand ? 'brand-' + slugify(brand, { lower: true }) : null,
    category: mappedCat.id,
    description: cleanDesc,
    descriptionAr: cleanDesc,
    price: sPrice,
    comparePrice: rPrice > sPrice ? rPrice : null,
    costPrice: 0,
    images: images,
    sku: safeSku,
    stock: 100,
    stockStatus: 'in-stock',
    sourceUrl: product_url,
    published: true,
    featured: false
  });
});

console.log(`Total products imported: ${products.length}`);
console.log(`Categories: ${Object.keys(newCategoriesMap).length}`);
console.log(`Brands: ${Object.keys(brandsMap).length}`);
console.log(`Products with images: ${products.length - missingImageCount}`);
console.log(`Products without images: ${missingImageCount}`);

const outContent = `
window.ATTAR_CATALOG_PRODUCTS = ${JSON.stringify(products, null, 2)};
window.ATTAR_CATALOG_CATEGORIES = ${JSON.stringify(Object.values(newCategoriesMap), null, 2)};
window.ATTAR_CATALOG_BRANDS = ${JSON.stringify(Object.values(brandsMap), null, 2)};
`;

fs.writeFileSync(OUT_JS, outContent);
console.log('Successfully wrote catalog-data.js');
