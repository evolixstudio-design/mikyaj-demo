const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const categoryUpdates = [
  { slug: 'uncategorized', en: 'Curated Essentials', ar: 'مختارات أساسية' },
  { slug: 'ltwr-wlbkhwr', en: 'Perfumes & Incense', ar: 'العطور والبخور' },
  { slug: 'dwt-lnyh', en: 'Care Tools & Accessories', ar: 'أدوات العناية' },
  { slug: 'lny-blwjh', en: 'Facial Skincare', ar: 'العناية بالوجه' },
  { slug: 'lny-bljsm', en: 'Body Care', ar: 'العناية بالجسم' },
  { slug: 'jmy-lmntjt', en: 'All Products', ar: 'جميع المنتجات' },
  { slug: 'zfr', en: 'Nails & Manicure', ar: 'الأظافر' },
  { slug: 'lmkyj', en: 'Makeup & Beauty', ar: 'المكياج' },
  { slug: 'lny-blyn-wlhwjb', en: 'Eye & Brow Care', ar: 'العناية بالعين والحواجب' },
  { slug: 'lny-blydyn-wlqdm', en: 'Hand & Foot Care', ar: 'العناية باليدين والقدمين' },
  { slug: 'lny-blshr', en: 'Hair Care', ar: 'العناية بالشعر' },
  { slug: 'lny-blfm-wlsnn', en: 'Oral & Dental Care', ar: 'العناية بالفم والأسنان' },
  { slug: 'lny-lshkhsy', en: 'Personal Care', ar: 'العناية الشخصية' },
  { slug: 'lktrwnyt', en: 'Beauty Devices', ar: 'إلكترونيات وأجهزة' },
  { slug: 'lshb-wlbwdrt', en: 'Herbs & Powders', ar: 'الأعشاب والبودرات' },
  { slug: 'tkhsys', en: 'Fitness & Slimming', ar: 'تخسيس ورشاقة' },
  { slug: 'dwt-wksswrt-lshr', en: 'Hair Styling & Accessories', ar: 'أدوات وإكسسوارات الشعر' },
  { slug: 'lzywt', en: 'Natural Oils', ar: 'الزيوت الطبيعية' },
  { slug: 'lsh-wlfy', en: 'Health & Wellness', ar: 'الصحة والعافية' },
  { slug: 'twnr-wsyrwm', en: 'Toners & Serums', ar: 'تونر وسيروم' },
  { slug: 'bkyjt', en: 'Gift Sets & Bundles', ar: 'بكجات ومجموعات' }
];

async function updateCats() {
  for (const c of categoryUpdates) {
    await pool.query('UPDATE categories SET name_en = $1, name_ar = $2 WHERE slug = $3', [c.en, c.ar, c.slug]);
  }
  const check = await pool.query('SELECT slug, name_en, name_ar FROM categories ORDER BY id ASC');
  console.log('Categories updated successfully. Count:', check.rows.length);
  check.rows.forEach(r => console.log(`- ${r.slug}: ${r.name_en} | ${r.name_ar}`));
  await pool.end();
}

updateCats().catch(err => {
  console.error(err);
  pool.end();
});
