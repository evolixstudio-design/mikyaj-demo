# Page Visits dashboard and Commercial Registration Number — 20 October 2026

Status: implemented and checked locally. The user authorized the GitHub push on 20 October 2026. This changeset includes migration 024; application deployment and production migration completion must be verified separately. Existing production history has not been deleted or rewritten.

## Page Visits

The dashboard separates estimated browser visitors, 30-minute browsing sessions, unique pages per session and genuine page openings. Refreshes remain real page views but no longer inflate the visitor/session/unique-page totals. Network retries carrying the same view/event identity are ignored. A real-browser check opened the same product three times across English, Arabic and another tab: **1 visitor, 1 session, 1 unique page visit, 3 page views**.

New tracking uses a signed, HttpOnly first-party random browser cookie with a 90-day lifetime. It shares session identity across tabs after the cookie is established. A 30-minute activity gap begins a new session. Cookie expiry does not imply automatic deletion of reporting history. Visitor totals estimate browsers, rather than identifying every human across devices or private browsing.

Active time counts foreground activity and stops after 60 seconds idle. Hidden-tab time is excluded. Admin previews, marked test previews, known bots, Do Not Track and Global Privacy Control are excluded. Tracking does not save IP addresses, raw search queries, full referral URLs or customer addresses. The privacy policy describes the new behavior.

The dashboard provides:

- Eight immediately visible totals, previous-period comparisons and a chart using Kuwait dates.
- Today, yesterday, 7/30-day and custom dates; device, source, language, guest/signed-in and page-type filters.
- A sequential product → bag → checkout → saved-order funnel and observed drop-offs.
- Pages ranked by unique visits, views, active time, entrances and completed-session exits.
- Paginated anonymous visitor/session journeys and CSV export with spreadsheet-formula protection.
- Customer links only for administrators who have customer access. Guests remain anonymous.
- Refresh controls; no large chart library dependency.

Orders are attributed on the server, including guest COD. Pending online payment is a saved order, not evidence of collected revenue. Missing funnel steps can reflect privacy controls, legacy tracking or direct navigation. Legacy records remain visible with a warning: historical visitor/source information cannot be recovered retroactively. Exits are inferred from the last observed page after a session becomes inactive; they do not prove a reason for leaving.

## Commercial Registration Number

Admin → Settings → General has an optional **Commercial Registration Number · رقم السجل التجاري** field. The current value remains blank. Saving a real value displays it in both English and Arabic footers, including server-rendered pages; clearing it hides the row. It accepts bounded letters, numbers, spaces, hyphens and slashes, rejects HTML, and preserves the value if an older settings form omits the field. No competitor number or placeholder was published.

An isolated browser fixture saved TEST-CR-123, verified both footers and then cleared it. That test never changed production settings.

## Fixed-price offers

The local public Offers filter now includes active Special Offers category memberships alongside actual discounted products. Fixed-price products retain their real retail and a null compare-at price. A test checks 0.999 KWD, server-authoritative quotes, coexistence with a real discount and exclusion when the promotional category is inactive.

## Validation and review

- Forty distinct automated checks passed across this work, including existing admin/commerce regression checks. The final targeted run passed 23 checks covering traffic, client timing/privacy, commercial registration, offers, checkout and crawl/SEO behavior.
- Real browser: desktop/mobile dashboard, eight metrics, filtering, journeys, CSV export, optional bilingual registration and blank-value hiding passed.
- Separate real frontend tracking check confirmed the three-opening example and cross-tab HttpOnly identity.
- Desktop/mobile charts were visually checked and their dimensions verified so the general icon CSS cannot collapse them.
- Production storefront build passed; Git whitespace check passed.

Local isolated preview: http://127.0.0.1:3102/admin/manage.html?view=page-visits (sample data; not production analytics). Fixture credentials are defined in tests/isolated-db.cjs and are never production accounts.

Screenshots are under output/playwright/page-visits-*.png and commercial-registration-*.png. Native chart and table assets require no external analytics provider.

## Deployment sequence

1. Review only these application changes, migration 024, their tests and regenerated frontend asset-version HTML. Preserve unrelated test.js changes, other catalogue reports and private ignored files.
2. The existing Render start command runs scripts/migrate-commerce.cjs before backend/server.js. Ensure it applies database/migrations/024-traffic-dashboard.sql before the new backend starts. It adds session/event metadata and idempotency indexes without deleting legacy data.
3. Build and deploy the matching frontend/backend versions. Verify authenticated report access, anonymous tracking exclusions, a genuine repeated visit, fixed-price Offers membership, optional registration and ordinary checkout.
4. Leave the registration field empty until the shop provides the real number. Do not invent historical visitor identity or publish sample dashboard data.
