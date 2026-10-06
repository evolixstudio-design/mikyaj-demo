BEGIN;
CREATE TABLE IF NOT EXISTS discounts (
 id SERIAL PRIMARY KEY, title TEXT NOT NULL, title_ar TEXT NOT NULL DEFAULT '',
 type TEXT NOT NULL CHECK(type IN ('PRODUCT','ORDER','BXGY','SHIPPING')),
 method TEXT NOT NULL CHECK(method IN ('AUTOMATIC','CODE')), code TEXT UNIQUE,
 value_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(value_type IN ('PERCENT','FIXED')),
 value NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK(value>=0),
 target TEXT NOT NULL DEFAULT 'ALL' CHECK(target IN ('ALL','PRODUCTS','CATEGORIES','BRANDS')), target_ids INTEGER[] NOT NULL DEFAULT '{}',
 buy_quantity INTEGER NOT NULL DEFAULT 1 CHECK(buy_quantity>0), get_quantity INTEGER NOT NULL DEFAULT 1 CHECK(get_quantity>0),
 get_target TEXT NOT NULL DEFAULT 'ALL' CHECK(get_target IN ('ALL','PRODUCTS','CATEGORIES','BRANDS')), get_ids INTEGER[] NOT NULL DEFAULT '{}',
 minimum_amount NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK(minimum_amount>=0),
 usage_limit INTEGER CHECK(usage_limit>0), once_per_customer BOOLEAN NOT NULL DEFAULT false,
 combines BOOLEAN NOT NULL DEFAULT false, active BOOLEAN NOT NULL DEFAULT true,
 starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(ends_at IS NULL OR ends_at>starts_at), CHECK(method<>'CODE' OR code IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS discount_redemptions (
 id BIGSERIAL PRIMARY KEY, discount_id INTEGER NOT NULL REFERENCES discounts(id), order_id INTEGER NOT NULL REFERENCES orders(id),
 customer_key TEXT NOT NULL, amount NUMERIC(10,3) NOT NULL, released BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(discount_id,order_id)
);
CREATE INDEX IF NOT EXISTS discount_redemptions_customer ON discount_redemptions(discount_id,customer_key) WHERE NOT released;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,3) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_details JSONB NOT NULL DEFAULT '[]';
COMMIT;
