# Local review release — 10 October 2026

Do not push or deploy this release until the owner requests it. Use the isolated persistent preview and leave production data unchanged.

1. Storefront: sticky branding/search, yellow phone links, glowing WhatsApp control with expandable number, clearer circular category photography, a seasonal campaign and a fuller bilingual footer for Burhan al dahabi gen trad co.
2. Delivery: searchable Kuwait area/block/postcode directory from the Ministry of Communications, remembered selection, authoritative fees (1–3 KWD, free at 10 KWD) and editable delivery estimates. Keep user-configured fees.
3. Catalog: editable shade variants, initially unpublished. Per-shade availability, quantity, image and SKU; same product price. Enable explicitly when ready.
4. Orders: sequential four-digit order references growing beyond 9999, preserving legacy references/private tracking; printable parcel labels and customer receipts; saved guest orders and account login on tracking.
5. Page visit: anonymous sessions, visited pages and foreground dwell time, date filters and page/session drilldown. Respect browser privacy preferences and exclude private/query data.
6. Search: Arabic/English brand names, local business/site schema, crawlable stable favicon, sitemap/internal links, three useful bilingual journal articles. Search Console/Business Profile changes require account access; rankings cannot be guaranteed.
7. Verify: isolated API tests, responsive browser flows, PDF/print layout and image quality; reopen local preview. Record remaining external prerequisites.

Confirmed Google Maps listing: https://maps.app.goo.gl/pDiAzhB5CHR2yi7CA with the owner’s supplied embed. Normal delivery estimate: 1–3 days, editable in admin. Shipping fees use editable 1/2/3 KWD area zones from the shop in Mubarakiyah; these are zone rates, not calculated road distances.

Local implementation and verification completed:

- 21 circular category assets now use real photographs. Seventeen use the current catalog; four use the matching PinoyHyper images requested by the owner. Sources and file sizes are recorded in `docs/real-category-artwork.json`. Artwork is 640px WebP, normally 24–50 KB each. Product packaging remains photographic.
- The Ministry directory contains 136 postal areas and 1,396 block/postcode records. The public selector removes the word “Office” from area labels, keeps source names as aliases and fills the matching governorate and postcode in address forms. Official data was checked on 10 October 2026.
- Migration 021 is applied only to the isolated persistent preview and test fixtures. Existing order references stay intact. New references start at 0001 and grow to 10000 after 9999. A private tracking token or customer account is still needed to read order details.
- Shade management appears below the product editor. All storefront shade switches remain off; no product colours or quantities were invented. Publish actual shade records and turn on the switch when ready. Stock reservations and cancellations operate per shade.
- Parcel labels and customer receipts are generated from saved order items and recorded payments. A normal one-item order was visually checked on one 100 × 150 mm label. Larger orders can continue onto more labels; an A4 receipt is also available. Browser Print / Save as PDF is the export mechanism.
- Page visit shows browser sessions, page journeys and approximate foreground duration. Preview tracking is enabled. DNT/GPC and private-path exclusions apply. Existing production analytics settings are preserved by the migration; enable tracking through the admin Events setting when the owner launches this update.
- Three new Arabic/English articles are published only in the local CMS: `choose-makeup-shades-kuwait`, `makeup-storage-kuwait`, `beauty-shopping-mubarakiyah-kuwait`. Their publication-ready source is `backend/data/journal-october-2026.json`. They preserve the original launch posts and link to real category/policy pages.
- Split production bundles share runtime modules, removing duplicate checkout/tracking initialization. Local category/brand images carry a build version, and that version includes the artwork bytes, so changed images refresh without deleting customer carts or tracking tokens.
- Build succeeded. All 26 API tests passed. Production-bundle browser checks passed for bilingual 360/390/1440px storefronts, bag, COD checkout, tracking, account/address forms, and admin product actions. Admin checks passed at 390/820/1440px. Print PDFs were rendered and visually inspected. Review evidence is under ignored `docs/rebuild-validation`, `output/playwright` and `output/pdf`.

Review now at http://127.0.0.1:3101/en/ or http://127.0.0.1:3101/__preview/mobile. The server uses the generated `dist` bundles with an isolated local database. Test admin: admin@example.test / TestPassword123! These credentials are preview fixtures and are not production credentials.

Future launch, only when requested:

1. Back up production data, review this diff and apply `database/migrations/021-shades-tracking-print.sql` through the production migration process. Do not use the test fixture or preview credentials against production.
2. Publish the matching backend and frontend build together so shade, directory, tracking and document endpoints match the UI. Verify COD, gateway configuration, 1–3 day estimates and area fees. Real payment-provider credentials remain external.
3. Import the three bilingual articles through the authenticated production CMS from the JSON source. The helper `scripts/load-october-journal.cjs` deliberately targets localhost only and must not be treated as a production importer.
4. Verify the production root/favicon/sitemap/schema and request root reindexing in Search Console. Google controls favicon refresh and rankings; changes here do not update search results until deployment and recrawling.
5. With owner access, set `https://mikyajkw.com/` as the website on the real Google Business Profile and Instagram profile. Use only actual additional social accounts. No external profile was edited and no artificial backlink network was created.

No commit, GitHub push or production deployment was performed for this release. Preserve the unrelated existing `test.js`, `cleanup-test-data.js`, prompt files and weekly-content drafts.

Read-only production check: the live home page, `/favicon-192.png` and `/robots.txt` returned HTTP 200. The favicon returns `image/png`, and robots allows the home page and favicon. The existing Google search globe is therefore not evidence that the icon file is missing; recrawling/processing remains controlled by Google. The new preview favours the stable 192px icon and adds fuller business identity metadata.
# Additional favicon, crawl and banner work

The local build now includes the real-logo ICO/PNG family, Apple icon, web manifest, shared robots.txt, a sitemap index and separate bilingual page/product/category/journal sitemaps. Browser icon links use new stable ICO/96px URLs to avoid the previously cached PNG icons. Search Console verification remains unset at the owner's request; setup instructions are in GOOGLE-SEARCH-CONSOLE.md.

The admin sidebar now includes Banners. Clients can upload one image, preview desktop/mobile layouts, add a link and bilingual alt/SEO descriptions, save a private draft and publish or unpublish it. The authenticated storefront exposes editable placement controls on the homepage, shop/categories and product pages. Recommended artwork is 1600 × 700 pixels (16:7), up to 4 MB. BANNER-CONTENT-WORKFLOW.md records the workflow and deployment prerequisites.

Validation: production build passed; 34 route/commerce/SEO/banner checks passed. Browser review verified actual upload/preview/publish, five home placement controls, desktop/mobile editor dialogs, no horizontal overflow at 1440px/390px, and restoration after removing the temporary banner. These changes are local; no GitHub push or deployment was performed.
