# Phase 7 — Payment Reconciliation & Refund Management: Forensic Audit

## 1. Existing Payment Schema
The `payments` table (from `schema-phase4.sql`) forms the foundation of our financial tracking. 
It establishes a one-to-many relationship with `orders` (`payments.order_id = orders.id`).
Key fields include:
- `id` (Local PK)
- `order_id` (FK to orders)
- `provider_invoice_id` (MyFatoorah InvoiceId)
- `provider_payment_id` (MyFatoorah PaymentId)
- `amount` (NUMERIC(10,3))
- `currency` (VARCHAR(3), default 'KWD')
- `status` (VARCHAR(50))

## 2. Existing Payment Statuses
Payment statuses currently generated locally (derived from webhook and API callbacks):
- `PENDING` (Initial)
- `SUCCESS` (MyFatoorah `Paid`)
- `FAILED` (MyFatoorah `Failed`)
- `CANCELED` (MyFatoorah `Canceled`)
- `AMOUNT_MISMATCH` (Security/Fraud flag)

## 3. Existing MyFatoorah Integration Version
The integration actively uses the **MyFatoorah V2 API** exclusively.
Current Endpoints utilized:
- `/v2/SendPayment`
- `/v2/GetPaymentStatus`
The codebase does not use V3, and migration is out of scope. We will use `/v2/MakeRefund`.

## 4. Existing Payment Identity Fields
- `provider_invoice_id`: Created upon payment initiation. Forms the primary lookup key for webhooks initially.
- `provider_payment_id`: Contains the definitive transaction ID. When we issue a refund via `/v2/MakeRefund`, we will use `KeyType: 'PaymentId'` and this value.

## 5. Existing Webhook Implementation
Located in `backend/routes/webhook.js`.
It listens for `POST /api/webhook/myfatoorah`. 
It expects `req.body.Event` and uses `req.body.Data.InvoiceId` to find the local payment.
It then queries `GetPaymentStatus` as a source of absolute truth rather than trusting the payload blindly.

## 6. Existing Webhook Signature Verification
`backend/services/myfatoorah.js` implements a rigorous `verifyWebhookSignature` function matching MyFatoorah's V2 specification (flattening, alphabetizing, excluding nulls/arrays, signing with `HMAC-SHA256`). This MUST remain untouched and be utilized for refund webhooks.

## 7. Existing Order/Payment Relationship
One Order can have multiple Payment rows. We only allow refunds against Payment rows where `status = 'SUCCESS'`.

## 8. Existing Order Cancellation Behavior
Phase 5 allows Admin to CANCEL an order. This only modifies `orders.status` and logs to `order_status_history`. It does **not** trigger any financial payload or refund to MyFatoorah. Refunds must be explicit.

## 9. Required Refund Schema
We will create a `refunds` table in `database/schema-phase7.sql`:
- `id` (SERIAL PRIMARY KEY)
- `order_id` (INTEGER, FK to orders)
- `payment_id` (INTEGER, FK to payments)
- `provider_refund_id` (VARCHAR)
- `provider_reference` (VARCHAR)
- `amount` (NUMERIC(10,3))
- `currency` (VARCHAR)
- `status` (VARCHAR - e.g., `PENDING`, `REFUNDED`, `FAILED`, `CANCELLED`)
- `reason` (TEXT)
- `requested_by_admin_id` (INTEGER, FK to admins)
- `created_at`, `updated_at`

## 10. Required Reconciliation Schema & Logic
We do not need a heavy ledger table. We will dynamically calculate `refundable_amount` using:
`refundable = payment.amount - SUM(refunds.amount WHERE status IN ('PENDING', 'REFUNDED'))`
If `refundable < requested`, the transaction is aborted.

## 11. Required Routes
- `POST /api/admin/orders/:orderNumber/refunds`
- `GET /api/admin/refunds`
- `GET /api/admin/refunds/:refundId`
- `GET /api/admin/orders/:orderNumber/refunds`
- Modifications to `POST /api/webhook/myfatoorah` to route `RefundStatusChanged` events.

## 12. Required Services
- Extension of `myfatoorah.js` -> `makeRefund(paymentId, amount, currency, reason)`
- Creation of `refund-service.js`
- Creation of `reconciliation-service.js`

## 13. Compatibility Risks
- The Webhook router (`webhook.js`) currently assumes `req.body.Data.InvoiceId` is always present. For `RefundStatusChanged` events, `InvoiceId` is present in MyFatoorah payloads, but we must handle `RefundId` safely and avoid attempting to update payment statuses using refund payloads.
- Row locking must be extremely careful to prevent Deadlocks if multiple admins click "Refund" simultaneously. We will lock the `payments` row before creating the refund record.
