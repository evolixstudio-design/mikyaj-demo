# Phase 7B — Admin Refund & Reconciliation UI: Forensic Audit

## 1. Existing Admin UI Context
- **Order Detail (`admin/order-detail.html`)**: Already features a CSS Grid (`detail-grid`) for displaying Customer, Address, Items, Actions, Payments, and History. Modals are built using `.modal-overlay`, `.modal`, and standard form controls (`.form-group`, `.form-input`).
- **Admin Session (`js/api.js`)**: Managed seamlessly via `MikyajAPI.adminFetch` referencing the `mikyaj_admin_session` object in `localStorage`. 
- **Orders List (`admin/orders.html`)**: Allows filtering by `payment_status` (including `REFUNDED`).

## 2. APIs Required for Integration
- `GET /api/admin/orders/:orderNumber/payments` (Existing)
- `GET /api/admin/orders/:orderNumber/refunds` (New Phase 7 Backend API)
- `GET /api/admin/orders/:orderNumber/reconciliation` (New Phase 7 Backend API)
- `POST /api/admin/orders/:orderNumber/refunds` (New Phase 7 Backend API)

## 3. UI Modifications Planned
### `admin/order-detail.html`
1. **Reconciliation & Financial Overview Widget**: Add a visual summary of the order's financial ledger (Paid Amount, Refunded, Remaining, and Reconciliation Status) immediately adjacent to the Payments history.
2. **Refunds History Panel**: Similar timeline/card layout to existing payments. Lists all partial/full refund requests, their operational states (e.g. `PENDING`, `REFUNDED`), and their timestamps.
3. **Refund Action Button**: Dynamically injected into the financial overview widget ONLY if a `SUCCESS` payment is present.
4. **Refund Modal**: A dedicated `.modal` instance handling specific refund fields:
   - Read-only context (Paid, Refunded, Remaining)
   - Input: `Amount` (with 3 decimal precision attributes, step="0.001")
   - Input: `Reason` (Required)
   - "Confirm Refund Request" CTA utilizing double-click protection (disabling the button during network I/O).

### `js/api.js`
- No architectural modifications necessary. `MikyajAPI.adminFetch` successfully supports `POST`, `JSON` bodies, and standardized error parsing (`err.status`, `err.message`).

## 4. UX & Financial Safety Risks
1. **Client-side Math**: The UI must rely exclusively on `remainingRefundableAmount` provided by `/reconciliation` to populate maximum values. Client-side JS floating-point subtraction should only be utilized for superficial preview calculations within the modal, not for restricting the actual submission bounds programmatically.
2. **Success Ambiguity**: Modals must close and toast notifications must announce "Refund Request Submitted" (not "Refund Complete"). The exact `status` returned by the backend (`PENDING`, `REFUNDED`) must be displayed directly without frontend sanitization.
3. **Status Collision**: The `status` property in `/payments` (e.g. `SUCCESS`) must be visually distinguished from the refund's `status` (e.g. `REFUNDED`). The order status and payment status must remain unmutated by local JS assumptions.
