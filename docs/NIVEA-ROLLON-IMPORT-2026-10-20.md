# NIVEA roll-on import and A+ images — 20 October 2026

Status: **10 unique listings live**, eight created and two existing products updated. The supplied 11 photographs contain a duplicate Cool Kick Extra Dry view. User explicitly approved ten unique listings, the exact final price **0.999 KWD per one 50 ml bottle**, and priority **150**.

## Catalogue and merchandising

- Existing NIVEA brand reused. Personal Care remains the primary category; Body Care and Special Offers are additional categories.
- All ten have bilingual names, descriptions, how to use, benefits, product details, care and safety, SEO title/description, and image alt text.
- Ingredient Information directs customers to the physical pack. Complete exact-market INCI lists were not supplied, so none were fabricated.
- No extra markup, fake old prices, percentage discounts, new SKU system, inventory quantities or shade variants were introduced. Existing legacy SKUs and private source costs were retained.
- Pearl & Beauty #4131 and Fresh Natural #1670 were updated with their existing URLs retained. Cool Kick #1653 and Black & White Original #1647 are different packaging/variants and were left intact.
- The other 5,561 product records and their images are unchanged by the image update.

## A+ image correction requested after import

Initial images were the supplied shop photographs. At the user's request, all ten live galleries now use **one clean single-bottle image on white**. Shop shelves, books, other bottles and connecting wrap were removed. The original photographs and original import checkpoint remain privately available for recovery; they are no longer shown as low-quality gallery images.

Edits used the built-in image_gen tool. These are AI-assisted presentation edits derived from the supplied photos, not manufacturer-certified packshots. Main brand/variant/cap/colour were visually checked. Tiny source label text was already unclear; the edited photo is not an ingredient or efficacy reference. The first Cool Kick edit added unverified small claims, so a second edit removed those claims before publication. No corresponding benefit claims were added to listing copy.

Final images: **1254 × 1254 px**, optimized WebP quality 95, **72–124 KB each**, 912,196 bytes for all ten. Individually uploaded to versioned Cloudinary product URLs. Neither ZIP nor contact sheet was uploaded. Source ZIP is ignored by Git.

Workspace assets: output/nivea-a-plus-2026-10-20/ contains the ten PNG masters, ten WebP files and prompts.json. The complete prompt set and the corrective Cool Kick prompt are saved there. Common prompt: extract the selected real bottle, remove background/duplicates, center one bottle on white with a subtle grounding shadow, preserve its identity and label, add no promotional text or invented claims.

The old multi-bottle caveat was removed from descriptions because each live main image now shows one bottle. Price-per-one-bottle information remains explicit.

## Verification

- Production DB, product API, all 20 EN/AR server-rendered product URLs, Cloudinary hashes and metadata passed.
- Actual browser: all ten product cards, prices, images, detail content, Arabic direction, mobile overflow and cart additions passed; no page errors.
- Server quote ignored a tampered browser price and returned **9.990 KWD** for one of each of the ten products, before delivery.
- Photo publishing rerun returned already_completed and did not create another product/image import.
- No checkout order or payment was created during QA.

Live collection: https://mikyajkw.com/shop.html?lang=en&category=special-offers&brand=nivea

## Deployment distinction

Product data/images are live without a Git deployment. The local Offers filter enhancement includes fixed-price Special Offers memberships as well as actual percentage offers; production needs the pending code deployment for the general Offers navigation to use that new filter. The Special Offers category already contains all ten.

The user subsequently authorized a GitHub push on 20 October 2026 for the completed updates. The changeset includes the Page Visits dashboard, Commercial Registration Number field, Offers filter, tests and migration 024. Application deployment and migration completion must be verified separately. Existing unrelated test.js edits and private source packs are excluded.

| ID | Product | Final KWD | Priority | Live English page |
|---|---|---:|---:|---|
| 5564 | NIVEA Fresh Orange Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-fresh-orange-roll-on-50ml) |
| 5565 | NIVEA Men Cool Kick Extra Dry Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-cool-kick-extra-dry-roll-on-50ml) |
| 5566 | NIVEA Men Silver Protect Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-silver-protect-roll-on-50ml) |
| 5567 | NIVEA Men Black & White Invisible Fresh Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-black-white-invisible-fresh-roll-on-50ml) |
| 5568 | NIVEA Men Cool Powder Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-cool-powder-roll-on-50ml) |
| 5569 | NIVEA Men Energy Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-energy-roll-on-50ml) |
| 5570 | NIVEA Powder Touch Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-powder-touch-roll-on-50ml) |
| 5571 | NIVEA Natural Radiance Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/nivea-natural-radiance-roll-on-50ml) |
| 4131 | NIVEA Pearl & Beauty Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/mzyl-rq-rwl-wn-nyfy-byrl-and-bywty-llns-50-ml-db6471) |
| 1670 | NIVEA Fresh Natural Deodorant Roll-On - 50ml | 0.999 | 150 | [View](https://mikyajkw.com/en/products/mzyl-rq-nyfy-frysh-ntshwrl-rwl-wn-50-ml-75ac9e) |
