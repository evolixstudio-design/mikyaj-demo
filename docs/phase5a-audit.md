# Phase 5A Forensic Audit

## A. Existing Architecture
The existing architecture centers around `backend/server.js` acting as a monolithic Express app.
- Postgres serves as the canonical datastore (via `backend/db.js`).
- The payment lifecycle operates exclusively via `backend/routes/checkout.js`, `backend/routes/payment.js`, `backend/routes/webhook.js`, and `backend/services/myfatoorah.js`.

## B. Existing Order Schema
`orders` table exists (Phase 3 schema) with the following structure:
- `id`
- `order_number`
- `customer_name`, `customer_phone`, `customer_address`, `customer_email`
- `total_amount`, `currency`
- `status` (PENDING_PAYMENT, PAID, PROCESSING, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED)
- `payment_method`, `payment_reference`
- `created_at`, `updated_at`
- `idempotency_key` (added in Phase 4)

`order_items` table snapshot-captures line item logic:
- `quantity`
- `price_at_purchase`

## C. Existing Payment Schema
`payments` table exists (Phase 4 schema):
- `id`
- `order_id`
- `provider`, `provider_invoice_id`, `provider_payment_id`, `provider_reference`
- `status` (PENDING, PAID, etc.)
- `amount`, `currency`

## D. Existing Order Status Values
The database naturally contains `PENDING_PAYMENT`, `PROCESSING`, `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `DELIVERED`, and `CANCELLED`. We will reuse these values directly for the new Order Status Model to prevent mapping headaches.

## E. Existing Authentication State
There was no existing backend authentication state or administrator identity table. A clean, native `admin_users` table is required to fulfill the JWT constraints securely.

## F. Existing API Routes
- `GET /api/health`
- `GET /api/categories`
- `GET /api/brands`
- `GET /api/products`
- `POST /api/checkout`
- `GET /api/payment/status/:orderNumber`
- `POST /api/webhook`

## G. Existing Database Patterns
`backend/db.js` exports a shared `pool`. PostgreSQL parameterized queries (`$1, $2`) are enforced throughout the project to safeguard against SQL Injection.

## H. Files That Must Be Modified
- `backend/server.js` (to expose admin routes)
- `.env` (to provide a JWT token secret constraint)

## I. Files That Must Be Created
- `database/schema-phase5.sql` (migrations for Admin & History)
- `backend/seed-admin.js` (CLI seeder)
- `backend/middleware/admin-auth.js`
- `backend/routes/admin-auth.js`
- `backend/routes/admin-orders.js`
- `backend/services/order-service.js`
- `backend/test-orders.js`

## J. Potential Compatibility Risks
Order filtering via `payment_status` presents an aggregation challenge. If multiple payment rows exist for a single order, a naïve `JOIN` will duplicate the orders in the list view. We must select the most recent payment status via a subquery or `DISTINCT ON` to preserve pagination limits accurately. 

## K. Recommended Implementation Sequence
1. Generate `schema-phase5.sql` mapping `admin_users` and `order_status_history`.
2. Generate `seed-admin.js` to create the initial super-admin.
3. Build `admin-auth.js` middleware.
4. Export JWT Login Route (`routes/admin-auth.js`).
5. Develop Server-Side Transition Business Rules (`services/order-service.js`).
6. Export Listing and Operations (`routes/admin-orders.js`).
7. Execute integration scripts against mock endpoints.
