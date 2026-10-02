-- database/schema-phase7.sql

CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    
    -- MyFatoorah fields
    provider VARCHAR(50) NOT NULL DEFAULT 'MYFATOORAH',
    provider_refund_id VARCHAR(255),
    provider_reference VARCHAR(255),
    
    amount NUMERIC(10,3) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KWD',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    
    reason TEXT NOT NULL,
    requested_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    
    -- Idempotency key to prevent double requests locally
    idempotency_key VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_provider_refund_id ON refunds(provider_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
