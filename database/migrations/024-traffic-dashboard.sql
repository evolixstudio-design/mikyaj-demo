BEGIN;
CREATE TABLE IF NOT EXISTS analytics_sessions (
 id UUID PRIMARY KEY, visitor_id UUID NOT NULL, customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
 device TEXT NOT NULL CHECK(device IN ('mobile','tablet','desktop')), source TEXT NOT NULL DEFAULT 'direct',
 medium TEXT NOT NULL DEFAULT '', campaign TEXT NOT NULL DEFAULT '', referrer_host TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL DEFAULT 'en', first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analytics_visitor_recent ON analytics_sessions(visitor_id,last_seen DESC);
CREATE INDEX IF NOT EXISTS analytics_sessions_recent ON analytics_sessions(last_seen DESC);
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS visitor_id UUID;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS page_key TEXT;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS page_type TEXT;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS page_label TEXT;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS tracking_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commerce_events ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS analytics_event_retry ON commerce_events(event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS analytics_view_event ON commerce_events(view_id,event) WHERE tracking_version=2 AND view_id IS NOT NULL AND event IN ('page_view','product_view','cart_view','checkout_started');
CREATE UNIQUE INDEX IF NOT EXISTS analytics_placed_order ON commerce_events(order_id) WHERE event='order_placed';
CREATE INDEX IF NOT EXISTS analytics_session_events ON commerce_events(session_id,created_at,id);
CREATE INDEX IF NOT EXISTS analytics_page_date ON commerce_events(page_key,created_at) WHERE event='page_view';
COMMIT;
