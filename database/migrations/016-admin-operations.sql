BEGIN;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
UPDATE admin_users SET role='SUPER_ADMIN' WHERE id=(SELECT MIN(id) FROM admin_users WHERE role='ADMIN') AND NOT EXISTS(SELECT 1 FROM admin_users WHERE role='SUPER_ADMIN');
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS one_default_customer_address ON customer_addresses(customer_id) WHERE is_default;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_reserved BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS commerce_events (
 id BIGSERIAL PRIMARY KEY, session_id UUID NOT NULL, customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
 event TEXT NOT NULL, path TEXT NOT NULL, product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
 device TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS commerce_events_date ON commerce_events(created_at,event);
CREATE TABLE IF NOT EXISTS admin_notification_reads (
 admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE, key TEXT NOT NULL, PRIMARY KEY(admin_id,key)
);
COMMIT;
