# Banner and storefront content workflow

Implemented locally on 10 October 2026. No GitHub push or production deployment has been made. The local preview uses a separate database. Publishing here changes only the local preview; after the application is deployed, the same controls publish to the real storefront through its authenticated commerce API.

## Client workflow

1. Sign in to the admin panel and open **Banners** in the sidebar (also linked from Content).
2. Choose **Place banners on storefront** to see editable locations on the home page, or **Edit shop placements** for the catalog. The regular **View storefront as admin** sidebar link also exposes banner placement controls for accounts with content permission.
3. Click **Place banner here**, or use **Add banner** in the module and choose a placement.
4. Upload one JPEG, PNG or WebP, under 4 MB. The recommended hero artwork is **1600 × 700 pixels, a 16:7 aspect ratio**. Keep important lettering readable at mobile width. A source smaller than the recommended size can appear softer when enlarged.
5. Preview the uploaded image on desktop and mobile. **Show entire image** preserves artwork, logos and embedded text. **Fill frame** fills a wide desktop frame and a 4:3 mobile frame; adjust the horizontal/vertical focal point to control the crop. Both layouts use the same upload.
6. Add English and Arabic image alt text, an optional title, an SEO description, and a link to a product, category or another public store page. Paste a full `https://mikyajkw.com/...` URL or a relative store link. Link destinations automatically follow the shopper's current language.
7. **Save draft** keeps the existing published banner visible. **Publish banner** saves and publishes the edited design. New visits/page refreshes see it without a code change or rebuild.

The hero displays only the uploaded artwork. Its title supplies an accessible page heading, and its description updates the homepage meta description. Titles and descriptions in other slots appear beneath their banners. Product/category metadata continues to describe its own page. Image alt text is required in both languages before publication. Manage hero artwork in Banners; Content retains homepage section visibility and navigation controls.

## Placements

- Homepage hero (one published hero; publishing another replaces it and retains the previous design).
- Below the homepage hero, below categories, below featured products and above the homepage footer.
- Above products on shop and category pages.
- Below details on product pages.

Choose **Seasonal banner**, **Offer banner** or **Special product banner** to organize the design. Higher display priority appears first within a placement. Up to 25 designs are supported. **Unpublish** hides a design and retains it for editing; **Delete** removes it. Removing the hero restores the Mikyaj welcome artwork, featuring the existing logo and cosmetics grounded on a stone tabletop.

## Performance and publishing

Images are decoded and validated by the server, resized without changing their aspect ratio, and stored as WebP. Cloudinary provides automatic format/quality optimization and responsive 480/768/1200/1600px sizes from one upload. The hero loads eagerly; other banner images load lazily. Image dimensions reserve space to reduce layout jumps. Admin editor code loads only when needed; shoppers receive only the small rendering module.

The public config exposes published designs only. Admin content routes enforce login and content permissions, record audit entries and check a revision number so edits in another window cannot silently overwrite changes. No database migration is required; drafts and published versions use the existing store settings table.

Production image uploads require the existing Cloudinary configuration. Deploy the reviewed frontend and backend release together before using these publishing controls on mikyajkw.com. Static homepage shells load current banners through the storefront API; server-rendered homepage responses also include banner content and its SEO description. Google processing remains asynchronous.

## Review and validation

- Local admin module: `http://127.0.0.1:3101/admin/manage.html?view=banners`
- Local placement editor: `http://127.0.0.1:3101/en/?content_admin=1`
- Local mobile preview: `http://127.0.0.1:3101/__preview/mobile`
- Automated coverage: `node --test tests/banners.test.cjs tests/search-discovery.test.cjs tests/commerce.test.cjs tests/october-upgrade.test.cjs tests/admin-upgrade.test.cjs` (34 checks).
- Browser review exercised a real photo upload, both previews, publishing, localized hero markup/meta description, placement controls, mobile rendering and removal/restoration. The temporary test banner was removed from the isolated preview.
