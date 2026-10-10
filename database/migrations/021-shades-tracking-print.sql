BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants_enabled BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS product_variants (
 id BIGSERIAL PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),name_en TEXT NOT NULL,name_ar TEXT NOT NULL,
 color_hex TEXT NOT NULL,sku TEXT NOT NULL DEFAULT '',image_url TEXT,
 stock_status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(stock_status IN ('IN_STOCK','OUT_OF_STOCK')),
 inventory_quantity INTEGER CHECK(inventory_quantity>=0),status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
 priority INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_variant_product ON product_variants(product_id,status);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name_en TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name_ar TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_estimated_from TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_estimated_to TIMESTAMPTZ;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS order_reference_counter (id INTEGER PRIMARY KEY CHECK(id=1),value BIGINT NOT NULL);
INSERT INTO order_reference_counter(id,value) SELECT 1,GREATEST(0,COALESCE(MAX(CASE WHEN order_number ~ '^[0-9]{4,}$' THEN order_number::bigint END),0)) FROM orders ON CONFLICT DO NOTHING;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS view_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS commerce_page_dwell ON commerce_events(view_id) WHERE event='page_dwell';
INSERT INTO store_settings(key,value) VALUES('events','{"enabled":true}') ON CONFLICT DO NOTHING;
COMMIT;
