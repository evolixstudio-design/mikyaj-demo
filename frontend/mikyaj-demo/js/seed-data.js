
async function seedMikyajData() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) {
      console.warn('API not running, falling back to local catalog...');
      return fallbackSeed();
    }
    const products = await res.json();
    
    // Save to store
    // Save to store
    MikyajStore._set(MikyajStore.KEYS.PRODUCTS, products);
    
    // Also seed categories and brands from local catalog since API only returns products
    if (window.ATTAR_CATALOG_CATEGORIES && MikyajStore.getCategories().length === 0) {
      window.ATTAR_CATALOG_CATEGORIES.forEach(c => MikyajStore.addCategory(c));
    }
    if (window.ATTAR_CATALOG_BRANDS && MikyajStore.getBrands().length === 0) {
      window.ATTAR_CATALOG_BRANDS.forEach(b => MikyajStore.addBrand(b));
    }
    
    console.log('Database synced successfully with Neon!');
    
    // Re-render UI after syncing to avoid cache issues
    if (typeof MikyajApp !== 'undefined') {
      if (window.location.pathname.includes('shop.html')) {
        const grid = document.getElementById('shopGrid');
        if (grid) MikyajApp.renderShopGrid(MikyajStore.getPublishedProducts(), grid);
      } else if (window.location.pathname.includes('product.html')) {
        if (typeof renderProduct === 'function') renderProduct();
      } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        if (MikyajApp.init) MikyajApp.init();
        if (typeof renderProductGrid === 'function') {
          const all = MikyajStore.getPublishedProducts();
          const featured = all.filter(p => p.featured);
          const bsGrid = document.getElementById('bestSellersGrid');
          const naGrid = document.getElementById('newArrivalsGrid');
          if (bsGrid) renderProductGrid(featured.slice(0, 4), bsGrid);
          if (naGrid) renderProductGrid(all.slice(0, 4), naGrid);
        }
      }
    }
  } catch(e) {
    console.error('Failed to connect to Neon DB API', e);
    fallbackSeed();
  }
}

function fallbackSeed() {
  
  // Force reseed if the old demo product "prod-001" exists
  const needsReseed = !MikyajStore.isSeeded() || MikyajStore.getProduct('prod-001') !== null;
  if (!needsReseed) return;

  localStorage.removeItem(MikyajStore.KEYS.PRODUCTS);
  localStorage.removeItem(MikyajStore.KEYS.CATEGORIES);
  localStorage.removeItem(MikyajStore.KEYS.BRANDS);

  const categories = [];
  if (window.ATTAR_CATALOG_CATEGORIES) categories.push(...window.ATTAR_CATALOG_CATEGORIES);
  categories.forEach(c => MikyajStore.addCategory(c));

  const brands = [];
  if (window.ATTAR_CATALOG_BRANDS) brands.push(...window.ATTAR_CATALOG_BRANDS);
  brands.forEach(b => MikyajStore.addBrand(b));

  const products = [];
  if (window.ATTAR_CATALOG_PRODUCTS) products.push(...window.ATTAR_CATALOG_PRODUCTS);

  products.forEach(p => {
    p.createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    p.updatedAt = new Date().toISOString();
    const existing = MikyajStore.getProducts();
    existing.push(p);
    localStorage.setItem(MikyajStore.KEYS.PRODUCTS, JSON.stringify(existing));
  });

  const customers = [
    { name: 'Fatima Al-Sabah', email: 'fatima@example.kw', phone: '+965 9912 3456', region: 'Capital', orders: 12, totalSpent: 245.500 },
    { name: 'Noura Al-Rashidi', email: 'noura@example.kw', phone: '+965 9923 4567', region: 'Hawalli', orders: 8, totalSpent: 178.250 }
  ];
  customers.forEach(c => MikyajStore.addCustomer(c));

  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const paymentMethods = ['KNET', 'Visa', 'Mastercard', 'MyFatoorah', 'COD', 'Apple Pay'];
  
  if (products.length > 0) {
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const numItems = Math.floor(Math.random() * 3) + 1;
      const items = [];
      let total = 0;

      for (let j = 0; j < numItems; j++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        items.push({ productId: prod.id, name: prod.name, qty, price: prod.price, image: prod.images[0] });
        total += prod.price * qty;
      }

      const customer = customers[Math.floor(Math.random() * customers.length)];
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - daysAgo);
      orderDate.setHours(Math.floor(Math.random() * 14) + 8);

      MikyajStore.addOrder({
        customer: customer.name,
        email: customer.email,
        region: customer.region,
        items,
        total: Math.round(total * 1000) / 1000,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        createdAt: orderDate.toISOString(),
        shippingAddress: `Block ${Math.floor(Math.random() * 12) + 1}, Street 1, ${customer.region}, Kuwait`,
        notes: ''
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', seedMikyajData);
