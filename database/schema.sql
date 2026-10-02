-- database/schema.sql
-- Mikyaj Kuwait E-Commerce Catalog Schema (Phase 1B)

-- 1. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BRANDS
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    
    -- Source Identity
    source_url TEXT NOT NULL UNIQUE,
    source_identity_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of normalized source_url
    
    sku VARCHAR(255),
    slug VARCHAR(255),
    
    -- Names & Descriptions (Nullable due to 1472 missing names)
    name_ar TEXT,
    name_en TEXT,
    short_description_ar TEXT,
    short_description_en TEXT,
    details_ar TEXT,
    details_en TEXT,
    
    -- Relationships
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    
    -- Pricing (NUMERIC 10,3 for KWD)
    source_price NUMERIC(10,3) NOT NULL,
    regular_price NUMERIC(10,3),
    selling_price NUMERIC(10,3) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    
    -- Audit / CSV references
    source_image_count INTEGER,
    folder_name TEXT,
    image_folder TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Cloudinary (Nullable until upload)
    cloudinary_public_id VARCHAR(255),
    cloudinary_url TEXT,
    
    -- Ordering & Dimensions
    image_order INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    
    -- Source reference
    source_filename VARCHAR(255) NOT NULL,
    source_path_reference TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: product cannot have two images with same order
    CONSTRAINT uq_product_image_order UNIQUE(product_id, image_order)
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Optional Function/Trigger for updated_at can be added later by the app layer.
