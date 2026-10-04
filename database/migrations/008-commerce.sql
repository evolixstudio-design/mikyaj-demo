BEGIN;
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO store_settings(key,value) VALUES
 ('delivery','{"free_threshold":10,"fee":1,"enabled":true,"areas":[],"require_area_match":true}'),
 ('payments','{"provider":"none","enabled":false,"cod_enabled":true,"mode":"sandbox"}'),
 ('social','{"instagram":"https://www.instagram.com/mikyajkw/"}'),
 ('contact','{"whatsapp":"96566232231","email":"","delivery_en":"","delivery_ar":"","returns_en":"","returns_ar":""}')
ON CONFLICT(key) DO NOTHING;
CREATE TABLE IF NOT EXISTS integration_secrets (name TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE products ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE products ADD COLUMN IF NOT EXISTS translation_error TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS translation_source_hash TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS routine_step TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt_en TEXT;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt_ar TEXT;
UPDATE categories SET priority=100 WHERE priority=0 AND (name_ar='المكياج' OR slug='lmkyj');
CREATE TABLE IF NOT EXISTS offers (
 id SERIAL PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT NOT NULL,
 discount_percent NUMERIC(5,2) NOT NULL CHECK(discount_percent>0 AND discount_percent<=90),
 product_id INTEGER REFERENCES products(id), category_id INTEGER REFERENCES categories(id),
 starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ,
 priority INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(product_id IS NOT NULL OR category_id IS NOT NULL),
 CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS customers (
 id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL,
 password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', session_version INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_addresses (
 id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
 label TEXT NOT NULL DEFAULT 'Home', governorate TEXT NOT NULL, area TEXT NOT NULL, block TEXT NOT NULL,
 street TEXT NOT NULL, building TEXT NOT NULL, floor TEXT NOT NULL DEFAULT '', apartment TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash TEXT PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,3) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,3);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_fingerprint TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_ar TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_en TEXT;
CREATE TABLE IF NOT EXISTS return_requests (
 id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'REQUESTED', admin_note TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_return_per_order ON return_requests(order_id) WHERE status='REQUESTED';
CREATE TABLE IF NOT EXISTS blog_posts (
 id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
 excerpt_en TEXT NOT NULL DEFAULT '', excerpt_ar TEXT NOT NULL DEFAULT '',
 body_en TEXT NOT NULL, body_ar TEXT NOT NULL,
 image_url TEXT, image_alt_en TEXT, image_alt_ar TEXT,
 status TEXT NOT NULL DEFAULT 'DRAFT', publish_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_audit_log (
 id BIGSERIAL PRIMARY KEY, admin_id INTEGER REFERENCES admin_users(id), action TEXT NOT NULL,
 entity_id TEXT, detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_merchandising ON products(priority DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_offers_category ON offers(category_id) WHERE active;
COMMIT;
