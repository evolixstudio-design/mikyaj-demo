# Phase 6A Forensic Audit

## 1. Existing Order Model
- **Core Tables**: `orders`, `order_items`, `payments`.
- **Primary Key/Lookup**: `id` is the primary serial key, `order_number` is used for API exposure.
- **Concurrency**: `order-service.js` uses `SELECT ... FOR UPDATE` row locks to mutate the `orders` table.

## 2. Existing Authentication
- **Admin**: `admin_users` table handles authentication using bcrypt.
- **Strategy**: JWT via `requireAdminAuth` middleware using `ADMIN_JWT_SECRET`.
- **Payload**: `{ id, email, role: 'ADMIN' }`.

## 3. Existing Authorization
- **Middleware Check**: `requireAdminAuth` explicitly blocks tokens without `role === 'ADMIN'`.

## 4. Existing Admin Architecture
- **Table**: `admin_users`.
- There is no generic `users` table. Therefore, we should create a dedicated `drivers` table to isolate administrative users from operational delivery workers.

## 5. Existing Status Transitions
- **State Machine**: Enforced strictly in `backend/services/order-service.js`.
- **Flow**: `PENDING_PAYMENT -> CONFIRMED -> PROCESSING -> READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED`.
- **History**: `order_status_history` tracks changes.

## 6. Required New Tables
- **`drivers`**:
  - `id` (SERIAL PRIMARY KEY)
  - `name` (VARCHAR)
  - `phone` (VARCHAR)
  - `email` (VARCHAR UNIQUE)
  - `password_hash` (VARCHAR)
  - `status` (VARCHAR DEFAULT 'ACTIVE')
- **`order_driver_assignments`**:
  - `id` (SERIAL PRIMARY KEY)
  - `order_id` (INTEGER REFERENCES orders)
  - `driver_id` (INTEGER REFERENCES drivers)
  - `assigned_by_admin_id` (INTEGER REFERENCES admin_users)
  - `status` (VARCHAR) - `ACTIVE`, `COMPLETED`, `UNASSIGNED`
  - `assigned_at` (TIMESTAMP)
  - `unassigned_at` (TIMESTAMP NULL)
  - `notes` (TEXT)

## 7. Required New Middleware
- `backend/middleware/driver-auth.js`: Implements `requireDriverAuth`. Re-uses `ADMIN_JWT_SECRET` (or creates `DRIVER_JWT_SECRET`) but strictly enforces `role === 'DRIVER'` and checks if the driver's database status is still `ACTIVE`.

## 8. Required New Services
- `driver-service.js`: Creating drivers, toggling activation, hashing passwords, generating driver JWTs.
- `delivery-service.js`: Enforcing transaction rules for assigning, reassigning, starting, and completing deliveries, ensuring only one `ACTIVE` assignment exists per order.

## 9. Required New Routes
- **Admin**:
  - `POST /api/admin/drivers`
  - `GET /api/admin/drivers`
  - `PATCH /api/admin/drivers/:id/status`
  - `POST /api/admin/orders/:orderNumber/assign-driver`
  - `POST /api/admin/orders/:orderNumber/unassign-driver`
- **Driver**:
  - `POST /api/driver/auth/login`
  - `GET /api/driver/orders`
  - `GET /api/driver/orders/:orderNumber`
  - `POST /api/driver/orders/:orderNumber/start-delivery`
  - `POST /api/driver/orders/:orderNumber/mark-delivered`

## 10. Compatibility Risks
- **Audit Logging**: `order_status_history` currently only defines `changed_by_admin_id`. To avoid corrupting or restructuring existing historical data, the safest and most backward-compatible approach is to add a `changed_by_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL` column rather than migrating to a polymorphic `actor_type`/`actor_id` schema.
- **Cancellation**: If an order is cancelled by an Admin while assigned, the active assignment must either be forcefully closed (`UNASSIGNED`) or left `ACTIVE` with strict blocks on the driver starting delivery. We will prevent starting delivery on cancelled orders.
- **Database Locks**: Both `order-service.js` and the new `delivery-service.js` must safely lock the `orders` row to avoid concurrent assignment/delivery-start collisions.
