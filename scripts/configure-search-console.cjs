const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../frontend/mikyaj-demo');
function verificationFile(file, content) {
    if (!/^google[a-f0-9]+\.html$/i.test(file) || content.trim() !== `google-site-verification: ${file}`) throw new Error('Use the original google….html file downloaded from Search Console, unchanged.');
    return file;
}
function configure(args) {
    if (args.length !== 2 || !['--file', '--token'].includes(args[0])) throw new Error('Usage: npm run seo:verify -- --file "C:/path/google123.html" OR --token YOUR_GOOGLE_META_TOKEN');
    if (args[0] === '--file') {
        const source = path.resolve(args[1]), file = path.basename(source), content = fs.readFileSync(source, 'utf8');
        verificationFile(file, content);
        if (source !== path.join(root, file)) fs.copyFileSync(source, path.join(root, file));
        return `Verification file saved at /${file}. Rebuild and deploy before clicking Verify.`;
    }
    if (!/^[a-zA-Z0-9_-]{20,256}$/.test(args[1])) throw new Error('Paste only the content value of the Google verification meta tag.');
    fs.writeFileSync(path.resolve(__dirname, '../backend/data/search-console.json'), JSON.stringify({ google_site_verification: args[1] }, null, 2) + '\n');
    return 'Public verification token saved. Rebuild and deploy both hosts before clicking Verify.';
}
if (require.main === module) { try { console.log(configure(process.argv.slice(2))); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { verificationFile, configure };
