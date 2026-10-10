// Shared by Express and the static build so both hosts expose the same crawl files.
const origin = 'https://mikyajkw.com';
const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const sitemapFiles = ['sitemap-pages.xml', 'sitemap-products.xml', 'sitemap-categories.xml', 'sitemap-journal.xml'];
const publicPages = ['shop', 'brands', 'blog', 'terms', 'privacy', 'returns', 'delivery', 'contact'];
const localized = (kind, slug) => Object.fromEntries(['ar', 'en'].map(lang => [lang, `${origin}/${lang}/${kind}/${encodeURIComponent(slug)}`]));

function urlset(entries) {
    const urls = entries.flatMap(({ alternates, updated_at }) => {
        const date = updated_at ? new Date(updated_at) : null;
        const lastmod = date && Number.isFinite(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : '';
        const links = Object.entries(alternates).map(([lang, url]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${xml(url)}"/>`).join('');
        return Object.values(alternates).map(url => `<url><loc>${xml(url)}</loc>${lastmod}${links}</url>`);
    });
    if (urls.length > 50000) throw new Error('Sitemap exceeds 50,000 URLs; split this sitemap before publishing.');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

function sitemapIndex() {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles.map(file => `<sitemap><loc>${origin}/${file}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

function pageSitemap() {
    return urlset([
        { alternates: { ar: `${origin}/ar/`, en: `${origin}/en/` } },
        ...publicPages.map(page => ({ alternates: { ar: `${origin}/${page}.html?lang=ar`, en: `${origin}/${page}.html?lang=en` } }))
    ]);
}

function robots() {
    return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /driver/\nDisallow: /__preview/\nDisallow: /checkout\nDisallow: /account\nDisallow: /track\nDisallow: /cart\nDisallow: /wishlist\nDisallow: /*?*admin=1\nDisallow: /*?*content_admin=1\n\nSitemap: ${origin}/sitemap.xml\n`;
}

module.exports = { origin, localized, urlset, sitemapIndex, pageSitemap, robots, sitemapFiles };
