BEGIN;
CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
 id UUID PRIMARY KEY,admin_id INTEGER NOT NULL REFERENCES admin_users(id),endpoint_hash TEXT NOT NULL UNIQUE,
 subscription JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_alert_events (
 id BIGSERIAL PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(order_id,kind)
);
CREATE TABLE IF NOT EXISTS order_alert_deliveries (
 id BIGSERIAL PRIMARY KEY,event_id BIGINT NOT NULL REFERENCES order_alert_events(id),
 subscription_id UUID REFERENCES admin_push_subscriptions(id) ON DELETE CASCADE,email TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED','SKIPPED')),
 attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),sent_at TIMESTAMPTZ,
 CHECK((subscription_id IS NULL) <> (email IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS alert_push_once ON order_alert_deliveries(event_id,subscription_id) WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS alert_email_once ON order_alert_deliveries(event_id,email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS alert_pending ON order_alert_deliveries(status,next_attempt_at);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS customer_google_sub ON customers(google_sub) WHERE google_sub IS NOT NULL;
COMMIT;
