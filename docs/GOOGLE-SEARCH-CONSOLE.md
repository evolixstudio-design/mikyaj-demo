# Mikyaj Google Search Console and favicon setup

Prepared locally on 10 October 2026. No GitHub push, deployment or Google ownership verification has been performed. The owner will configure Search Console later.

## Files and endpoints

| Public URL | Purpose | Implementation |
| --- | --- | --- |
| `/favicon.ico` | Browser fallback; real Mikyaj artwork at 16, 32, 48, 64 and 256px | Generated from the owner's original logo on every build |
| `/favicon-32.png`, `/favicon-96.png`, `/favicon-192.png`, `/favicon-512.png` | Square icons for browser tabs, Google and saved shortcuts | Included in `dist`; stable URLs with cache revalidation |
| `/apple-touch-icon.png` | 180px iPhone/iPad shortcut icon | Included in `dist` |
| `/site.webmanifest` | Site identity and shortcut icons | Included in `dist`; no offline cache/service worker introduced |
| `/robots.txt` | Crawl rules and sitemap discovery | Shared source in `backend/services/search-discovery.js`; static file and Express route agree |
| `/sitemap.xml` | Sitemap index to submit to Search Console | Static file on Netlify; identical Express route |
| `/sitemap-pages.xml` | Arabic/English home, shop, brands, journal listing and information pages | Static file on Netlify; identical Express route |
| `/sitemap-products.xml` | Arabic/English canonical product pages | Live database query through Render, proxied by Netlify |
| `/sitemap-categories.xml` | Arabic/English active category pages | Live database query through Render, proxied by Netlify |
| `/sitemap-journal.xml` | Arabic/English published articles | Live database query through Render, proxied by Netlify |

The standard crawler filename is **robots.txt**, not robots.cml. Product and category sitemaps follow the public catalog visibility rules. Deleted/unlisted products and inactive categories are omitted; published out-of-stock products remain discoverable. Future and draft articles are omitted. XML includes language alternatives and actual database modification dates where available. Private checkout/account/order/admin URLs are not listed. Googlebot and Googlebot-Image can fetch the home pages, icons, styles and scripts.

The deployment allowlist copies only approved production assets and genuine Google verification HTML files. There is deliberately no invented `googleXXXX.html` ownership file or placeholder verification meta tag.

## Verify later

### Option A: Domain property, recommended

1. Open [Google Search Console](https://search.google.com/search-console/) with the shop's Google account.
2. Add a **Domain** property: `mikyajkw.com` (without https or a path).
3. Google supplies a unique DNS TXT value. Add that exact value at the domain's DNS provider. Keep it in place after verification.
4. Click Verify after the TXT record is available. Domain verification covers protocols and subdomains and does not require an HTML file.

### Option B: URL-prefix property and HTML verification

1. Add a **URL-prefix** property: `https://mikyajkw.com/`.
2. Choose HTML file upload, download the original `google….html` file and run:

   ```powershell
   npm run seo:verify -- --file "C:/path/to/the/file/googleYOURREALID.html"
   npm run build
   ```

   Replace the example path with Google's actual downloaded filename. This copies its exact filename/content into the public root and the production build. The command rejects renamed or modified verification content. After deployment, its root URL must return HTTP 200 without login.

3. Alternatively, choose HTML tag and copy only its `content` value:

   ```powershell
   npm run seo:verify -- --token "THE_REAL_CONTENT_VALUE_FROM_GOOGLE"
   npm run build
   ```

   This saves the public ownership token in `backend/data/search-console.json`. Both generated storefront HTML and server-rendered pages include the tag. `GOOGLE_SITE_VERIFICATION` is an optional environment override; if used, set the same value on Netlify at build time and Render at runtime/build time. The ownership token is public, not a secret API key.

4. Deploy the reviewed changes, check the file or meta tag on **the production domain**, then click Verify. Keep the file or tag after verification. Localhost does not verify ownership of mikyajkw.com.

## Submit the sitemap and refresh Google's favicon

After the frontend and backend releases are deployed together:

1. Confirm these production URLs return HTTP 200 with the right content type: `https://mikyajkw.com/robots.txt`, `https://mikyajkw.com/sitemap.xml`, all four child sitemaps, and `https://mikyajkw.com/favicon.ico` / `favicon-192.png`.
2. In Search Console → Sitemaps, submit **sitemap.xml** once. It discovers all four child sitemaps automatically; catalog edits do not need a static product export or another frontend build.
3. Inspect `https://mikyajkw.com/` in URL Inspection and request indexing. Inspect `/ar/` and `/en/` as well. Check Page indexing and sitemap errors after Google processes the submission.
4. For a browser tab showing an old icon, reload the site; test a fresh browser session if necessary. Stable icon URLs now revalidate with the server. Google's search-results favicon is stored separately and cannot be cleared by a website cache purge.

Google requires a square, crawlable, brand-representative favicon at a stable URL; the larger sizes supplied here exceed its current recommendation. Google says recrawling can take several days to several weeks, and favicon display is not guaranteed. A sitemap helps discovery but does not guarantee ranking or indexing.

The page and index sitemaps are served statically for fast discovery. The three catalog sitemaps depend on the commerce backend/database being available. Each sitemap enforces the protocol's 50,000 URL limit; the current approximately 5,000-product bilingual catalog fits comfortably. If the catalog grows beyond 25,000 products, split the product sitemap into additional shards before publishing.

## Validation

```powershell
npm run build
npm run test:seo
```

The tests cover bot access, XML namespaces, canonical URLs, language alternatives, public catalog visibility, draft/future articles, icon sizes/ICO structure, cache revalidation, storefront/admin icon links and safe verification handling. Local preview: `http://127.0.0.1:3101/`.

Official references: [Google favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search), [Sitemap setup](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080).
