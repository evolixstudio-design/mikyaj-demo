# Mikyaj Kuwait: live-site audit and implementation plan

Audit date: 3 October 2026 (Asia/Kolkata). Site: https://mikyajkw.com/

## Decision

The store needs functional repairs, a coherent mobile-first storefront, and completion of its database-backed management modules. A visual redesign alone will leave broken purchase paths in place.

Keep the existing HTML/CSS/JavaScript, Express, PostgreSQL/Neon, Cloudinary, Netlify, Render, and MyFatoorah architecture. Modernize shared frontend components and rendering without a framework migration. Plan first, as requested; this audit has not changed application source or production configuration.

## What was tested

- Live home, shop, a real product, empty and populated cart, checkout, and payment-result page, in Chromium at desktop 1440×900 and iPhone 13 emulation at 390×664 CSS pixels.
- Mobile menu, price sorting, a search, a header category link, shop-card add-to-cart, homepage featured add-to-cart, product-detail add-to-cart, and Arabic mode.
- Public health, products, categories, brands, robots, sitemap, and missing stylesheet responses.
- Source inspection of storefront, API routes, checkout, schema files, admin data wiring, hosting configuration, and existing test setup.
- Separate cold-browser-cache mobile runs with 1.6 Mbps download, 150 ms added latency, and 4× CPU slowdown.

These are diagnostic browser runs, not Lighthouse scores, real-device Safari tests, Kuwait field measurements, or a complete security audit. No checkout was submitted, payment created, production database modified, or authenticated admin/driver session exercised. Existing E2E fixtures write to a database; they were not run against an unknown database target.

## Confirmed findings

| Priority | Finding and evidence | Consequence |
| --- | --- | --- |
| P0 | Product-detail Add to Bag passes a numeric ID into a helper that treats non-string arguments as product objects. The live test stored an item with quantity but no product ID, name, or price. | Customers can reach checkout with an invalid cart. |
| P0 | Homepage featured button references `prod-001`, absent from the API product cache. Clicking it produced `Cannot read properties of undefined (reading 'id')`. | Featured product cannot be purchased from this button. |
| P0 | Checkout and payment-result pages reference `theme.css`, `components.css`, and `layout.css`; all three return 404. Populated checkout renders largely unstyled. | Broken and inconsistent checkout experience. |
| P1 | Hero banner and inner-page logo return 404. The assets exist locally but are not Git-tracked: the root `images/` ignore rule also matches `frontend/mikyaj-demo/assets/images/`. | Production deploys omit essential design assets. |
| P1 | At a 390 px screen width, the homepage has 438 px scroll width and shop has 443 px. Mobile header icons and shop controls extend beyond the screen. | Clipped controls and poor mobile sizing. |
| P1 | Main navigation uses `cat-skincare`, `cat-makeup`, etc.; the catalog uses different slugs. The skincare header link returned zero products. | Major navigation paths appear empty despite an active catalog. |
| P1 | Price: Low to High leaves the live product order unchanged. The client does not send a sort parameter; the API orders by ID. | Sorting is cosmetic. |
| P1 | Shop waits for categories, then brands, then products. Homepage also fetches categories before products. | Unnecessary delay before merchandise appears. |
| P1 | Generic CSS selectors override every inline grid on mobile; responsive rules are split across imported mobile CSS and later main CSS. | Fixes conflict and affect unrelated components. |
| P1 | Product/category/brand/customer admin pages use localStorage demo records and a different login flag from real admin API sessions. | Editing those screens does not manage the production catalog or customers. |
| P1 | No customer-account routes or customer/address tables were found in the checked source. | Registration, saved addresses, and account order history need implementation. |
| P1 | Checkout accepts a free-text address and totals product prices without a configured delivery charge. Storefront delivery promises are inconsistent. | The business needs authoritative Kuwait delivery rules. |
| P1 | Search terms and product content are inserted into HTML strings in several places. | Replace unsafe rendering and validate inputs as part of the rebuild. Exploitability was not tested live. |
| P2 | Brands API returns `[]`; homepage displays “No brands available.” | Empty promotional section instead of useful shopping content. |
| P2 | Arabic mode sets RTL but retains substantial English navigation and marketing text. | Incomplete bilingual experience. |
| P2 | Support/policy links point to `#`, WhatsApp uses a placeholder number, and generic product instructions/promises are hardcoded. | Incomplete support and potentially inaccurate customer information. |
| P2 | English `lipstick` search returned no products in the sampled catalog. | Catalog language/search quality needs review; this single query does not establish that search itself is broken. |
| P2 | `robots.txt` and `sitemap.xml` return 404. Sampled shop and product pages have no description, canonical, or product structured data. | Technical SEO is unfinished. Missing robots alone does not prohibit indexing. |

### Performance observations

| Measurement | Observed result |
| --- | --- |
| Desktop homepage LCP, ordinary connection, one run | 4.87 s |
| Desktop shop LCP, same browser context, one run | 5.00 s |
| Mobile shop LCP, throttled cold browser cache | 5.23 s |
| Mobile shop load event, throttled run | 10.40 s |
| Mobile homepage load event, throttled run | 8.22 s |
| Transferred bytes at end of throttled observation | About 1.28 MB homepage; 1.61 MB shop |
| First homepage product position, throttled mobile run | About 3,903 px below page top |

Mobile homepage LCP was about 2 s in the throttled run, but it measured the initial text while the hero image was broken and products were far down the page. It is not evidence that the overall shopping experience is fast. An earlier approximate visual estimate of product position was about 4,600 px; use the measured 3,903 px baseline above.

Desktop shop also showed substantial layout movement while filters/products populated. The initial audit script records a raw sum of shifts; do not treat that sum as a certified CLS value. Use standard session-window CLS measurement for release verification.

Public API requests succeeded. Sampled warm responses generally took hundreds of milliseconds. Render cold starts, deployment tier, database region, and sustained load remain unverified; do not assume hosting upgrades are the primary fix without measurements.

Live/local HTML differences inspected so far are primarily Netlify rewriting `.html` links to clean paths. Shared CSS/API/mobile JS matched byte-for-byte. This is not evidence of an unrelated deployed codebase.

## Implementation sequence

### 1. Repair purchase paths and deployment assets

1. Correct the asset ignore rule narrowly so design assets ship while the excluded multi-gigabyte catalog archive stays excluded.
2. Replace obsolete checkout/result CSS references with the real shared styles and resolve missing utility classes.
3. Normalize product IDs and product objects at the cart boundary; reject missing/invalid items, handle malformed stored carts, and preserve existing valid carts.
4. Bind the featured purchase action to a real sellable product, or replace it with a collection link.
5. Map navigation to actual category slugs and support old links where practical.
6. Add meaningful regression coverage for these failures with public-data fixtures and mocked payment calls.

Exit condition: home → category → product → cart → checkout works on desktop and mobile, with correct product identity, quantity, and prices, and no missing required assets.

### 2. Build the storefront around mobile shopping

Design direction: a clean beauty retailer using ivory/white surfaces, dark readable text, restrained Mikyaj terracotta accents, strong product photography, and consistent spacing. Use concise shopping language and accurate business claims.

- **Shared shell:** compact logo/search/cart header, category navigation, accessible mobile drawer, one language control, consistent footer and support links.
- **Homepage:** one compact campaign section, a short selection of categories, products early on the page, additional collections, verified delivery information. Expand the full category directory on demand. Hide empty brand sections until real data exists.
- **Shop:** two-column mobile cards, readable three-decimal KWD prices, clear Add to Bag actions, usable filter sheet, working sort/search, active-filter chips, pagination, proper loading/empty/error states.
- **Product:** properly sized gallery, name/brand/price, genuine description, relevant options only, quantity, wishlist, and an accessible sticky mobile purchase control. Avoid universal “how to use” text for unrelated products.
- **Cart/checkout:** legible editable items, delivery costs before payment, structured address fields, clear validation, visible order total, retry/recovery behavior, and consistent payment-result states.
- **Language/accessibility:** translate the complete shopping journey, test RTL, visible focus, labelled controls, keyboard navigation, contrast, zoom, and touch targets. Remove duplicate or nonfunctional controls.

Build reusable templates/components within the existing stack; replace broad inline-style selectors with scoped classes. Review home, shop, and product previews before extending the design across the whole store.

### 3. Improve speed with measurements

- Start independent catalog requests together; render products without waiting for filter metadata.
- Cache public categories/brands and carefully cache public catalog responses. Never cache personalized account, checkout, payment, or admin responses publicly.
- Add request cancellation/timeouts, preserve the latest search/filter selection, and offer clear retries.
- Deliver appropriate Cloudinary image widths, modern format/quality negotiation, responsive image candidates, fixed aspect ratios, and below-fold lazy loading. Prioritize the visible hero/product image.
- Reduce font weights and icon payloads; avoid nested render-blocking CSS imports. Keep the Arabic font deliberate and appropriately subsetted.
- Reserve loading space to prevent page jumps; reduce unnecessary UI injection and DOM work.
- Profile API queries, pagination, search indexes, and database connection behavior before changing them. Check Render sleep/region/plan and Neon latency separately.
- Use versioned assets and safe cache headers; verify deployment asset paths and real 404 behavior.

Targets: LCP ≤2.5 s, CLS ≤0.1, and INP ≤200 ms at the 75th percentile when field data is available. These are [Google's Core Web Vitals thresholds](https://web.dev/articles/vitals), not guaranteed scores. Compare repeatable before/after lab runs under identical conditions; later validate real users separately.

### 4. Complete the core commerce modules

| Module | Work | Verification |
| --- | --- | --- |
| Customer accounts | Registration/login/logout, password recovery, profile, saved addresses, own orders; retain guest checkout | Password handling, session expiry, rate limits, ownership tests; transactional email configuration for recovery |
| Catalog management | Authenticated database product/category/brand CRUD; Cloudinary images; safe product disabling | Admin changes appear in storefront; unauthorized writes rejected; historical orders preserved |
| Customer management | Database customer list, search, customer detail and order history | Accurate data; permissions and privacy boundaries |
| Kuwait delivery | Governorate/area/address structure, +965 normalization, fees/thresholds from approved rules | Server recomputes delivery and totals; UI agrees; invalid combinations rejected |
| Payments | Verify merchant environment, KNET/cards, callbacks/webhooks, amount validation, idempotency and pending/failure/retry cases | Sandbox E2E before a separately coordinated live smoke purchase; configuration evidence |
| Operations | Regression-test order management, driver assignment/ownership, delivery, refunds and reconciliation | Isolated test database and sandbox provider; existing state transitions preserved |
| Supporting pages | Real support/contact, delivery/returns/privacy, account/wishlist navigation | Correct links, owner-supplied policies and contact details |

`render.yaml` currently specifies the MyFatoorah sandbox base URL. Production dashboard values may differ; live payment readiness is unverified. Preserve backend-authoritative pricing and `payments.status = SUCCESS` / `orders.status = CONFIRMED` semantics.

Implement basic sellable/unavailable behavior in the core catalog. Full warehouse inventory, coupons, notification campaigns, analytics dashboards, and ERP remain separate from the core completion scope because the supplied history deferred them. Remove or clearly disable misleading demo controls until their real feature is approved and implemented.

### 5. Build SEO foundations during development; finish SEO after functional QA

- Decide stable product/category URLs and English/Arabic URL behavior before building templates; retain redirects for existing URLs where changed.
- Make essential product/category content and metadata available in initial HTML through build-time generation or carefully scoped server rendering within the existing architecture. Keep prices refreshed and backend checkout authoritative.
- Add unique titles/descriptions, canonicals, crawlable internal links, breadcrumbs, genuine product image alt text, sitemap and robots controls.
- Define index/noindex behavior for cart, checkout, account, internal search, and filter combinations without exposing private data.
- Add accurate Product/Offer/Breadcrumb/Organization structured data backed by actual product and business information; no invented reviews or availability.
- Finish Kuwait-focused English/Arabic category copy and product data cleanup, image optimization, Search Console verification/sitemap submission, and Merchant Center eligibility/feed work if desired.
- Validate structured data and indexing after deployment; rankings cannot be guaranteed.

Reference: [Google ecommerce URL guidance](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) and [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product).

### 6. Release gate and deployment

Test widths 360, 375, 390, 412, 768, 1280, and 1440; English and Arabic; Chromium and WebKit where available; keyboard and touch; slow networks and API failure states. Test real devices before calling mobile QA complete.

Required purchase scenarios: add from every entry point; quantity/remove; persistence; sorting across pagination; category/search; unavailable product; changed price; delivery validation; guest/account checkout; repeated submission; payment success/failure/pending; callback/webhook repeat; order ownership; admin/driver/refund regressions.

Run database-writing tests only against a confirmed isolated test database. Review migrations and rollback before production. Prepare a preview, compare before/after measurements and screenshots, then deploy a verified version with a rollback path and run production smoke checks. Live credentials and provider activation are operational prerequisites, not frontend fixes.

## Owner information needed while work proceeds

- Payment methods: MyFatoorah/KNET/cards only, or cash on delivery as well.
- Actual delivery fees, free-delivery threshold, coverage, and delivery times.
- Actual support WhatsApp number and business/policy details.
- When required for release: access through the existing Netlify, Render, Neon, MyFatoorah, and Search Console accounts. Do not paste secret keys into the report.

The audit requested the first two groups of information in chat. UI and technical repair work can proceed independently; do not invent final fees, contact information, or payment readiness.

## Evidence and current changes

Evidence is saved in `docs/audit-2026-10-03/`: raw page/network JSON, screenshots, flow checks, public source snapshots, and repeatable diagnostic scripts. Some full-page mobile screenshots capture unloaded below-fold lazy images; that is not proof those image URLs are broken. Use explicit network failures for broken-asset findings.

Only this plan and audit artifacts were added. Application source, secrets, database, and production deployment remain unchanged. No commit or push was made.
