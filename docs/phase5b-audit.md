# Phase 5B — Admin Order Management Frontend Audit

## 1. Existing Admin Architecture
The project currently has an `admin/` folder containing prototype/mockup HTML files. These include:
- `login.html`: Uses a hardcoded mock login (`admin` / `mikyaj2025`).
- `orders.html`: Contains a mockup UI for listing orders and a modal for order details, powered by `MikyajStore` mock data in `js/store.js`.
- Other placeholder pages (`dashboard.html`, `products.html`, etc.).

## 2. Existing Design Language & Styles
- **CSS Architecture**: `css/main.css` contains all the administrative styles including `.admin-layout`, `.admin-sidebar`, `.stat-card`, `.data-table`, and status badges (`.badge-warning`, `.badge-success`, etc.).
- **Typography & Colors**: Uses Material Symbols and a clean, operational color palette (CSS variables like `--surface-container`, `--primary`, `--error`).
- **Responsive**: The admin layout has a sidebar and main content area. It is structurally responsive but prioritizes desktop.

## 3. Existing JavaScript & API Architecture
- **API Helper**: `js/api.js` contains `MikyajAPI.fetchJson`, but it does not support JWT headers or POST requests.
- **State Management**: `js/store.js` (`MikyajStore`) uses `localStorage` heavily for cart and mock admin state.
- **Global Helper**: `js/app.js` (`MikyajApp`) has utility functions like `formatKWD`, `formatDate`, and `showToast`.

## 4. Phase 5B Strategy

### Authentication Strategy
- **Storage**: We will use `localStorage` under the key `mikyaj_admin_session` to store the JWT and admin identity. Passwords will never be stored.
- **Protection**: Every admin page will run an inline script to check for the JWT. If missing, it will immediately redirect to `login.html`.

### API Integration Strategy
- We will extend `js/api.js` to include `MikyajAPI.adminFetch(url, options)`.
- `adminFetch` will automatically append the `Authorization: Bearer <token>` header.
- If a 401 Unauthorized is detected, it will clear `mikyaj_admin_session` and redirect to `login.html`.
- It will reuse `MikyajAPI.BASE_URL` to ensure it works across localhost and Render production.

### Pages to Modify & Create
1. **Modify `admin/login.html`**:
   - Change input to `email` and `password`.
   - Call `POST /api/admin/auth/login`.
   - Store JWT in `mikyaj_admin_session` on success.
2. **Modify `admin/orders.html`**:
   - Remove mock data rendering.
   - Call `GET /api/admin/orders`.
   - Implement server-side search, status filters, payment filters.
   - Implement cursor-based pagination (`next_cursor`).
   - Remove the detail modal. Change the "View" action to navigate to `order-detail.html?orderNumber=...`.
3. **Create `admin/order-detail.html`**:
   - New standalone page.
   - Reads `orderNumber` from URL parameters.
   - Calls `GET /api/admin/orders/:orderNumber`.
   - Displays Customer Info, Address, Items (historical prices), Financial Summary.
   - Calls `GET /api/admin/orders/:orderNumber/payments` to display separate payment attempt history.
   - Calls `GET /api/admin/orders/:orderNumber/history` to display the chronological status timeline.
   - Provides safe UI for `PATCH /api/admin/orders/:orderNumber/status`.
   - Provides a cancellation modal for `POST /api/admin/orders/:orderNumber/cancel` requiring a reason.

### Data fetching & Safety
- **No Catalog Download**: The admin pages will NOT load `js/catalog-data.js` or `js/seed-data.js` to avoid the 2GB catalog loading penalty.
- **Conflict Handling**: HTTP 409 responses on status updates will be caught and will display an actionable message asking the user to refresh.
