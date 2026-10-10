const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs'), path = require('node:path');
const cheerio = require('cheerio'), robotsParser = require('robots-parser'), sharp = require('sharp');
let fixture, app;
before(async () => { fixture = await require('./isolated-db.cjs').setup(); app = require('../backend/app').createApp(); });
after(async () => fixture?.close());
const parse = xml => cheerio.load(xml, { xml: true });
const locations = xml => { const $ = parse(xml); return $('url > loc').map((i, el) => $(el).text()).get(); };

test('crawlable root files agree with the build and every sitemap URL resolves to its canonical page', async () => {
    const robots = await request(app).get('/robots.txt');
    assert.equal(robots.status, 200); assert.match(robots.headers['content-type'], /^text\/plain/);
    const rules = robotsParser('https://mikyajkw.com/robots.txt', robots.text);
    for (const bot of ['Googlebot', 'Googlebot-Image', 'Bingbot']) {
        for (const url of ['/', '/ar/', '/en/', '/favicon.ico', '/favicon-192.png', '/js/storefront.js', '/css/storefront.css', '/en/products/rose-lipstick']) assert.equal(rules.isAllowed('https://mikyajkw.com' + url, bot), true, bot + ': ' + url);
        for (const url of ['/admin/manage.html', '/api/manage/products', '/track.html?order=0001', '/__preview/mobile', '/shop.html?lang=en&admin=1']) assert.equal(rules.isAllowed('https://mikyajkw.com' + url, bot), false, bot + ': ' + url);
    }
    const root = path.resolve(__dirname, '../frontend/mikyaj-demo');
    assert.equal(robots.text, fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'));
    const index = await request(app).get('/sitemap.xml');
    assert.equal(index.text, fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'));
    const $ = parse(index.text), maps = $('sitemap > loc').map((i, el) => $(el).text()).get();
    assert.equal(maps.length, 4); assert.match(index.headers['content-type'], /^application\/xml/);
    for (const map of maps) {
        const sitemap = await request(app).get(new URL(map).pathname);
        assert.equal(sitemap.status, 200); assert.match(sitemap.headers['content-type'], /^application\/xml/);
        const xml = parse(sitemap.text); assert.equal(xml('urlset').attr('xmlns'), 'http://www.sitemaps.org/schemas/sitemap/0.9');
        for (const loc of locations(sitemap.text)) {
            const url = new URL(loc); assert.equal(url.origin, 'https://mikyajkw.com');
            const page = await request(app).get(url.pathname + url.search);
            assert.equal(page.status, 200, loc); const html = cheerio.load(page.text);
            assert.equal(html('link[rel=canonical]').attr('href'), loc);
            assert.doesNotMatch(html('meta[name=robots]').attr('content') || '', /noindex/);
        }
    }
    const pages = await request(app).get('/sitemap-pages.xml');
    assert.equal(pages.text, fs.readFileSync(path.join(root, 'sitemap-pages.xml'), 'utf8'));
});

test('catalog sitemaps follow visibility, include out-of-stock listings and published bilingual journal entries', async () => {
    await fixture.db.query("UPDATE products SET status='UNLISTED' WHERE id=2");
    await fixture.db.query("UPDATE products SET deleted_at=NOW() WHERE id=3");
    await fixture.db.query("UPDATE products SET stock_status='OUT_OF_STOCK' WHERE id=4");
    const initial = locations((await request(app).get('/sitemap-products.xml')).text);
    assert.ok(initial.includes('https://mikyajkw.com/en/products/rose-lipstick'));
    assert.ok(initial.includes('https://mikyajkw.com/ar/products/moisturizer'));
    assert.ok(!initial.some(url => /lip-liner|face-cleanser/.test(url)));
    await fixture.db.query("UPDATE categories SET status='INACTIVE' WHERE id=2");
    assert.ok(!locations((await request(app).get('/sitemap-products.xml')).text).some(url => /moisturizer/.test(url)));
    assert.ok(!locations((await request(app).get('/sitemap-categories.xml')).text).some(url => /\/skin$/.test(url)));
    await fixture.db.query("INSERT INTO blog_posts(slug,title_ar,title_en,body_ar,body_en,status,publish_at) VALUES('published-journal','مقال','Article','نص','Body','PUBLISHED',NOW()-INTERVAL '1 day'),('future-journal','مقال','Future','نص','Body','PUBLISHED',NOW()+INTERVAL '1 day'),('draft-journal','مقال','Draft','نص','Body','DRAFT',NOW()-INTERVAL '1 day')");
    const journal = await request(app).get('/sitemap-journal.xml');
    const urls = locations(journal.text);
    assert.ok(urls.includes('https://mikyajkw.com/ar/journal/published-journal'));
    assert.ok(urls.includes('https://mikyajkw.com/en/journal/published-journal'));
    assert.ok(!urls.some(url => /future-journal|draft-journal/.test(url)));
    const xml = parse(journal.text); assert.equal(xml('url').first().find('xhtml\\:link').length, 2);
    assert.match(xml('lastmod').first().text(), /^\d{4}-\d{2}-\d{2}T/);
});

test('real-logo ICO, PNG sizes, Apple icon and manifest are available without stale icon caching on all page types', async () => {
    const ico = fs.readFileSync(path.resolve(__dirname, '../frontend/mikyaj-demo/favicon.ico'));
    assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 5);
    for (const size of [16, 32, 48, 64, 96, 192, 512]) {
        const result = await request(app).get(`/favicon-${size}.png`);
        assert.equal(result.status, 200); assert.match(result.headers['content-type'], /^image\/png/);
        assert.match(result.headers['cache-control'], /max-age=0,must-revalidate/);
        const metadata = await sharp(result.body).metadata(); assert.equal(metadata.width, size); assert.equal(metadata.height, size);
    }
    for (const file of ['favicon.ico', 'apple-touch-icon.png', 'site.webmanifest']) {
        const result = await request(app).get('/' + file); assert.equal(result.status, 200); assert.match(result.headers['cache-control'], /max-age=0,must-revalidate/);
        assert.equal((await request(app).get('/' + file).set('If-None-Match', result.headers.etag)).status, 304);
    }
    const manifest = await request(app).get('/site.webmanifest'); assert.match(manifest.headers['content-type'], /^application\/manifest\+json/);
    assert.deepEqual(JSON.parse(manifest.text).icons.map(i => i.sizes), ['192x192', '512x512']);
    for (const url of ['/', '/ar/', '/en/', '/en/products/rose-lipstick', '/shop.html?lang=en', '/admin/login.html', '/admin/manage.html', '/cart.html']) {
        const result = await request(app).get(url); assert.equal(result.status, 200, url);
        const html = cheerio.load(result.text); assert.equal(html('link[href="/favicon.ico"]').length, 1); assert.equal(html('link[rel="manifest"]').attr('href'), '/site.webmanifest');
    }
});

test('verification stays unset without a real token; configured meta is escaped and file validation rejects invalid content', async () => {
    const original = process.env.GOOGLE_SITE_VERIFICATION;
    try {
        delete process.env.GOOGLE_SITE_VERIFICATION;
        assert.doesNotMatch((await request(app).get('/')).text, /name="google-site-verification"/);
        process.env.GOOGLE_SITE_VERIFICATION = 'public_token"><script>alert(1)</script>';
        const html = (await request(app).get('/en/')).text;
        assert.match(html, /name="google-site-verification" content="public_token&quot;&gt;&lt;script&gt;/);
        assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    } finally { if (original === undefined) delete process.env.GOOGLE_SITE_VERIFICATION; else process.env.GOOGLE_SITE_VERIFICATION = original; }
    const { verificationFile } = require('../scripts/configure-search-console.cjs');
    assert.equal(verificationFile('google123abcd.html', 'google-site-verification: google123abcd.html\n'), 'google123abcd.html');
    assert.throws(() => verificationFile('../google123abcd.html', 'google-site-verification: ../google123abcd.html'));
    assert.throws(() => verificationFile('google123abcd.html', '<html>not the verification file</html>'));
});
