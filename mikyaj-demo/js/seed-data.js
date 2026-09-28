/* ═══════════════════════════════════════════════════════════════
   MIKYAJ KUWAIT — Demo Seed Data
   Pre-populates the store with realistic cosmetic products
   ═══════════════════════════════════════════════════════════════ */

function seedMikyajData() {
  if (MikyajStore.isSeeded()) return;

  // ─── CATEGORIES ────────────────────────────────────────────
  const categories = [
    { id: 'cat-skincare', name: 'Skincare', nameAr: 'العناية بالبشرة', image: 'assets/images/product_serum.jpg', order: 1 },
    { id: 'cat-makeup', name: 'Makeup', nameAr: 'المكياج', image: 'assets/images/product_lipstick.jpg', order: 2 },
    { id: 'cat-haircare', name: 'Hair Care', nameAr: 'العناية بالشعر', image: 'assets/images/product_skincare_set.jpg', order: 3 },
    { id: 'cat-bodycare', name: 'Body Care', nameAr: 'العناية بالجسم', image: 'assets/images/product_cream.jpg', order: 4 },
    { id: 'cat-fragrance', name: 'Fragrance', nameAr: 'العطور', image: 'assets/images/product_perfume.jpg', order: 5 },
    { id: 'cat-tools', name: 'Tools & Sets', nameAr: 'الأدوات والمجموعات', image: 'assets/images/product_eyeshadow.jpg', order: 6 }
  ];
  categories.forEach(c => MikyajStore.addCategory(c));

  // ─── BRANDS ────────────────────────────────────────────────
  const brands = [
    { id: 'brand-clarins', name: 'Clarins Paris', country: 'France', active: true },
    { id: 'brand-laneige', name: 'Laneige', country: 'South Korea', active: true },
    { id: 'brand-dr-althea', name: 'Dr. Althea Seoul', country: 'South Korea', active: true },
    { id: 'brand-cosrx', name: 'COSRX', country: 'South Korea', active: true },
    { id: 'brand-acm', name: 'ACM Laboratoire', country: 'France', active: true },
    { id: 'brand-beauty-joseon', name: 'Beauty of Joseon', country: 'South Korea', active: true },
    { id: 'brand-anua', name: 'Anua Heartleaf', country: 'South Korea', active: true },
    { id: 'brand-skin1004', name: 'Skin1004 Centella', country: 'South Korea', active: true },
    { id: 'brand-somebymi', name: 'Some By Mi', country: 'South Korea', active: true },
    { id: 'brand-charlotte', name: 'Charlotte Tilbury', country: 'United Kingdom', active: true },
    { id: 'brand-nars', name: 'NARS', country: 'USA', active: true },
    { id: 'brand-tom-ford', name: 'Tom Ford Beauty', country: 'USA', active: true }
  ];
  brands.forEach(b => MikyajStore.addBrand(b));

  // ─── PRODUCTS ──────────────────────────────────────────────
  const products = [
    {
      id: 'prod-001', name: 'Vitamin C Radiance Serum', nameAr: 'سيروم فيتامين سي للإشراقة',
      brand: 'Dr. Althea Seoul', brandId: 'brand-dr-althea',
      category: 'cat-skincare', subcategory: 'Serums',
      description: 'Stabilized 15% L-Ascorbic Acid serum with Ferulic Acid and Vitamin E. Targets hyperpigmentation and UV damage specific to Gulf climate exposure. Lightweight, fast-absorbing formula.',
      descriptionAr: 'سيروم حمض الأسكوربيك المستقر بنسبة 15% مع حمض الفيروليك وفيتامين هـ. يستهدف فرط التصبغ وأضرار الأشعة فوق البنفسجية.',
      price: 12.750, comparePrice: 15.000, costPrice: 5.200,
      images: ['assets/images/product_serum.jpg'],
      sku: 'MKJ-SKC-001', barcode: '8809572890123',
      stock: 85, stockStatus: 'in-stock',
      weight: 30, volume: '30ml',
      skinType: ['All', 'Combination', 'Oily'],
      skinConcern: ['Hyperpigmentation', 'Radiance', 'Anti-aging'],
      climateTags: ['Gulf Heat', 'UV Protection'],
      ingredients: 'Water, Ascorbic Acid (15%), Propanediol, Ferulic Acid, Tocopherol, Centella Asiatica Extract, Niacinamide, Hyaluronic Acid',
      ewgRating: 2, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['bestseller', 'vitamin-c', 'brightening', 'korean'],
      published: true, featured: true
    },
    {
      id: 'prod-002', name: 'Velvet Matte Lipstick — Desert Rose', nameAr: 'أحمر شفاه مطفي مخملي — وردة الصحراء',
      brand: 'Charlotte Tilbury', brandId: 'brand-charlotte',
      category: 'cat-makeup', subcategory: 'Lips',
      description: 'Long-wear velvet matte lipstick in a universally flattering desert rose shade. Enriched with orchid extract for moisture. Heat-resistant formula stays put in Gulf humidity.',
      descriptionAr: 'أحمر شفاه مطفي طويل الأمد بلون وردة الصحراء. غني بخلاصة الأوركيد للترطيب.',
      price: 9.500, comparePrice: 12.000, costPrice: 3.800,
      images: ['assets/images/product_lipstick.jpg'],
      sku: 'MKJ-MKP-002', barcode: '5060542890234',
      stock: 120, stockStatus: 'in-stock',
      weight: 4, volume: '3.5g',
      shades: [
        { name: 'Desert Rose', code: '#C4706A' },
        { name: 'Nude Blush', code: '#D4A08C' },
        { name: 'Mauve Night', code: '#8B5E6B' },
        { name: 'Berry Souk', code: '#7B2D4E' },
        { name: 'Coral Sunset', code: '#E07C6B' }
      ],
      skinType: ['All'],
      skinConcern: [],
      climateTags: ['Humidity Resistant'],
      ingredients: 'Dimethicone, Isononyl Isononanoate, Synthetic Wax, Orchid Extract, Vitamin E, Iron Oxides',
      ewgRating: 3, crueltyFree: true, vegan: false, halalCertified: true,
      tags: ['bestseller', 'matte', 'lipstick', 'wedding'],
      published: true, featured: true
    },
    {
      id: 'prod-003', name: 'Barrier Repair Intensive Cream', nameAr: 'كريم إصلاح الحاجز المكثف',
      brand: 'Dr. Althea Seoul', brandId: 'brand-dr-althea',
      category: 'cat-skincare', subcategory: 'Moisturizers',
      description: 'Post-procedure recovery cream with Centella Asiatica, Ceramides, and Panthenol. Specially formulated for skin compromised by AC dryness and Gulf desert winds.',
      descriptionAr: 'كريم إصلاح ما بعد العلاج مع خلاصة السنتيلا والسيراميد والبانثينول.',
      price: 8.900, comparePrice: 11.500, costPrice: 3.600,
      images: ['assets/images/product_cream.jpg'],
      sku: 'MKJ-SKC-003', barcode: '8809572890345',
      stock: 65, stockStatus: 'in-stock',
      weight: 50, volume: '50ml',
      skinType: ['Dry', 'Sensitive', 'Combination'],
      skinConcern: ['Barrier Repair', 'Hydration', 'Redness'],
      climateTags: ['AC Dry Skin', 'Gulf Heat'],
      ingredients: 'Water, Cetearyl Alcohol, Glycerin, Centella Asiatica Extract, Ceramide NP, Panthenol, Madecassoside, Hyaluronic Acid',
      ewgRating: 1, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['bestseller', 'barrier-repair', 'sensitive-skin'],
      published: true, featured: true
    },
    {
      id: 'prod-004', name: 'Luminous Silk Foundation', nameAr: 'كريم أساس الحرير المضيء',
      brand: 'NARS', brandId: 'brand-nars',
      category: 'cat-makeup', subcategory: 'Face',
      description: 'Buildable medium-to-full coverage liquid foundation with a natural satin finish. Oil-free formula designed for long wear in hot, humid conditions.',
      descriptionAr: 'كريم أساس سائل بتغطية متوسطة إلى كاملة مع لمسة ساتان طبيعية.',
      price: 14.250, comparePrice: 16.500, costPrice: 6.100,
      images: ['assets/images/product_foundation.jpg'],
      sku: 'MKJ-MKP-004', barcode: '6070542890456',
      stock: 45, stockStatus: 'in-stock',
      weight: 30, volume: '30ml',
      shades: [
        { name: 'Ivory 102', code: '#F5DFC9' },
        { name: 'Sand 203', code: '#E8C9A8' },
        { name: 'Honey 305', code: '#D4A878' },
        { name: 'Caramel 408', code: '#C49060' },
        { name: 'Mocha 510', code: '#9A6B4A' },
        { name: 'Espresso 612', code: '#6B4530' }
      ],
      skinType: ['All', 'Oily', 'Combination'],
      skinConcern: ['Radiance', 'Even Tone'],
      climateTags: ['Humidity Resistant', 'Gulf Heat'],
      ingredients: 'Water, Dimethicone, Trimethylsiloxysilicate, PEG-10, Titanium Dioxide, Iron Oxides',
      ewgRating: 4, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['foundation', 'long-wear', 'oil-free'],
      published: true, featured: true
    },
    {
      id: 'prod-005', name: 'Desert Glow Eye Palette', nameAr: 'لوحة ظلال العيون لتوهج الصحراء',
      brand: 'Charlotte Tilbury', brandId: 'brand-charlotte',
      category: 'cat-makeup', subcategory: 'Eyes',
      description: '12-shade eyeshadow palette featuring shimmer and matte finishes in warm rose, bronze, champagne, and brown tones inspired by Kuwait desert sunsets.',
      descriptionAr: 'لوحة ظلال عيون بـ 12 لون مع لمسات لامعة ومطفية بألوان دافئة مستوحاة من غروب الشمس في الصحراء.',
      price: 18.500, comparePrice: 22.000, costPrice: 7.500,
      images: ['assets/images/product_eyeshadow.jpg'],
      sku: 'MKJ-MKP-005', barcode: '5060542890567',
      stock: 35, stockStatus: 'in-stock',
      weight: 120, volume: '12 x 1.5g',
      skinType: ['All'],
      skinConcern: [],
      climateTags: ['Humidity Resistant'],
      ingredients: 'Talc, Mica, Dimethicone, Zinc Stearate, Synthetic Fluorphlogopite, Iron Oxides, Titanium Dioxide',
      ewgRating: 3, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['palette', 'eyeshadow', 'shimmer', 'gift-set'],
      published: true, featured: true
    },
    {
      id: 'prod-006', name: 'Oud Rose Eau de Parfum', nameAr: 'عطر العود والورد',
      brand: 'Tom Ford Beauty', brandId: 'brand-tom-ford',
      category: 'cat-fragrance', subcategory: 'Eau de Parfum',
      description: 'A captivating blend of Turkish rose, premium oud wood, and saffron. A signature Gulf fragrance with excellent sillage and longevity.',
      descriptionAr: 'مزيج آسر من الورد التركي وخشب العود الفاخر والزعفران. عطر خليجي مميز.',
      price: 42.000, comparePrice: 48.000, costPrice: 18.500,
      images: ['assets/images/product_perfume.jpg'],
      sku: 'MKJ-FRG-006', barcode: '8880542890678',
      stock: 25, stockStatus: 'in-stock',
      weight: 100, volume: '100ml',
      skinType: ['All'],
      skinConcern: [],
      climateTags: [],
      ingredients: 'Alcohol Denat., Parfum, Aqua, Rosa Damascena Oil, Agarwood Extract, Saffron Extract',
      ewgRating: 5, crueltyFree: true, vegan: false, halalCertified: true,
      tags: ['oud', 'perfume', 'luxury', 'gift'],
      published: true, featured: true
    },
    {
      id: 'prod-007', name: 'Hydra Boost Skincare Set', nameAr: 'مجموعة ترطيب البشرة',
      brand: 'Laneige', brandId: 'brand-laneige',
      category: 'cat-skincare', subcategory: 'Sets',
      description: 'Complete 3-step hydration ritual: Gentle Foam Cleanser (200ml), Water Bank Toner (150ml), and Cream Skin Moisturizer (50ml). Perfect daily routine for Kuwait AC-dried skin.',
      descriptionAr: 'طقوس ترطيب كاملة بـ 3 خطوات: منظف رغوي لطيف، تونر بنك الماء، ومرطب كريم الجلد.',
      price: 24.500, comparePrice: 32.000, costPrice: 10.200,
      images: ['assets/images/product_skincare_set.jpg'],
      sku: 'MKJ-SKC-007', barcode: '8809572890789',
      stock: 40, stockStatus: 'in-stock',
      weight: 400, volume: '200ml + 150ml + 50ml',
      skinType: ['All', 'Dry', 'Combination'],
      skinConcern: ['Hydration', 'Barrier Repair'],
      climateTags: ['AC Dry Skin'],
      ingredients: 'Various — see individual product listings',
      ewgRating: 1, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['set', 'hydration', 'value-set', 'gift-set'],
      published: true, featured: false
    },
    {
      id: 'prod-008', name: 'Volume Drama Mascara', nameAr: 'ماسكارا حجم دراماتيكي',
      brand: 'Charlotte Tilbury', brandId: 'brand-charlotte',
      category: 'cat-makeup', subcategory: 'Eyes',
      description: 'Buildable volumizing mascara with an hourglass-shaped wand. Smudge-proof and humidity-resistant formula for all-day wear in Gulf conditions.',
      descriptionAr: 'ماسكارا حجم قابلة للبناء مع فرشاة على شكل ساعة رملية. تركيبة مقاومة للرطوبة.',
      price: 11.750, comparePrice: 14.000, costPrice: 4.800,
      images: ['assets/images/product_mascara.jpg'],
      sku: 'MKJ-MKP-008', barcode: '5060542890890',
      stock: 90, stockStatus: 'in-stock',
      weight: 12, volume: '12ml',
      skinType: ['All'],
      skinConcern: [],
      climateTags: ['Humidity Resistant', 'Gulf Heat'],
      ingredients: 'Water, Acrylates Copolymer, Beeswax, Carnauba Wax, Carbon Black, Iron Oxides',
      ewgRating: 3, crueltyFree: true, vegan: false, halalCertified: true,
      tags: ['mascara', 'volume', 'waterproof'],
      published: true, featured: false
    },
    {
      id: 'prod-009', name: 'Advanced Snail 96 Mucin Essence', nameAr: 'خلاصة حلزون 96 المتقدمة',
      brand: 'COSRX', brandId: 'brand-cosrx',
      category: 'cat-skincare', subcategory: 'Serums',
      description: 'Lightweight essence with 96% snail secretion filtrate. Repairs damaged skin, reduces acne scars, and provides deep hydration without heaviness.',
      descriptionAr: 'خلاصة خفيفة بنسبة 96% من إفراز الحلزون. تصلح البشرة التالفة وتقلل من ندبات حب الشباب.',
      price: 6.500, comparePrice: 8.500, costPrice: 2.800,
      images: ['assets/images/product_serum.jpg'],
      sku: 'MKJ-SKC-009', barcode: '8809239890901',
      stock: 150, stockStatus: 'in-stock',
      weight: 100, volume: '100ml',
      skinType: ['All', 'Oily', 'Combination', 'Sensitive'],
      skinConcern: ['Acne Scars', 'Hydration', 'Barrier Repair'],
      climateTags: ['AC Dry Skin'],
      ingredients: 'Snail Secretion Filtrate (96%), Betaine, Sodium Hyaluronate, Panthenol, Allantoin',
      ewgRating: 1, crueltyFree: false, vegan: false, halalCertified: false,
      tags: ['snail-mucin', 'korean', 'bestseller', 'essence'],
      published: true, featured: false
    },
    {
      id: 'prod-010', name: 'Ginseng Nourishing Eye Cream', nameAr: 'كريم عين الجينسنغ المغذي',
      brand: 'Beauty of Joseon', brandId: 'brand-beauty-joseon',
      category: 'cat-skincare', subcategory: 'Eye Care',
      description: 'Rich eye cream with ginseng root water and retinal. Targets dark circles, fine lines, and puffiness. Gentle enough for the delicate eye area.',
      descriptionAr: 'كريم عين غني بماء جذور الجينسنغ والريتينال. يستهدف الهالات السوداء والخطوط الدقيقة.',
      price: 7.250, comparePrice: 9.000, costPrice: 3.100,
      images: ['assets/images/product_cream.jpg'],
      sku: 'MKJ-SKC-010', barcode: '8809572891012',
      stock: 72, stockStatus: 'in-stock',
      weight: 25, volume: '25ml',
      skinType: ['All'],
      skinConcern: ['Dark Circles', 'Anti-aging', 'Puffiness'],
      climateTags: ['AC Dry Skin'],
      ingredients: 'Panax Ginseng Root Water, Niacinamide, Retinal, Adenosine, Ceramide NP, Squalane',
      ewgRating: 2, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['eye-cream', 'anti-aging', 'korean', 'ginseng'],
      published: true, featured: false
    },
    {
      id: 'prod-011', name: 'Heartleaf 77% Soothing Toner', nameAr: 'تونر هارتليف 77% المهدئ',
      brand: 'Anua Heartleaf', brandId: 'brand-anua',
      category: 'cat-skincare', subcategory: 'Toners',
      description: 'Calming toner with 77% Houttuynia Cordata extract. Soothes redness, minimizes pores, and balances oil production. Perfect for reactive Gulf skin.',
      descriptionAr: 'تونر مهدئ بنسبة 77% من مستخلص هوتونيا كورداتا. يهدئ الاحمرار ويقلل المسام.',
      price: 5.750, comparePrice: 7.500, costPrice: 2.400,
      images: ['assets/images/product_skincare_set.jpg'],
      sku: 'MKJ-SKC-011', barcode: '8809572891123',
      stock: 110, stockStatus: 'in-stock',
      weight: 250, volume: '250ml',
      skinType: ['Oily', 'Combination', 'Sensitive'],
      skinConcern: ['Redness', 'Pore Care', 'Oil Control'],
      climateTags: ['Gulf Heat', 'Humidity Resistant'],
      ingredients: 'Houttuynia Cordata Extract (77%), Butylene Glycol, Glycerin, Panthenol, Allantoin, Niacinamide',
      ewgRating: 1, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['toner', 'soothing', 'korean', 'pore-care'],
      published: true, featured: false
    },
    {
      id: 'prod-012', name: 'Hyalu-Cica Moisture Barrier Cream', nameAr: 'كريم حاجز الترطيب هيالو-سيكا',
      brand: 'Skin1004 Centella', brandId: 'brand-skin1004',
      category: 'cat-skincare', subcategory: 'Moisturizers',
      description: 'Dual-action moisturizer combining Hyaluronic Acid and Centella Asiatica. Rebuilds moisture barrier while calming irritation from heat and air conditioning.',
      descriptionAr: 'مرطب ثنائي المفعول يجمع بين حمض الهيالورونيك وخلاصة السنتيلا. يعيد بناء حاجز الرطوبة.',
      price: 7.900, comparePrice: 9.500, costPrice: 3.200,
      images: ['assets/images/product_cream.jpg'],
      sku: 'MKJ-SKC-012', barcode: '8809572891234',
      stock: 58, stockStatus: 'in-stock',
      weight: 50, volume: '50ml',
      skinType: ['Dry', 'Sensitive', 'Combination'],
      skinConcern: ['Hydration', 'Barrier Repair', 'Calming'],
      climateTags: ['AC Dry Skin', 'Gulf Heat'],
      ingredients: 'Water, Centella Asiatica Extract, Hyaluronic Acid, Squalane, Ceramide NP, Niacinamide',
      ewgRating: 1, crueltyFree: true, vegan: true, halalCertified: true,
      tags: ['moisturizer', 'cica', 'hyaluronic', 'barrier'],
      published: true, featured: false
    }
  ];

  products.forEach(p => {
    p.createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    p.updatedAt = new Date().toISOString();
    const existing = MikyajStore.getProducts();
    existing.push(p);
    localStorage.setItem(MikyajStore.KEYS.PRODUCTS, JSON.stringify(existing));
  });

  // ─── CUSTOMERS ─────────────────────────────────────────────
  const customers = [
    { name: 'Fatima Al-Sabah', email: 'fatima@example.kw', phone: '+965 9912 3456', region: 'Capital', orders: 12, totalSpent: 245.500 },
    { name: 'Noura Al-Rashidi', email: 'noura@example.kw', phone: '+965 9923 4567', region: 'Hawalli', orders: 8, totalSpent: 178.250 },
    { name: 'Maryam Al-Kandari', email: 'maryam@example.kw', phone: '+965 9934 5678', region: 'Salmiya', orders: 15, totalSpent: 412.750 },
    { name: 'Dana Al-Mutairi', email: 'dana@example.kw', phone: '+965 9945 6789', region: 'Ahmadi', orders: 5, totalSpent: 89.000 },
    { name: 'Sara Al-Enezi', email: 'sara@example.kw', phone: '+965 9956 7890', region: 'Jahra', orders: 3, totalSpent: 52.500 },
    { name: 'Lulwa Al-Farsi', email: 'lulwa@example.kw', phone: '+965 9967 8901', region: 'Farwaniya', orders: 22, totalSpent: 685.000 },
    { name: 'Haya Al-Shammari', email: 'haya@example.kw', phone: '+965 9978 9012', region: 'Capital', orders: 7, totalSpent: 156.750 },
    { name: 'Dalal Al-Ajmi', email: 'dalal@example.kw', phone: '+965 9989 0123', region: 'Mubarak Al-Kabeer', orders: 10, totalSpent: 298.500 }
  ];
  customers.forEach(c => MikyajStore.addCustomer(c));

  // ─── DEMO ORDERS ───────────────────────────────────────────
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const paymentMethods = ['KNET', 'Visa', 'Mastercard', 'MyFatoorah', 'COD', 'Apple Pay'];

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
      shippingAddress: `Block ${Math.floor(Math.random() * 12) + 1}, Street ${Math.floor(Math.random() * 50) + 1}, ${customer.region}, Kuwait`,
      notes: ''
    });
  }

  console.log('🎨 Mikyaj Kuwait Demo Data Seeded Successfully!');
}

// Auto-seed on page load
document.addEventListener('DOMContentLoaded', seedMikyajData);
