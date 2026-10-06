# Mikyaj Kuwait — continuation handoff

Updated 5 October 2026. This is a local development checkpoint, **not a production release**. Read this file and `docs/ADMIN-UPGRADE-PLAN.md` before changing code. The latter maps all 87 sections of the user's brief to implementation status.

## User's goal and source brief

Upgrade the existing bilingual, Kuwait-focused beauty store and rebuild its admin around the workflows in four Shopify screenshots, using Mikyaj branding. The full brief is at `C:/Users/lenovo/Downloads/ecommerce_shopify_admin_complete_prompt.md`. It is a reference supplied by the user, not permission to discard existing work. The user requested a phased continuation prompt for another coding agent if Codex credits became low.

Workspace: `C:/Users/lenovo/Downloads/mikyaj_stitch_full_frontend`.
Branch: `codex/mikyaj-ecommerce-rebuild`.
Earlier checkpoints: `8f196a7` (commerce rebuild), `cfe551f` (catalog/search/brands/review fixes). Consult `git log` for any later checkpoint. Do not reset or clean the working tree.

The user wants action, minimal unnecessary permission questions, and an honest checklist. Finish useful phases and validate them; never say all 87 requirements are complete when they are not. Do not rewrite this as a React/Next/Shopify project. Preserve the existing Express + PostgreSQL + vanilla ES-module architecture and working payment safety.

## Business decisions already authorized

- Production domain: `https://mikyajkw.com`. The rebuilt version has not been deployed there.
- Arabic source product data is authoritative. English translations must preserve meaning; machine output is editable and must not overwrite reviewed corrections.
- Primarily mobile shoppers in Kuwait; prioritize makeup, then skincare/personal care.
- Currency KWD with three decimals. All checkout calculations are server-side; integer fils are used for calculations.
- COD enabled. MyFatoorah adapter exists; production gateway credentials/provider confirmation are still missing. Do not pretend another provider works merely because its name can be selected.
- Nearby delivery 1 KWD, other configured zones 2 or 3 KWD; maximum 3 KWD. Free delivery from exactly 10 KWD, within supported delivery areas. Current eligibility uses merchandise subtotal before checkout discounts. This assumption is documented and should be kept consistent in the UI.
- Shop 10, Souk Al-Mubarakiyah, Gharabally Souq St, Kuwait City, postal 525479.
- Support WhatsApp `+965 6623 2231` / `96566232231`.
- No driver app/module needed. Existing driver tables are historical and are not a reason to build a driver workflow.
- Real Mikyaj favicon/logo is already in the source. Shopify screenshots are workflow references only.
- Instagram confirmed: `https://www.instagram.com/mikyajkw/`. Do not fabricate other social accounts or backlink guarantees.
- Weekly bilingual beauty-journal automation exists; publishing is blocked until rebuilt production and authenticated CMS access are verified. A draft is in `docs/weekly-content/2026-10-05-makeup-brush-cleaning-routine.md`.
- User clarified that “run live” meant **reopen local preview**, not deploy the public domain.

## How to run and review

```powershell
npm run build
npm test
npm run test:admin
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
npm run test:admin:browser
npm run test:catalog
npm run test:review
npm run preview:catalog
```

Preview URLs:

- Store: `http://127.0.0.1:3101/en/`
- Arabic: `http://127.0.0.1:3101/ar/`
- Admin: `http://127.0.0.1:3101/admin/login.html`
- Products: `http://127.0.0.1:3101/admin/manage.html?view=products`
- Mobile frame: `http://127.0.0.1:3101/__preview/mobile`
- Admin storefront: `http://127.0.0.1:3101/shop.html?lang=en&admin=1`

**Local test account only:** `admin@example.test` / `TestPassword123!`. Never use it in production. Preview binds to loopback, uses PGlite and does not load `.env`.

The new `--persistent` preview stores data in ignored `.local-test-data/admin-preview-db`. Do not delete it: it contains the user's review edits. It loads the 5,222-product catalog once and applies new schema files on later starts, preserving local orders/settings/edits. The earlier in-memory preview only preserved product availability in `.local-test-data/preview-product-state.json`; this file is still applied when initializing a fresh catalog. One previously deleted product is preserved as deleted. Local uploads live in `.local-test-data/media`.

Check the actual running process and command line before stopping a preview. Do not launch duplicate processes on port 3101. Restart after backend changes. Never kill unrelated Node or Python processes. A process may be running from Codex's terminal session; use `Get-NetTCPConnection` to identify its PID. A background launch was blocked once by automatic approval review; a normal foreground terminal launch worked. There is no need to change security settings or bypass restrictions.

## Implemented in this upgrade

### Admin experience

- Responsive dark sidebar, mobile drawer, desktop collapse, remembered light/dark mode, Ctrl/Cmd K global search, notification badge/read state, store links and profile/logout.
- New modules in `frontend/mikyaj-demo/js/admin/`: catalog, core, operations, settings, discounts, returns, orders, content, custom-fields. Entry is `js/admin-store.js`, styles `css/admin.css`.
- Existing order/payment/refund/journal/settings functions are retained in `js/admin-legacy.js`; not every legacy function has yet been extracted or restyled.
- Build bundles the new admin module graph into `dist/js/admin-store.js`. New public modules must also be added to the explicit deployment asset allowlist in `scripts/build-storefront.cjs`.

### Products, categories, brands and media

- Product table with images, status, tracked/untracked quantity, category/brand/price/date; name/SKU/category/brand search; filters; sorts; saved personal views; 40-row pagination/count; selected-page export and bulk actions.
- Active, unlisted, archived, low-stock and out-of-stock views. Separate soft deletion keeps order history. Existing admin storefront five-button workflow remains.
- Minimal editor requires a name in either language, price, and 1–8 images; category defaults to Uncategorized. Optional disclosures contain content, inventory, organization, custom fields. SEO inputs were removed from this editor.
- Inline category/brand creation auto-selects the created item. Taxonomies support images, labels, status and priority. Images are wired to home tiles, brand directory and product-brand header.
- Central media service validates decoded raster format, size and pixel count, rotates/resizes to 1600, converts to WebP. Product photos receive a low-opacity real Mikyaj logo. Return evidence uses a separate private path without a watermark. Original uploads are not retained; this is an intentional limitation.
- Tracked available stock is reserved transactionally at checkout and restored once on cancellation. Per-order-item reservation quantities avoid restocking an order that was originally untracked. Pending online payment still reserves stock; an abandoned-payment reconciliation/release job remains to be designed safely.
- Product custom field definitions (text/number/boolean) and optional public display are implemented. Public catalog/bag responses strip private field values.

### Customers, staff and checkout

- Account login recognizes staff credentials and routes to admin. Customer accounts remain distinct from anonymous events. Both legacy admin sign-in and storefront sign-in work.
- SUPER_ADMIN / ADMIN / STAFF roles; server checks database role/status/session version on every request. Customer-purpose JWTs are explicitly rejected by admin auth, even if signing-key fallback is shared.
- Owner-only staff creation/edit/disable/permission assignment; prevents removing one's own owner access and protects the last owner. Changing staff access revokes previous sessions. Staff refund/cash access is not granted by normal order permission.
- Customer profile includes addresses, orders, returns and enable/disable state. List supports 40-row pagination, name/email/phone search and status filtering. Customer profile order history still caps at 100.
- Saved address edit/delete/default; default selected at checkout; optional save during checkout. Search filters the maintained delivery-area list. There is no geocoder or complete Kuwait street/block database.
- Configurable floating WhatsApp with mobile offsets and collision hiding around important purchase controls. Brand and More actions are in mobile bottom navigation.

### Latest integration fixes

- Customer list pagination/search/status and validated page parameters.
- Guest checkout gate before displaying the form; disabled notes hidden and stripped server-side.
- Checkout/admin/customer order totals show merchandise discounts, net delivery and tax without subtracting shipping twice.
- Automatic discounts compare eligible combinations after removing conflicting classes, so a larger valid single saving wins.
- Global search includes discounts with direct editor links.

### Discounts and returns

- Separate checkout discount engine: product percent/fixed, order percent/fixed, BXGY, free shipping; automatic or code; dates; cap; once-per-customer; combination flag; eligibility and reservations checked server-side under locks.
- Product/category/brand targets and interactive product search. New type-selection modal; edit/duplicate/enable/disable/delete/export. Existing catalog-price offers are still managed through “Catalog price offers.”
- At most one selected discount per class (product/BXGY, order, shipping). Product discounts skip products already carrying legacy catalog offers. Combination controls are intentionally simpler than per-class matrices and need UI explanation/polish.
- Idempotent checkout does not double-redeem. Cancellation releases redemptions. Refund/return redemption policy is not extended beyond cancellation.
- Item/quantity return selection, reason codes, description, up to three 1 MB photos, private evidence endpoints, ticket and history, admin review/status steps. Partial returns do not mark the whole order returned; duplicate returned quantities are rejected.
- WhatsApp handoff records that the link was opened, not that a message was sent; photos remain securely stored and are not auto-attached to WhatsApp.

### Content, analytics and settings

- Homepage hero text/image/button and section toggles; desktop/mobile-menu navigation editor; existing journal editor retained.
- Real order-value reports with date filters, daily chart, top products, device sessions and event counts. Labels clarify that confirmed COD order value is not settled revenue. Does not invent conversion/visitor metrics.
- Opt-in event collection for page/product/search/cart/checkout activity, random session IDs, no IP/search-text/address storage. DNT/GPC honored. Signed-in event rows can contain customer_id. Tracking defaults off. A retention/deletion policy/job is still needed before production enablement.
- Separate settings for general/contact, staff, payments, checkout, registration, delivery, location, social, events, tax, custom fields; useful read-only domain/channel/notification information. Not every field listed in the brief is implemented.
- Optional tax settings default off; tax added after discounts, with optional shipping taxation. Rate must be supplied by the business/accountant; there is no assertion about applicable Kuwait tax law.

## Translation service and catalog state

`scripts/translation-server.py` provides a local `/translate` endpoint using free OPUS models and CTranslate2. Models have been downloaded/converted in the ignored `.translation-models` directory. `.translation-venv` exists. The Python process was started on localhost 8765; confirm it is still running.

```powershell
.translation-venv/Scripts/python.exe scripts/translation-server.py --prepare
.translation-venv/Scripts/python.exe scripts/translation-server.py
```

The persistent preview detects this service at startup and configures `TRANSLATION_URL` automatically. Production needs a private supervised worker or LibreTranslate, with `TRANSLATION_URL` and optional `TRANSLATION_API_KEY`. See `docs/TRANSLATION-SERVICE.md` for licenses, attribution and limitations. The Arabic→English model is CC BY 4.0; English→Arabic is Apache 2.0. Content fields with explicit `_ar`/`_en` pairs translate empty targets on blur when the service is configured. Manual corrections/non-empty targets are preserved. Coverage across all legacy forms, brand names and discount title fields is incomplete; review it before claiming universal automatic translation.

The original 5,222 Arabic product names have draft English translations. Full Arabic descriptions and brand associations were scraped locally from Attar, not imported into production. Existing files:

- `.local-test-data/catalog-snapshot.json`: source catalog snapshot.
- `.local-test-data/attar-enrichment/enrichment.json`: matched descriptions/brands; 5,222 source matches, 49 brand definitions, 728 assigned products. Some claim/store-reference content is flagged for review.
- `translation-output/english-opus-review.json`: draft translation output.
- `scripts/scrape-catalog-details.cjs`: robots-aware, paced, cached scraper.
- `scripts/import-catalog-details.cjs`: default dry-run; requires approved records; fills missing descriptions/brands without overwriting prices or availability.
- `scripts/translate-opus.py`: offline Arabic→English export/review workflow.

Do not blindly translate and publish health/product claims. No claim that all full descriptions are already professionally translated or reviewed.

## Migrations and APIs

New migrations, in order:

1. `015-admin-catalog.sql`: taxonomy images, inventory, saved views, media metadata.
2. `016-admin-operations.sql`: staff permissions/session versions, default addresses, event records, notification reads, order reservation flag. It promotes the earliest existing ADMIN to initial SUPER_ADMIN if none exists: **verify the intended owner on staging before production**.
3. `017-discounts.sql`: discount definitions, redemption reservations, order discount details.
4. `018-return-evidence.sql`: item-level returns, private evidence bytes and history.
5. `019-inventory-reservations-and-tax.sql`: per-item reservations, tax snapshots, product custom fields.

Main new `/api/manage` routes: `/products/bulk`, `/product-views`, `/images`, `/translate`, `/search`, `/users`, `/analytics`, `/notifications`, `/discounts`, `/content/home`, `/content/navigation`, `/product-fields`, `/settings/sections`, `/settings/product-fields`, return detail/evidence routes. Existing `/products`, `/categories`, `/brands` mutations are handled by `catalog-admin.js` before legacy routes.

Public changes: `/api/events`, richer quote/checkout discounts and tax, saved-address updates, private return routes. Review code for exact request schemas; tests provide valid examples.

Existing server secrets remain server-side. New model service variables are optional. Cloudinary credentials are needed for production uploads; local previews use disk. Existing deployment requirements include DATABASE_URL, ADMIN_JWT_SECRET, CUSTOMER_JWT_SECRET, ORDER_TRACKING_SECRET, SETTINGS_ENCRYPTION_KEY (64 hex chars), FRONTEND_URL, and provider/email credentials where enabled. **Never print `.env` or tokens.**

## Validation completed

- `npm run build` passes.
- Latest continuation also passed catalog scraping/import tests (2), the catalog-review browser regression, and the existing shopping browser suite. The review regression was updated to use the new admin table/bulk-publish workflow while retaining storefront five-button and stock-banner checks.
- Persistent full-catalog preview verified: 5,221 non-deleted products; mobile document width 390 px at a 390 px viewport. Original loaded catalog has 5,222 products, including one locally deleted record.
- Original nine API commerce regression tests pass.
- Eleven new API tests pass: minimal product/media/bulk/views; RBAC/revocation/token purpose; stock/idempotency/cancellation; discount fils/caps/free-delivery; private evidence/history; address ownership/default; content escaping/private custom fields/tax/events; partial returns; customer pagination; checkout settings/saved tax+discount snapshots; valid automatic discount combinations.
- Full existing browser shopping flow passed: Arabic/English, mobile bag/COD order/account/address/tracking/admin actions and management pages.
- New admin browser suite passed at 1440, 820 and 390 px: table filtering/bulk unlist, minimal product upload, inline brand, discount modal/save, theme persistence and global search.
- Screenshots are ignored under `docs/rebuild-validation/`, including `admin-upgrade/`. They use a four-product fixture; the persistent review preview has the full catalog.
- The local translation worker returned an Arabic translation for “Rose lipstick”; machine terminology still needs review. Broader translation quality and long-description latency are not certified.

Rerun relevant checks after subsequent changes. Tests use isolated PGlite; real PostgreSQL concurrency, real gateway sandbox and live hosting performance still require staging checks. Never use `npm run db:migrate` casually: that script loads `.env` and may point to production.

## Remaining work — prioritize in these phases

### Phase A: finish integration and audit the new code

Read the 87-row checklist. Run all tests above on the latest commit, then inspect actual full-catalog desktop/mobile screenshots. Verify freshly restarted preview uses the new backend and worker. Check image dimensions/watermark placement, drawer keyboard/focus behavior, search cancellation, error feedback and form unsaved-state handling. Ensure storefront custom fields never expose private data through any endpoint. Add tests for configured taxes in final saved order totals and discounts/returns on real PostgreSQL.

Specific gaps: admin mobile tables scroll horizontally (acceptable but can be improved with cards); not every form has sticky save/discard; sorting/filter indicators need polish; order-summary print is not a formal invoice; return details show product IDs rather than full item thumbnails; some legacy forms remain minified and should be extracted. Do not remove working cash/refund reconciliation while refactoring.

### Phase B: complete translation and catalog review

Make paired-field translation reusable across every supported content form, including legacy journal and discount titles. Keep field-level provenance/review state and prevent stale response overwrites. Batch translate missing descriptions locally with resumable caches; review terminology/ingredients/claims, preserve Arabic, and do not overwrite manual edits. Complete taxonomy image assignment from owned/authorized assets. Review scraped store references and claim flags before production import. Preserve availability and product IDs. Add safe rich links to journal rendering (currently basic headings/plain paragraphs) before publishing the weekly draft containing links.

### Phase C: customers and authentication

Paginate customer profile histories and show guest purchaser records distinctly from account holders and anonymous sessions. Design a proper shared identity strategy for promoting an existing customer to staff: current staff and customer credentials remain in separate tables, so promotion and password reset synchronization are not fully unified. Add invitation email only when a configured provider exists. Maintain role checks on every endpoint, not only navigation visibility. Review token storage/XSS hardening and add a tested CSP.

Google OAuth is **not implemented or connected**. Follow `docs/GOOGLE_SIGN_IN_SETUP.md`; obtain the owner's Google Cloud web client configuration, configure verified domains/home/privacy/support, verify Google ID tokens server-side, and link accounts safely. Do not bypass consent/verification or invent client credentials. Basic sign-in scopes and sensitive-scope verification are different concerns.

### Phase D: discounts, inventory and fulfillment hardening

Add discount list filters/date columns/pagination; improve target selection labels and per-class combination controls. Test overlapping X/Y eligibility, legacy catalog offers, rounding, 100% discounts, expiry and concurrent last-use redemptions. Decide and document order-discount allocation to line items for partial refunds/reporting. Handle zero-total online orders explicitly. Design safe release of abandoned pending-payment stock/redemption reservations using verified payment state and idempotent reconciliation, never simply time out an uncertain remote payment. Add editable return evidence follow-up/customer ticket details if needed. Preserve private evidence and ownership checks.

### Phase E: content/settings/analytics completeness

Finish homepage merchandising beyond the hero/toggles (promotional banners and flexible section ordering). Wire general store name/location changes through all hardcoded footer/contact/structured data and support messages. Some general/location fields are currently saved but not consumed everywhere. Implement complete account/checkout options only when backend behavior actually honors them; Guest checkout and delivery-note settings are now enforced in both UI and API; registration controls still need complete UI integration. Remove or clearly disable any nonfunctional setting.

Add analytics retention/deletion controls, bot/duplicate filtering, attributable purchase events and honest conversion definitions. Current sales are order value, not net settled revenue, and reports do not represent unique people. Add automated notification delivery only after email/SMS service configuration; current in-app notices work. Improve domain status with real read-only verification if desired, never label it connected just because a domain string is present. Current tax is a simple additive model, not a jurisdiction engine.

### Phase F: staging and production

Back up production. Identify hosting and deployment access; user previously authorized local preview only. An earlier automatic review blocked pushing to GitHub because external publishing had not been authorized. Do not retry a Git push or deploy without explicit owner authorization for that destination.

Use a staging database, review/apply migrations 008–019 according to its migration ledger, verify initial owner identity, configure independent strong secrets, encrypted gateway storage and private image/translation/email services. Smoke test customer ownership, disabled staff, COD, verified MyFatoorah callbacks/refunds, area fees/free threshold and returns. Run real mobile performance/Lighthouse checks, verify Brotli/gzip on the actual host/CDN, search indexing/canonicals/sitemap/image alt text and domain ownership. Only then request approval for a concrete production release. Do not import the test fixture, local credentials, ignored databases, cached models or raw scraped archives into the production site bundle.

After rebuilt production and CMS access are confirmed, review and publish the bilingual weekly journal draft. Keep the existing weekly automation; do not create a duplicate.

## Copy-paste prompt for the next coding agent

> Continue the existing Mikyaj Kuwait project in `C:/Users/lenovo/Downloads/mikyaj_stitch_full_frontend`. Read `docs/ANTIGRAVITY-HANDOFF.md`, `docs/ADMIN-UPGRADE-PLAN.md`, and the user's full brief at `C:/Users/lenovo/Downloads/ecommerce_shopify_admin_complete_prompt.md`. Inspect `git status` and recent commits before editing. Preserve the current architecture, data, payment verification, unrelated user changes and local persistent preview. Do not restart from scratch or claim the whole brief is finished. Work through remaining phases A–F in order, prioritizing integration/security and tested end-to-end functionality. Use isolated tests and staging, never the production `.env` database for experimentation. Keep manual Arabic/English corrections intact; no invented claims, metrics, social accounts or provider integrations. Preserve 1/2/3 KWD delivery, free from 10 KWD, COD and the existing WhatsApp number. Keep a live requirement checklist, validate desktop/tablet/mobile, and document any external prerequisite. A working local preview and a precise, honest handoff are required at each checkpoint. Production publishing requires explicit authorization for the exact destination. Use the selected model's high-reasoning setting if available; the work instructions are model-independent.

## Files to preserve and not accidentally commit

- `test.js` already had unrelated user edits; leave it alone.
- `backend/app.js` had user formatting changes before this upgrade; functional additions were made on top, not reverted.
- `full_prompt.txt`, `prompt_utf8.txt` were pre-existing untracked files.
- `docs/weekly-content/` contains the automation draft; preserve it.
- `.env`, `.local-test-data/`, `.translation-venv/`, `.translation-models/`, `translation-output/`, raw image archives and `dist/` are local/generated/secret data. Respect `.gitignore` and the build allowlist.
- Windows reports a pre-existing invalid trailing-dot asset directory (`assets/products/810400031159.`). Do not recursively delete unrelated asset trees to silence that warning.

## 5 October update — catalog images, descriptions and layout

Completed and verified locally:

- Direct **View storefront as admin** link in the left admin sidebar, with authenticated product controls.
- Arabic/English switches preserve the same layout positions. Arabic text retains natural reading direction without mirroring navigation and columns.
- Immediate selected-file previews for category, brand and product uploads; save is disabled during processing. Saved images can be enlarged. Failed uploads restore the previous image.
- All 21 categories have optimized 640px WebP artwork showing representative product groups with Mikyaj branding. These are generated category illustrations, not photographs of specific inventory. Built-in ImageGen was used; exact prompts and sources are in `docs/taxonomy-artwork.json`.
- All 49 brands have images: verified logos, catalog/official brand product photos, or five neutral brand-name graphics where a logo could not be verified (Avène, Fair and Lovely, Finca, Nova Royal, Nutraway). Two mismatched catalog photos were caught during visual QA and not used. Brand assignments in the underlying imported catalog still merit editorial review.
- Artwork is stored under `frontend/mikyaj-demo/assets/images/taxonomy/`. `scripts/prepare-taxonomy-artwork.cjs --preview` assigns it through the local authenticated API; it preserves pre-existing custom images. It never updates production.
- Fixed `/api/manage/translations/run`: MACHINE products with missing descriptions are eligible; existing English fields, reviewed copy and concurrent edits are protected. The admin now distinguishes incomplete fields from overall MACHINE status.
- Full offline description translation is resumable. Input `.local-test-data/current-description-source.json`; output `translation-output/descriptions-machine.jsonl`; source-text cache alongside it. `scripts/import-description-translations.cjs --preview --watch` imports batches with source hashes and a durable import ledger. The process stops after all 5,221 exported records are processed. Do not mistake MACHINE status for editorial approval.

Validation: 22 commerce/admin/translation API tests passed; `node tests/catalog-media-browser.cjs` passed sidebar routing, five controls, immediate and saved media previews, English/Arabic copy and fixed columns at 390/1440px. All 70 taxonomy image URLs returned HTTP 200. Screenshots are in `docs/rebuild-validation/catalog-media/`. Latest build passed.

To resume a stopped batch (never start two writers for the same output):

```powershell
.translation-venv/Scripts/python.exe scripts/translate-missing-descriptions.py .local-test-data/current-description-source.json translation-output/descriptions-machine.jsonl
node scripts/import-description-translations.cjs --preview --watch
```

The latest batch was restarted as a hidden local process so a chat interruption does not discard progress. Logs: `.local-test-data/description-batch.log` and `description-batch-errors.log`. Check process state and output counts before restarting. Machine translations still require review for brand spelling, shades, ingredients and product claims before production. Some source descriptions contain supplier claims; translating them does not verify those claims. No production deployment or production data import was performed.

Checkpoint: 3,827 of 5,221 exported translation records imported into the preview at the latest check; the batch and importer were still running. This is not full-catalog completion. Inspect current counts before reporting completion. Hidden preview logs are `.local-test-data/preview.log` / `preview-errors.log`; the preview remains on port 3101. The translation importer may need to be restarted with the documented command after a session interruption.

## 6 October release work (supersedes the earlier local-only restriction)

The owner now explicitly authorized GitHub push and making the live site match the approved local preview. New request: add How to use to every product, remove Skinlite by brand/name/packaging text, refresh site caches/performance, and add Refresh on every admin management page.

- Directions extraction + editable `how_to_use_ar/en`; migration 020; packaging/help fallback when no source instructions exist. Added common English “Method of use” heading handling as well as Arabic headings. Source descriptions remain stored unchanged.
- Shared admin Refresh button; built-site tests verify it.
- Full offline translation completed: 5,221/5,221 imported locally. Public production catalog transfer was authorized, dry-run tested and **committed** using `scripts/apply-reviewed-catalog.cjs` and ignored `.local-test-data/catalog-release.json`. Updated 5,221 descriptions/translations, 21 category images, 49 brand records/images, 728 previously missing product-brand links. Removed 10 visually confirmed Skinlite products with soft deletion. No test users/orders/settings/prices or unrelated preview stock/deletion test states were transferred.
- Production migration 020 was applied. Recovery rows are in `catalog_release_backups`, release ID `mikyaj-2026-10-05-reviewed-preview`; local pre-release public backup also exists. Production has 5,222 product rows, 5,212 nondeleted after 10 removals. Local preview has one additional historical test deletion; preserve it locally without copying that deletion to production.
- Full image-text scan is still completing: 8,092 catalog image records, resumed through `scripts/scan-skinlite-images.py`; results `.local-test-data/skinlite-ocr.jsonl`. Review candidates visually before deleting: “skin lightening” and adjacent “skin”/“light” text create false positives. Confirmed removals in `docs/skinlite-removal-review.json`. Do not claim scan completion until all expected image keys have a successful result or a documented failure.
- Versioned assets, JS bundling/minification, both CSS files minified, page/sitemap revalidation, Brotli tests. Public grids no longer fetch full descriptions/private fields from PostgreSQL. Private APIs remain no-store. Build passed, 29 API/unit checks passed before a fourth extraction test was added; production-build browser suites passed.
- Changes are staged, **not committed or pushed yet** at this checkpoint. Leave unrelated `test.js`, `full_prompt.txt`, `prompt_utf8.txt`, and weekly draft unstaged. Latest edits must be re-staged before commit.
- Remaining: finish/review OCR; remove any further verified Skinlite products locally and in production via a guarded incremental removal manifest; update review/report; commit/push normally (no force) to origin main and work branch as appropriate; verify Netlify+Render deploy, health release ID, image URLs, removed-product 404, English content, both languages, mobile, and admin Refresh. If hosts do not auto-deploy, obtain their authenticated deployment access; a Git push is not proof of hosting success.
- Remote `origin/main` last seen at `385370b`; local branch `codex/mikyaj-ecommerce-rebuild` includes earlier unpushed commits `8f196a7`, `cfe551f`. Git SSH and public repo API work. Repo is public. Secret/path scan of staged files passed.
- Credits check: weekly used 32% (68% remaining) on the latest tool check, so the user's last-5% handoff threshold has not been reached.

## Deployment update — 6 October 2026

Release commit cd68c8e is pushed to origin/main and origin/codex/mikyaj-ecommerce-rebuild. Netlify /en/ already serves asset identifier 3128c76240ae3ced. Render health was still old immediately after push; run node scripts/verify-live-release.cjs --origin=https://mikyajkw.com after deployment completes. Production schema/catalog changes are already committed; do not replay from stale preview data. All 30 tests pass with normal Node test isolation; never combine these DB fixtures with --test-isolation=none. Local preview restarted on port 3101. OCR finished the 8,092-image inventory; retry run is resolving four failed downloads. Confirmed removals remain ten. Complete OCR coverage report and live verification before calling the deployment complete. Unrelated test.js, full_prompt.txt, prompt_utf8.txt and docs/weekly-content remain uncommitted.
