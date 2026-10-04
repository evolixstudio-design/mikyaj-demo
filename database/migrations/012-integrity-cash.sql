BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug ON products(slug) WHERE slug IS NOT NULL;
DROP INDEX IF EXISTS one_open_return_per_order;
CREATE UNIQUE INDEX one_open_return_per_order ON return_requests(order_id) WHERE status IN ('REQUESTED','APPROVED','RECEIVED');
CREATE TABLE IF NOT EXISTS cash_transactions (
 id SERIAL PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),
 kind TEXT NOT NULL CHECK(kind IN ('COLLECTION','REFUND')),amount NUMERIC(10,3) NOT NULL CHECK(amount>0),
 note TEXT NOT NULL,admin_id INTEGER REFERENCES admin_users(id),idempotency_key TEXT UNIQUE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_collection_once ON cash_transactions(order_id) WHERE kind='COLLECTION';
COMMIT;
