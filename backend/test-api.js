const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

async function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING PHASE 2A API TESTS ---\n');

  // Test 1: Health
  let res = await fetchJson('/health');
  console.log('Test 1 - /api/health:', res.status === 200 && res.data.status === 'ok' ? 'PASS' : 'FAIL', res.data);

  // Test 2: Categories
  res = await fetchJson('/categories');
  console.log('Test 2 - /api/categories:', res.status === 200 && Array.isArray(res.data) && res.data.length > 0 ? 'PASS' : 'FAIL');

  // Test 3: Brands
  res = await fetchJson('/brands');
  console.log('Test 3 - /api/brands:', res.status === 200 && Array.isArray(res.data) ? 'PASS' : 'FAIL');

  // Test 4: Products limit=5
  res = await fetchJson('/products?limit=5');
  console.log('Test 4 - /api/products?limit=5:', res.status === 200 && res.data.products.length <= 5 ? 'PASS' : 'FAIL');
  
  const page1Ids = res.data.products.map(p => p.id);
  const nextCursor = res.data.next_cursor;
  
  // Test 5: Pagination Cursor
  res = await fetchJson(`/products?limit=5&cursor=${encodeURIComponent(nextCursor)}`);
  const page2Ids = res.data.products.map(p => p.id);
  const duplicates = page1Ids.filter(id => page2Ids.includes(id));
  console.log('Test 5 - Cursor Pagination (No Duplicates):', duplicates.length === 0 ? 'PASS' : 'FAIL');

  // Test 6: Huge limit
  res = await fetchJson('/products?limit=5000');
  console.log('Test 6 - Limit capped:', res.status === 200 && res.data.products.length <= 60 ? 'PASS' : 'FAIL', '(Returned: ' + res.data.products.length + ')');

  // Test 7 & 8: Search
  res = await fetchJson('/products?search=ط');
  console.log('Test 7 & 8 - Arabic Search:', res.status === 200 && res.data.products.length > 0 ? 'PASS' : 'FAIL');

  // Test 9: Category Filter
  res = await fetchJson('/products?category=uncategorized');
  console.log('Test 9 - Category Filter:', res.status === 200 ? 'PASS' : 'FAIL');

  // Test 10: Price Filter
  res = await fetchJson('/products?min_price=1.490&max_price=1.500');
  const allInRange = res.data.products.every(p => parseFloat(p.selling_price) >= 1.490 && parseFloat(p.selling_price) <= 1.500);
  console.log('Test 10 - Price Filter:', res.status === 200 && allInRange ? 'PASS' : 'FAIL');

  // Test 11 & 12: Product Detail & 404
  const firstProductSlug = page1Ids.length > 0 ? res.data.products[0]?.slug : null;
  if (firstProductSlug) {
    res = await fetchJson(`/products/${firstProductSlug}`);
    console.log('Test 11 - Product Detail:', res.status === 200 && res.data.product.id ? 'PASS' : 'FAIL');
  }

  res = await fetchJson('/products/nonexistent-slug');
  console.log('Test 12 - 404 Not Found:', res.status === 404 ? 'PASS' : 'FAIL');

  // Test 13: Invalid Limit
  res = await fetchJson('/products?limit=-5');
  console.log('Test 13 - Invalid limit (400):', res.status === 400 ? 'PASS' : 'FAIL');

  // Test 14: Invalid Price
  res = await fetchJson('/products?min_price=10&max_price=5');
  console.log('Test 14 - Invalid Price range (400):', res.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n--- TESTS COMPLETED ---');
}

runTests();
