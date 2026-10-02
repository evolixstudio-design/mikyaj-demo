-- database/schema-phase6.sql
-- Phase 6A: Driver & Delivery Management

-- 1. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- 2. Order Driver Assignments Table
CREATE TABLE IF NOT EXISTS order_driver_assignments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    assigned_by_admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, UNASSIGNED
    notes TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_order_id ON order_driver_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver_id ON order_driver_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON order_driver_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON order_driver_assignments(order_id) WHERE status = 'ACTIVE';

-- 3. Update Order Status History
-- Safely add driver actor tracking to existing history table without dropping it
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS changed_by_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL;
