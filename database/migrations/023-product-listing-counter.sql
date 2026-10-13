BEGIN;

-- Accounting for listing work is separate from store prices and order payments.
CREATE TABLE IF NOT EXISTS product_listing_ledger (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_reference INTEGER NOT NULL UNIQUE,
    name_en TEXT NOT NULL DEFAULT '',
    name_ar TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL CHECK(source IN ('ADMIN','SUPPLIER_IMPORT','OTHER')),
    listed_at TIMESTAMPTZ NOT NULL,
    rate_paise INTEGER NOT NULL DEFAULT 1100 CHECK(rate_paise >= 0),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_listing_ledger_date_idx
    ON product_listing_ledger(listed_at DESC,id DESC);

INSERT INTO store_settings(key,value)
VALUES('listing_billing','{"currency":"INR","rate_paise":1100,"billable_sources":["ADMIN","SUPPLIER_IMPORT","OTHER"],"initial_catalogue_excluded":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;

-- Source identity distinguishes the original imported catalogue from later listings.
-- An update does not fire this trigger. Deleted listings retain their accounting record.
CREATE OR REPLACE FUNCTION record_product_listing() RETURNS TRIGGER AS $$
DECLARE listing_source TEXT;
BEGIN
    listing_source := CASE
        WHEN NEW.source_url LIKE 'manual:%' THEN 'ADMIN'
        WHEN NEW.source_url LIKE 'supplier-catalogue:%' THEN 'SUPPLIER_IMPORT'
        ELSE 'OTHER'
    END;
    INSERT INTO product_listing_ledger(product_id,product_reference,name_en,name_ar,source,listed_at,rate_paise)
    VALUES(NEW.id,NEW.id,COALESCE(NEW.name_en,''),COALESCE(NEW.name_ar,''),listing_source,NEW.created_at,
        COALESCE((SELECT (value->>'rate_paise')::integer FROM store_settings WHERE key='listing_billing'),1100))
    ON CONFLICT(product_reference) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_listing_created ON products;
CREATE TRIGGER product_listing_created AFTER INSERT ON products
    FOR EACH ROW EXECUTE FUNCTION record_product_listing();

-- Backfill only known admin/supplier creations; the original 5,000+ catalogue is excluded.
INSERT INTO product_listing_ledger(product_id,product_reference,name_en,name_ar,source,listed_at,rate_paise)
SELECT id,id,COALESCE(name_en,''),COALESCE(name_ar,''),
    CASE WHEN source_url LIKE 'manual:%' THEN 'ADMIN' ELSE 'SUPPLIER_IMPORT' END,
    created_at,1100
FROM products
WHERE source_url LIKE 'manual:%' OR source_url LIKE 'supplier-catalogue:%'
ON CONFLICT(product_reference) DO NOTHING;

COMMIT;
