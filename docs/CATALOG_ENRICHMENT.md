# Catalog descriptions and brands

The original catalog CSV contains 5,244 rows but only 69 description records and zero brands. The current 5,222-product database snapshot has 88 descriptions and zero brands. The original import cannot recover data absent from the source export.

Run the new public-data fetcher:

```powershell
node scripts/export-preview-catalog.cjs
node scripts/scrape-catalog-details.cjs
```

It checks robots.txt, uses the public WooCommerce catalog endpoint, makes sequential requests with at least a 1.2-second gap, respects server rate-limit responses, retries transient failures and stops on denied access. Completed pages are cached for resume. The fetcher never loads customer data or changes stock/prices. Delete its own cache directory deliberately when a fresh source snapshot is needed; a resumed run reuses cached source pages.

Outputs are in `.local-test-data/attar-enrichment/` (git-ignored): raw page caches, brand directory, enrichment.json and report.json. Product matching prefers exact normalized source URL, with a unique source SKU as a fallback. No name-based guesses. Descriptions are converted to plain text, preserving line breaks and excluding scripts/forms. Source URLs, product identifiers, matching method and review flags are retained.

The 2026-10-04 completed run fetched 5,345 source products and matched all 5,222 existing products by source URL. All matched products have descriptions; 728 have explicit brand assignments. The combined directory contains 49 brands, 39 represented in the existing product catalog. Products without a source brand stay unassigned and can be assigned by an admin. Additional source products are not imported automatically.

The local preview loads this enrichment into its isolated database. Existing Arabic copy is preserved where present; fetched copy fills missing fields. English descriptions still require translation/review. Some source text contains merchandising or treatment claims, so the generated flags help review but do not certify factual accuracy or reuse rights. New product copy should be checked against packaging/manufacturer information before publication.

For the real database, mark the exact reviewed product records with `"approved": true` in a copy of enrichment.json, then:

```powershell
node scripts/import-catalog-details.cjs path/to/reviewed-enrichment.json
node scripts/import-catalog-details.cjs path/to/reviewed-enrichment.json --apply
```

The first command rolls back. The second fills missing Arabic fields and brand links only for approved records whose exact database ID and source URL still match. It preserves existing descriptions and all prices/stock. Changed Arabic text is marked pending translation. Apply migration 014 before importing. Never publish a local preview database as the production database.

Re-run the translation export/tool after the approved Arabic import; the old translation file's source hashes intentionally do not match the new descriptions. Review machine translations before marking them reviewed.
