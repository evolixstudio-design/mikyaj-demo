const {test}=require('node:test'),assert=require('node:assert/strict');
const {plainText,normalizeUrl,reviewFlags}=require('../scripts/scrape-catalog-details.cjs');
test('enrichment strips executable markup but preserves readable details',()=>{assert.equal(plainText('<p>غسول &amp; عناية</p><ul><li>200 مل</li></ul><script>alert(1)</script>'),'غسول & عناية\n200 مل');assert.equal(normalizeUrl('https://attarkuwait.com/product/%D8%A8/'),'/product/ب');assert.equal(normalizeUrl('bad url'),'');assert.ok(reviewFlags('اتصل بنا https://attarkuwait.com/').includes('source_store_reference'));});
