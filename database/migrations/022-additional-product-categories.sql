BEGIN;

-- Primary product categories remain intact. Merchandising collections are additive.
CREATE TABLE IF NOT EXISTS product_category_memberships (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS product_category_memberships_category_idx
    ON product_category_memberships(category_id, product_id);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS badge_en VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS badge_ar VARCHAR(60) NOT NULL DEFAULT '';

COMMIT;
