# Phase 7 — Payment Reconciliation & Refund Management

## 1. Executive Summary
Phase 7 establishes a secure, robust financial operations layer enabling administrators to request and track MyFatoorah refunds directly from the Mikyaj backend. It implements strict data boundaries to ensure that multiple partial refunds never exceed the original paid amount, provides explicit row-locking to prevent concurrent over-refunding, and implements a reconciliation layer that continually maps local state against external provider truth.

## 2. Existing Payment Architecture Audit
The audit confirmed the `payments` table tracks provider states strictly up to the `SUCCESS` threshold via MyFatoorah V2 callbacks. Orders can have multiple payment attempts, but refunds are restricted to solely evaluating against `provider_payment_id` on `SUCCESS` states. Order cancellation behavior (from Phase 5) was verified to be strictly operational, correctly separating fulfillment status from financial settlement.

## 3. MyFatoorah Documentation Reviewed
- **Version:** V2
- **Date Reviewed:** October 2026
- **Refund API Endpoint:** `POST /v2/MakeRefund`
- **Refund Request Fields Used:** `KeyType`, `Key` (PaymentId), `RefundChargeOnCustomer`, `ServiceChargeOnCustomer`, `Amount`, `Comment`, `AmountDeductedFromSupplier`.
- **Refund Response Fields Used:** `RefundId`, `RefundReference`, `RefundStatus`.
- **Refund Webhook Event:** `RefundStatusChanged`
- **PaymentId Source:** Populated securely in the `payments.provider_payment_id` column upon `GetPaymentStatus` success.
- **Webhook Signature:** Preserved existing `HMAC-SHA256` alphabetized object flattening technique.

## 4. Refund API Selected
The existing integration operates successfully on V2. Following architectural constraints, we extended `myfatoorah.js` using `/v2/MakeRefund` instead of initiating a needless V3 migration. 

## 5. Refund Data Model
Implemented a dedicated `refunds` table linking `order_id` and `payment_id`. Fields store strictly operational context (`requested_by_admin_id`, `amount`, `status`, `reason`, `idempotency_key`) alongside provider tracking IDs (`provider_refund_id`, `provider_reference`).

## 6. Refund Lifecycle
1. **PENDING:** Local request formulated inside a locked transaction.
2. **PROVIDER CALL:** Network dispatch to MyFatoorah.
3. **REFUNDED / PROCESSING / FAILED:** Updated upon direct provider response or incoming `RefundStatusChanged` webhook.

## 7. Partial Refund Logic
Refund amounts are not binary flags. The backend queries `SUM(amount) WHERE status IN ('PENDING', 'REFUNDED')` to calculate a dynamic local ledger. Multiple partial refunds stack cleanly until the mathematical `remaining` balance reaches exactly zero.

## 8. Payment/Refund Reconciliation
A standalone `reconciliation-service.js` calculates `paidAmount`, `refundedCompletedAmount`, and `refundedPendingAmount`. It operates in read-only mode, generating deterministic `RECONCILED` or `WARNING` tags (e.g. flagging missing provider IDs or theoretical over-refunds) rather than silently mutating financial truth.

## 9. Webhook Handling
Extended the existing `/api/webhook/myfatoorah` route with a segregated `RefundStatusChanged` execution path. It looks up `provider_refund_id` and safely updates status. "Unknown" provider refunds arriving via webhook are safely logged into the database with a fallback reason for reconciliation flagging.

## 10. Idempotency
Implemented a unique `idempotency_key` mechanism on the `refunds` table. Replays of identical operations resolve to returning the existing refund ID without re-dispatching an external network call, preventing duplicate double-clicks from mutating external financial state.

## 11. Concurrency
Implemented stringent `SELECT ... FOR UPDATE` row-level locks on the parent `payments` record prior to summing remaining balances. This strictly prevents a race condition where two simultaneous admin HTTP calls might calculate the same remaining balance and double-refund the same tranche.

## 12. Financial Safety
All validation adheres strictly to 3 decimal places (KWD schema standards) natively avoiding JS binary float vulnerabilities via database precision limits. Zero or negative inputs instantly trigger `INVALID_AMOUNT` exceptions. 

## 13. Security
Refund operations are heavily protected behind the `requireAdminAuth` JWT layer. Raw provider payload responses and secrets are not relayed to the frontend client. `order_id` vs `payment_id` relationship checks prevent IDOR attacks attempting to refund Order A utilizing Payment B's identity.

## 14. APIs
Admin interfaces delivered under standard REST conventions:
- `POST /api/admin/orders/:orderNumber/refunds`
- `GET /api/admin/refunds`
- `GET /api/admin/refunds/:id`
- `GET /api/admin/orders/:orderNumber/refunds`
- `GET /api/admin/orders/:orderNumber/reconciliation`

## 15. Database Changes
Executed via non-destructive `database/schema-phase7.sql`:
- Created `refunds` table with multi-column indexing optimized for webhook lookups and dashboard retrieval.

## 16. Tests
Simulated Node tests (`test-refunds.js`) confirmed:
1. Partial refund bounds calculations.
2. Exhaustive balance calculations (success).
3. Over-refund blocking (caught error).
4. Idempotent replays (safe merge).
5. Precision boundaries (zeroes blocked).
6. Reconciliation state extraction.

## 17. Regression
- Checked public storefront payment callbacks. (Untouched and stable)
- Checked Phase 5B / 6A webhooks. (Maintained via segregated `if` branching)
- Order detail data integrity maintained.

## 18. Known Limitations
- The system flags unmatched external refunds into the DB for reconciliation, but currently lacks an explicit UI alert mechanism to loudly display warnings to admins beyond the reconciliation API JSON object.
- Network partitions occurring exactly after MyFatoorah receives a request but before the Node server receives the response will leave the local row as `PENDING`, awaiting webhook sync.

## 19. Deferred Work
- Full GUI development of Admin Order Detail rendering refund tables and reconciliation warnings.
- End-of-month broad ledger CSV export.

## 20. Final Verdict
**VERIFIED COMPLETE**
