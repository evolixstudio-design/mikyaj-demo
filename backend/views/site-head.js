const verification = require('../data/search-console.json');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function faviconLinks() {
    // These new stable URLs also avoid previously cached 32px/192px tab icons.
    return '<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48 64x64 256x256" href="/favicon.ico"><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">';
}
function searchConsoleMeta() {
    const token = process.env.GOOGLE_SITE_VERIFICATION || verification.google_site_verification;
    return token ? `<meta name="google-site-verification" content="${escape(token)}">` : '';
}
module.exports = { faviconLinks, searchConsoleMeta };
