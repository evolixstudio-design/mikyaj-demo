# Phase 6B: Driver Dashboard Frontend Forensic Audit

## 1. Reusable Layout
- The `admin-layout` in `main.css` (`.admin-layout`, `.admin-sidebar`, `.admin-main`) is suitable for the driver UI, providing a neat separation.
- It includes mobile responsiveness natively: the sidebar collapses via `.admin-sidebar { transform: translateX(-100%); }` at 1024px.
- However, since drivers have very few routes (just the Dashboard), a streamlined top-bar layout or a simplified `admin-layout` will be used for maximal screen real-estate on mobile.

## 2. Reusable API Helper
- `js/api.js` exports `MikyajAPI`.
- It currently includes `adminFetch(endpoint, options)`.
- **Action Required**: Add `driverFetch(endpoint, options)` to `MikyajAPI`. This will mirror `adminFetch` but parse `mikyaj_driver_session` from `localStorage` instead of `mikyaj_admin_session`, and handle 401 redirects to `driver/login.html`.

## 3. Authentication Patterns
- JWT is stored locally.
- In `admin/login.html`, successful login sets `localStorage.setItem('mikyaj_admin_session', ...)` and redirects to `orders.html`.
- In `driver/login.html`, we will set `mikyaj_driver_session` and redirect to `dashboard.html`.

## 4. Existing CSS Utilities
- Extensive utilities are available in `main.css`: `.card`, `.flex`, `.flex-between`, `.btn`, `.btn-primary`, `.btn-outline`, `.badge` (e.g. `.badge-primary`, `.badge-success`), `.form-group`, `.form-input`.
- We will strictly utilize these instead of writing new CSS to maintain style uniformity.

## 5. Existing Responsive Behavior
- `main.css` explicitly re-stacks grid components dynamically and shrinks paddings via `@media (max-width: 768px)`.
- For order listings on mobile, instead of standard desktop tables (`.data-table`), we will implement card-based order lists, which are friendlier for drivers using mobile devices on the road.

## 6. Files to Create
- `frontend/mikyaj-demo/driver/login.html`
- `frontend/mikyaj-demo/driver/dashboard.html`
- `frontend/mikyaj-demo/driver/order-detail.html`

## 7. Files to Modify
- `frontend/mikyaj-demo/js/api.js` (to append `driverFetch`)

## 8. API Integration Strategy
- Driver dashboard fetches `GET /api/driver/orders` to build the list.
- Order detail uses `GET /api/driver/orders/:orderNumber`.
- Action buttons trigger `POST /api/driver/orders/:orderNumber/start-delivery` and `POST /api/driver/orders/:orderNumber/mark-delivered`.
- Refresh/reload mechanisms must be hooked on HTTP 409 responses to guarantee state accuracy.
