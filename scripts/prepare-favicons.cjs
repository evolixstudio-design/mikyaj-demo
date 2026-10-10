const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp');
const root = path.resolve(__dirname, '../frontend/mikyaj-demo');
async function prepareFavicons() {
    // Use the owner's original transparent artwork, without redrawing the brand.
    const source = await sharp(path.resolve(__dirname, '../mikyaj_logo.png.png')).trim().png().toBuffer();
    const png = size => sharp(source).resize(size, size, { fit: 'contain', background: '#fff1f3' }).flatten({ background: '#fff1f3' }).png({ compressionLevel: 9 }).toBuffer();
    for (const size of [16, 32, 48, 64, 96, 192, 512]) fs.writeFileSync(path.join(root, `favicon-${size}.png`), await png(size));
    fs.writeFileSync(path.join(root, 'favicon.png'), await png(192));
    fs.writeFileSync(path.join(root, 'apple-touch-icon.png'), await png(180));
    // ICO directory with standard PNG-compressed images, including a 256px entry.
    const sizes = [16, 32, 48, 64, 256], buffers = await Promise.all(sizes.map(png));
    const directory = Buffer.alloc(6 + sizes.length * 16);
    directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
    let offset = directory.length;
    buffers.forEach((buffer, i) => {
        const start = 6 + i * 16, size = sizes[i] === 256 ? 0 : sizes[i];
        directory[start] = size; directory[start + 1] = size;
        directory.writeUInt16LE(1, start + 4); directory.writeUInt16LE(32, start + 6);
        directory.writeUInt32LE(buffer.length, start + 8); directory.writeUInt32LE(offset, start + 12);
        offset += buffer.length;
    });
    fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([directory, ...buffers]));
    fs.writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify({
        id: '/', name: 'Mikyaj Kuwait · مكياج الكويت', short_name: 'Mikyaj', start_url: '/', scope: '/',
        display: 'standalone', background_color: '#fff1f3', theme_color: '#6c3847',
        icons: [192, 512].map(size => ({ src: `/favicon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }))
    }, null, 2) + '\n');
}
if (require.main === module) prepareFavicons().then(() => console.log('Prepared real-logo favicon sizes, ICO fallback and web manifest.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepareFavicons };
