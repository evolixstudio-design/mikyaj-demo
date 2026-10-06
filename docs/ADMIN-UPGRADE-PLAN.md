# Mikyaj commerce admin upgrade

Reference: the user-supplied complete admin brief dated 5 October 2026 and four Shopify workflow screenshots. The screenshots are UX references; Mikyaj keeps its own identity.

## Implementation order

1. Shared media pipeline, category/brand images, minimal product editor and inline taxonomy creation.
2. Reusable bilingual translation with manual corrections preserved and explicit service failures.
3. Paginated catalog table, filters, sorts, saved views and audited bulk actions.
4. Backend permissions, staff management, customer profiles and login routing.
5. Searchable configured Kuwait delivery areas and saved-address management.
6. Authoritative checkout discounts, schedules, eligibility and usage limits.
7. Item-level returns, private evidence and optional WhatsApp handoff.
8. Privacy-conscious events and real commerce reporting.
9. Responsive admin shell, settings, content, notifications, global search and themes.

## Validation and release

Use the isolated PostgreSQL fixture, API regression tests and desktop/tablet/mobile browser checks. Preserve payment verification and order history. Apply migrations locally first. Production deployment and external credentials remain separate prerequisites; do not label unconnected services as live.

## Requirement checklist

Updated 5 October 2026. “Implemented locally” means working in the local build, not a production release or a claim of full compliance with every detail in the source brief. “Partial” identifies remaining integration or workflow gaps. Validation: build, 9 commerce API tests, 11 admin API tests, 2 catalog tests and responsive admin browser suite.

| # | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Overall Goal | Partial | Local upgrade implemented and tested; remaining phases and release prerequisites are in ANTIGRAVITY-HANDOFF.md. |
| 2 | Admin Navigation / Shopify-Style Layout | Implemented locally | Modular admin shell, navigation, themes and browser checks at 1440/820/390 px. |
| 3 | Global Admin Search | Implemented locally | Permission-scoped search across catalog, orders, customers, discounts and settings. |
| 4 | Admin Dashboard Home | Partial | Real order/event reporting; retention, attributable purchase/conversion reporting and broader dashboard metrics remain. |
| 5 | Mobile Brand Visibility | Partial | Brand navigation and taxonomy image rendering work; complete assignment of authorized category/brand artwork remains. |
| 6 | Homepage Category Images | Partial | Brand navigation and taxonomy image rendering work; complete assignment of authorized category/brand artwork remains. |
| 7 | Brand Images | Partial | Brand navigation and taxonomy image rendering work; complete assignment of authorized category/brand artwork remains. |
| 8 | Simplify Add Product Form | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 9 | Remove SEO Fields From Product Form | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 10 | Create Category While Adding Product | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 11 | Create Brand While Adding Product | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 12 | Image Processing System | Partial | Decoded image validation, WebP resize and Mikyaj watermark implemented; original retention and full-catalog visual review remain. |
| 13 | Product Image Watermark | Partial | Decoded image validation, WebP resize and Mikyaj watermark implemented; original retention and full-catalog visual review remain. |
| 14 | Automatic Arabic ↔ English Translation | Partial | Local bilingual model service and empty-field translation work; all-form integration, provenance and editorial review remain. |
| 15 | Shopify-Style Product Management | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 16 | Product Search | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 17 | Product Filters | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 18 | Product Sorting | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 19 | Saved Product Views | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 20 | Bulk Product Actions | Implemented locally | Minimal product form, inline taxonomy, searchable paginated catalog, filters/sorts/views and audited bulk actions; API/browser tests. |
| 21 | Orders Module | Partial | Order filters, fulfilment, history, money records, discount/tax totals and print summary; formal invoices and further fulfilment UX remain. |
| 22 | Order Detail Screen | Partial | Order filters, fulfilment, history, money records, discount/tax totals and print summary; formal invoices and further fulfilment UX remain. |
| 23 | Customer Accounts Saved in Backend | Implemented locally | Backend accounts and owner-scoped saved addresses with atomic defaults; API and shopping browser tests. |
| 24 | Customers Module | Partial | Customer list has 40-row search/status pagination; profiles show addresses/orders/returns; guest profiles and history pagination remain. |
| 25 | Customer Profile Screen | Partial | Customer list has 40-row search/status pagination; profiles show addresses/orders/returns; guest profiles and history pagination remain. |
| 26 | Unified Login Interface | Partial | Unified sign-in routing and server-enforced roles/session revocation; customer-to-staff identity linking and invitation delivery remain. |
| 27 | Users / Staff Module | Partial | Unified sign-in routing and server-enforced roles/session revocation; customer-to-staff identity linking and invitation delivery remain. |
| 28 | Roles and Permissions | Partial | Unified sign-in routing and server-enforced roles/session revocation; customer-to-staff identity linking and invitation delivery remain. |
| 29 | Visitor / User / Customer Separation | Partial | Real order/event reporting; retention, attributable purchase/conversion reporting and broader dashboard metrics remain. |
| 30 | Website Traffic Tracking | Partial | Real order/event reporting; retention, attributable purchase/conversion reporting and broader dashboard metrics remain. |
| 31 | Commerce Analytics Events | Partial | Real order/event reporting; retention, attributable purchase/conversion reporting and broader dashboard metrics remain. |
| 32 | Analytics Module | Partial | Real order/event reporting; retention, attributable purchase/conversion reporting and broader dashboard metrics remain. |
| 33 | Kuwait Address Search at Checkout | Partial | Searchable configured Kuwait areas with saved-address selection; comprehensive street/block library or geocoder not connected. |
| 34 | Kuwait Address Library | Partial | Searchable configured Kuwait areas with saved-address selection; comprehensive street/block library or geocoder not connected. |
| 35 | Add New Address | Implemented locally | Backend accounts and owner-scoped saved addresses with atomic defaults; API and shopping browser tests. |
| 36 | Saved Addresses | Implemented locally | Backend accounts and owner-scoped saved addresses with atomic defaults; API and shopping browser tests. |
| 37 | Floating WhatsApp Button | Implemented locally | Configurable floating support action with mobile offsets and purchase-control collision handling. |
| 38 | Discounts / Offers Redesign | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 39 | Amount Off Products | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 40 | Buy X Get Y | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 41 | Amount Off Order | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 42 | Free Shipping | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 43 | Automatic vs Discount Code | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 44 | Discount Scheduling | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 45 | Discount Usage Limits | Implemented locally | Discount type chooser, all four types, codes/automatic schedules and limits enforced at checkout; API/browser tests. |
| 46 | Discount Combination Rules | Partial | One discount per class, valid-combination selection and list actions work; per-class controls and list filters/pagination remain. |
| 47 | Discounts Listing Page | Partial | One discount per class, valid-combination selection and list actions work; per-class controls and list filters/pagination remain. |
| 48 | Return Request Flow | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 49 | Return Reasons | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 50 | Return Evidence Upload | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 51 | Return Ticket System | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 52 | Return → WhatsApp Handoff | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 53 | Return History | Implemented locally | Item-level tickets, reasons, private images, ownership, status history and explicit WhatsApp link; partial return regression tests. |
| 54 | Content Management | Partial | Home hero/visibility, navigation, journal and real management links; flexible merchandising and connected marketing workflows remain. |
| 55 | Online Store / Sales Channel | Partial | Home hero/visibility, navigation, journal and real management links; flexible merchandising and connected marketing workflows remain. |
| 56 | Growth / Marketing | Partial | Home hero/visibility, navigation, journal and real management links; flexible merchandising and connected marketing workflows remain. |
| 57 | Markets | Partial | Kuwait/KWD and bilingual market supported; additional market management not implemented. |
| 58 | Shopify-Style Settings Area | Implemented locally | Settings sections route to working modules; checkout guest/notes enforced server-side; opt-in event setting works. |
| 59 | Settings → General | Partial | General/contact/location values save; some storefront text and structured data still use original values. |
| 60 | Settings → Users | Implemented locally | Settings sections route to working modules; checkout guest/notes enforced server-side; opt-in event setting works. |
| 61 | Settings → Payments | External prerequisite | Gateway adapter/configuration exists; production payment, Google OAuth and email credentials/testing remain. |
| 62 | Settings → Checkout | Implemented locally | Settings sections route to working modules; checkout guest/notes enforced server-side; opt-in event setting works. |
| 63 | Settings → Customer Accounts | Partial | Registration setting is enforced by API; full UI/options and Google sign-in remain. |
| 64 | Settings → Shipping and Delivery | Implemented locally | Editable delivery areas/fees, cap 3 KWD, supported-area requirement and free threshold 10 KWD. |
| 65 | Settings → Taxes and Duties | Partial | Disabled-by-default additive tax applied after discounts and snapshotted on orders; no duties/jurisdiction engine. |
| 66 | Settings → Locations | Partial | General/contact/location values save; some storefront text and structured data still use original values. |
| 67 | Settings → Apps / Integrations | External prerequisite | Gateway adapter/configuration exists; production payment, Google OAuth and email credentials/testing remain. |
| 68 | Settings → Sales Channels | Partial | Online Store links and settings work; third-party sales channels are not connected. |
| 69 | Settings → Domains | External prerequisite | Read-only domain configuration guidance; hosting/DNS/certificate ownership must be verified externally. |
| 70 | Settings → Customer Events | Implemented locally | Settings sections route to working modules; checkout guest/notes enforced server-side; opt-in event setting works. |
| 71 | Settings → Notifications | Partial | In-app read/unread notifications work; email/SMS delivery is not connected. |
| 72 | Custom Fields / Metafields | Implemented locally | Typed product field definitions and values; public visibility enforced and private values tested. |
| 73 | Admin Page Headers | Implemented locally | Modular admin shell, navigation, themes and browser checks at 1440/820/390 px. |
| 74 | Shopify-Style Modals | Implemented locally | Reusable dialogs, progressive product form, save/error toasts and tested discount chooser. |
| 75 | Progressive Forms | Implemented locally | Reusable dialogs, progressive product form, save/error toasts and tested discount chooser. |
| 76 | Sticky Save / Unsaved Changes | Partial | Product dirty-state protection exists; universal sticky save/discard across remaining forms is incomplete. |
| 77 | Toast Notifications | Implemented locally | Reusable dialogs, progressive product form, save/error toasts and tested discount chooser. |
| 78 | Responsive Admin | Implemented locally | Modular admin shell, navigation, themes and browser checks at 1440/820/390 px. |
| 79 | Dark and Light Mode | Implemented locally | Modular admin shell, navigation, themes and browser checks at 1440/820/390 px. |
| 80 | Security Requirements | Partial | Migrations, server permissions, money/stock/evidence tests; real PostgreSQL concurrency, CSP and production security audit remain. |
| 81 | Database / Backend Architecture | Partial | Migrations, server permissions, money/stock/evidence tests; real PostgreSQL concurrency, CSP and production security audit remain. |
| 82 | Performance | Partial | Bounded catalog queries, WebP/assets and responsive checks; actual-host performance and complete keyboard/accessibility audit remain. |
| 83 | Accessibility and UX | Partial | Bounded catalog queries, WebP/assets and responsive checks; actual-host performance and complete keyboard/accessibility audit remain. |
| 84 | Implementation Strategy | Partial | Local upgrade implemented and tested; remaining phases and release prerequisites are in ANTIGRAVITY-HANDOFF.md. |
| 85 | Development Rules | Partial | Local upgrade implemented and tested; remaining phases and release prerequisites are in ANTIGRAVITY-HANDOFF.md. |
| 86 | Shopify UX Benchmark | Partial | Local upgrade implemented and tested; remaining phases and release prerequisites are in ANTIGRAVITY-HANDOFF.md. |
| 87 | Final Deliverables | Partial | Local upgrade implemented and tested; remaining phases and release prerequisites are in ANTIGRAVITY-HANDOFF.md. |
