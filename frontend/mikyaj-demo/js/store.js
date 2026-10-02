/* ═══════════════════════════════════════════════════════════════
   MIKYAJ KUWAIT — LocalStorage Data Store
   All data operations for the demo application
   ═══════════════════════════════════════════════════════════════ */

const MikyajStore = {
  KEYS: {
    PRODUCTS: 'mikyaj_v2_products',
    CATEGORIES: 'mikyaj_v2_categories',
    BRANDS: 'mikyaj_v2_brands',
    ORDERS: 'mikyaj_orders',
    CUSTOMERS: 'mikyaj_customers',
    CART: 'mikyaj_cart',
    WISHLIST: 'mikyaj_wishlist',
    SETTINGS: 'mikyaj_settings',
    ADMIN_AUTH: 'mikyaj_admin_auth'
  },

  // ─── Generic CRUD ─────────────────────────────────────────
  _get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  },
  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  _getObj(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch { return {}; }
  },
  _genId() {
    return 'MKJ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  },

  // ─── PRODUCTS ─────────────────────────────────────────────
  getProducts() { return this._get(this.KEYS.PRODUCTS); },
  getProduct(id) { return this.getProducts().find(p => p.id === id); },
  addProduct(product) {
    const products = this.getProducts();
    product.id = this._genId();
    product.createdAt = new Date().toISOString();
    product.updatedAt = new Date().toISOString();
    products.push(product);
    this._set(this.KEYS.PRODUCTS, products);
    return product;
  },
  updateProduct(id, updates) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx > -1) {
      products[idx] = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
      this._set(this.KEYS.PRODUCTS, products);
      return products[idx];
    }
    return null;
  },
  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this._set(this.KEYS.PRODUCTS, products);
  },
  getProductsByCategory(catId) {
    return this.getProducts().filter(p => p.category === catId);
  },
  getPublishedProducts() {
    return this.getProducts().filter(p => p.published);
  },
  searchProducts(query) {
    const q = query.toLowerCase();
    const categories = this.getCategories();
    return this.getProducts().filter(p => {
      const cat = categories.find(c => c.id === p.category);
      const catName = cat ? cat.name.toLowerCase() : '';
      const catNameAr = cat && cat.nameAr ? cat.nameAr.toLowerCase() : '';
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameAr && p.nameAr.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        catName.includes(q) ||
        catNameAr.includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  },

  // ─── CATEGORIES ───────────────────────────────────────────
  getCategories() { return this._get(this.KEYS.CATEGORIES); },
  getCategory(id) { return this.getCategories().find(c => c.id === id); },
  addCategory(cat) {
    const cats = this.getCategories();
    cat.id = cat.id || this._genId();
    cats.push(cat);
    this._set(this.KEYS.CATEGORIES, cats);
    return cat;
  },
  updateCategory(id, updates) {
    const cats = this.getCategories();
    const idx = cats.findIndex(c => c.id === id);
    if (idx > -1) { cats[idx] = { ...cats[idx], ...updates }; this._set(this.KEYS.CATEGORIES, cats); }
  },
  deleteCategory(id) {
    this._set(this.KEYS.CATEGORIES, this.getCategories().filter(c => c.id !== id));
  },

  // ─── BRANDS ───────────────────────────────────────────────
  getBrands() { return this._get(this.KEYS.BRANDS); },
  getBrand(id) { return this.getBrands().find(b => b.id === id); },
  addBrand(brand) {
    const brands = this.getBrands();
    brand.id = brand.id || this._genId();
    brands.push(brand);
    this._set(this.KEYS.BRANDS, brands);
    return brand;
  },
  updateBrand(id, updates) {
    const brands = this.getBrands();
    const idx = brands.findIndex(b => b.id === id);
    if (idx > -1) { brands[idx] = { ...brands[idx], ...updates }; this._set(this.KEYS.BRANDS, brands); }
  },
  deleteBrand(id) {
    this._set(this.KEYS.BRANDS, this.getBrands().filter(b => b.id !== id));
  },

  // ─── CART ─────────────────────────────────────────────────
  getCart() { return this._get(this.KEYS.CART); },
  addToCart(product, qty = 1, variant = null) {
    const cart = this.getCart();
    // support old productId string and new product object
    const pId = typeof product === 'string' ? product : product.id;
    const existing = cart.find(i => i.productId === pId && i.variant === variant);
    if (existing) {
      existing.qty += qty;
    } else {
      const cartItem = { productId: pId, qty, variant, addedAt: new Date().toISOString() };
      if (typeof product === 'object') {
         cartItem.slug = product.slug;
         cartItem.name = product.name_ar || product.name_en || product.name || 'Product';
         cartItem.price = parseFloat(product.selling_price || product.price || 0);
         cartItem.image = product.primary_image?.url || (product.images ? product.images[0]?.url || product.images[0] : null);
      }
      cart.push(cartItem);
    }
    this._set(this.KEYS.CART, cart);
    return cart;
  },
  updateCartQty(productId, qty, variant = null) {
    const cart = this.getCart();
    const item = cart.find(i => String(i.productId) === String(productId) && (i.variant || null) === (variant || null));
    if (item) { item.qty = Math.max(1, qty); }
    this._set(this.KEYS.CART, cart);
  },
  removeFromCart(productId, variant = null) {
    const cart = this.getCart().filter(i => !(String(i.productId) === String(productId) && (i.variant || null) === (variant || null)));
    this._set(this.KEYS.CART, cart);
  },
  clearCart() { this._set(this.KEYS.CART, []); },
  getCartCount() { return this.getCart().reduce((sum, i) => sum + i.qty, 0); },
  getCartTotal() {
    return this.getCart().reduce((sum, item) => {
      // In Phase 2B, cart item holds its own price for presentation
      const price = item.price !== undefined ? item.price : 0;
      return sum + (price * item.qty);
    }, 0);
  },

  // ─── WISHLIST ─────────────────────────────────────────────
  getWishlist() { return this._get(this.KEYS.WISHLIST); },
  toggleWishlist(productId) {
    let wl = this.getWishlist();
    if (wl.includes(productId)) {
      wl = wl.filter(id => id !== productId);
    } else {
      wl.push(productId);
    }
    this._set(this.KEYS.WISHLIST, wl);
    return wl.includes(productId);
  },
  isInWishlist(productId) { return this.getWishlist().includes(productId); },

  // ─── ORDERS ───────────────────────────────────────────────
  getOrders() { return this._get(this.KEYS.ORDERS); },
  getOrder(id) { return this.getOrders().find(o => o.id === id); },
  addOrder(order) {
    const orders = this.getOrders();
    order.id = 'ORD-' + Date.now().toString().slice(-8);
    order.createdAt = new Date().toISOString();
    order.status = order.status || 'pending';
    orders.unshift(order);
    this._set(this.KEYS.ORDERS, orders);
    return order;
  },
  updateOrderStatus(id, status) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === id);
    if (order) { order.status = status; order.updatedAt = new Date().toISOString(); }
    this._set(this.KEYS.ORDERS, orders);
  },

  // ─── CUSTOMERS ────────────────────────────────────────────
  getCustomers() { return this._get(this.KEYS.CUSTOMERS); },
  addCustomer(customer) {
    const customers = this.getCustomers();
    customer.id = this._genId();
    customer.joinedAt = new Date().toISOString();
    customers.push(customer);
    this._set(this.KEYS.CUSTOMERS, customers);
    return customer;
  },

  // ─── ADMIN AUTH ───────────────────────────────────────────
  adminLogin(user, pass) {
    if (user === 'admin' && pass === 'mikyaj2025') {
      this._set(this.KEYS.ADMIN_AUTH, { loggedIn: true, user: 'admin', loginAt: new Date().toISOString() });
      return true;
    }
    return false;
  },
  isAdminLoggedIn() {
    const auth = this._getObj(this.KEYS.ADMIN_AUTH);
    return auth.loggedIn === true;
  },
  adminLogout() {
    this._set(this.KEYS.ADMIN_AUTH, { loggedIn: false });
  },

  // ─── ANALYTICS HELPERS ────────────────────────────────────
  getTotalRevenue() {
    return this.getOrders().reduce((sum, o) => sum + (o.total || 0), 0);
  },
  getOrdersByStatus(status) {
    return this.getOrders().filter(o => o.status === status);
  },
  getTopProducts(limit = 10) {
    const productSales = {};
    this.getOrders().forEach(order => {
      (order.items || []).forEach(item => {
        if (!productSales[item.productId]) productSales[item.productId] = { qty: 0, revenue: 0 };
        productSales[item.productId].qty += item.qty;
        productSales[item.productId].revenue += item.qty * item.price;
      });
    });
    return Object.entries(productSales)
      .map(([id, data]) => ({ product: this.getProduct(id), ...data }))
      .filter(p => p.product)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },
  getSalesByCategory() {
    const catSales = {};
    this.getOrders().forEach(order => {
      (order.items || []).forEach(item => {
        const product = this.getProduct(item.productId);
        if (product) {
          const cat = product.category || 'Other';
          catSales[cat] = (catSales[cat] || 0) + item.qty * item.price;
        }
      });
    });
    return catSales;
  },
  getRevenueByDay(days = 30) {
    const now = new Date();
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRevenue = this.getOrders()
        .filter(o => o.createdAt && o.createdAt.startsWith(dateStr))
        .reduce((sum, o) => sum + (o.total || 0), 0);
      data.push({ date: dateStr, revenue: dayRevenue });
    }
    return data;
  },

  // ─── FORMAT HELPERS ───────────────────────────────────────
  formatKWD(amount) {
    return (amount || 0).toFixed(3) + ' KWD';
  },

  // ─── SEED CHECK ───────────────────────────────────────────
  isSeeded() {
    return this.getProducts().length > 0;
  }
};
