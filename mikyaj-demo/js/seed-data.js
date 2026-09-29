function seedMikyajData() {
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
