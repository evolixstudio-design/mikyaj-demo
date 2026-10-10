# Mikyaj welcome banner

Created on 10 October 2026 with the built-in image generation tool, using the actual `mikyaj_logo.png.png` as the logo reference. The artwork uses illustrative cosmetics with physical contact shadows on a tabletop. It does not assert that the illustrated unbranded items are specific catalog products.

The homepage hero shows only the finished artwork, with “Welcome to Mikyaj Kuwait” inside it. Its hidden, localized heading and descriptive alt text support accessibility. The repeated default collage below the hero has been removed; the below-hero placement remains available for admin banners. Published custom heroes follow the same image-only presentation and continue to supply SEO metadata.

## Saved assets

- `frontend/mikyaj-demo/assets/images/hero-welcome-1600.webp`: full desktop artwork, 1600 × 703 px, 139,030 bytes.
- Responsive siblings at 480, 800 and 1200 px wide: 24,770, 53,092 and 96,282 bytes respectively.
- `output/banner-design/mikyaj-welcome-master.png`: original generated master, kept locally outside deployment.

All four WebP files are included in the production build and asset-version hashing. The image keeps its original aspect ratio on mobile so the logo and greeting are preserved. The hero loads eagerly with responsive image selection and reserved dimensions. No GitHub push or production deployment was made.

Validation: production build and eight banner/search-discovery checks passed. Browser inspection covered desktop, English and Arabic mobile pages, the built static homepage and both admin banner previews. Each hero had one image, no visible caption or separate button, and no horizontal overflow. A fresh 390 px phone session with a 2× display selected the 800 px image (53,092 bytes).

## Final generation prompt

+Use case: ads-marketing.
Asset type: finished homepage hero banner for Mikyaj Kuwait, an elegant makeup and skincare ecommerce store.
Primary request: create a polished, photorealistic beauty-store welcome banner, wide panoramic 16:7 composition (approximately 1600 by 700). The image itself is the entire hero; there will be no separate webpage copy or button.
Input image 1 is the actual Mikyaj KW Cosmetics logo on transparency. Use this existing logo faithfully in the finished artwork, preserving its floral cosmetics illustration, brown calligraphic Mikyaj lettering, and KW COSMETICS wording. Do not redesign or invent a replacement logo.
Scene: a warm ivory studio wall and an ivory stone tabletop that extends fully across the lower part of the frame. On the right, a tasteful group of realistic makeup and skincare essentials: a nude lipstick standing upright, a small eyeshadow palette resting open on the table, a glass foundation bottle, a serum bottle and two makeup brushes lying on the table. Subtle low stone display risers can support some items. Every physical product must visibly touch the tabletop or a solid pedestal, with convincing contact shadows, correct shared perspective and weight. No levitation, flying products, airborne cutout collage or floating circles.
Composition: logo prominently on the left, with a single short, beautifully typeset greeting underneath. Keep logo and greeting large enough to read when the entire banner scales to a 390px mobile screen. Products occupy the right half without crowding. Generous but balanced space, the scene must feel composed and finished, not empty. Keep all essential content away from outer edges.
Lighting: soft natural side light, realistic soft grounded shadows; premium editorial cosmetic product photography. Warm ivory, pale blush and the warm brown tones of the supplied logo. Sophisticated and minimal.
Exact greeting text: "Welcome to Mikyaj Kuwait". This is the only additional text besides the supplied logo. No extra slogans, promotions, discounts, badges, buttons, borders or UI elements. Avoid random product label text or invented product claims. Packaging may be elegant and unbranded.
Output: one opaque finished panoramic banner, crisp artwork and accurate greeting.
