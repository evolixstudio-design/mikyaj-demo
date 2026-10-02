-- database/schema-phase4.sql

-- 1. Add idempotency key to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL DEFAULT 'MYFATOORAH',
    provider_invoice_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    provider_reference VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(10,3) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
    payment_method VARCHAR(50),
    raw_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(provider_invoice_id);
