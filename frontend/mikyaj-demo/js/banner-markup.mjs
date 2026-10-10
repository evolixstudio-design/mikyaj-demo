export const bannerPlacements = {
    hero: 'Homepage hero', after_hero: 'Homepage · below hero', after_categories: 'Homepage · below categories',
    after_featured: 'Homepage · below featured products', before_footer: 'Homepage · above footer',
    shop_top: 'Shop & category pages · above products', product_bottom: 'Product pages · below details'
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photo = (url, width) => String(url || '').replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
export function bannerLink(value, lang) {
    const url = new URL(value || '/shop.html', 'https://mikyajkw.com');
    url.pathname = url.pathname.replace(/^\/(ar|en)\//, '/' + lang + '/');
    if (/\.html$/.test(url.pathname)) url.searchParams.set('lang', lang);
    return url.pathname + url.search + url.hash;
}
export function bannerMarkup(banner, lang = 'ar', { preview = false, responsiveImages = [] } = {}) {
    const title = banner['title_' + lang] || '', alt = banner['image_alt_' + lang] || title || 'Mikyaj Kuwait';
    const description = banner['seo_description_' + lang] || '';
    const hero = banner.placement === 'hero', source = banner.image_url;
    if (!source) return '<div class="banner-empty-preview">Upload an image to see the preview</div>';
    const candidates = source.includes('res.cloudinary.com/') ? [480,768,1200,1600].map(width => ({url:photo(source,width),width})) : responsiveImages;
    const responsive = candidates.length ? `srcset="${candidates.map(image => esc(image.url)+' '+Number(image.width)+'w').join(', ')}" sizes="(max-width:767px) calc(100vw - 32px), (max-width:1050px) calc(100vw - 48px), (max-width:1360px) calc(100vw - 80px), 1280px"` : '';
    const ratio = Number(banner.image_width) > 0 && Number(banner.image_height) > 0 ? Number(banner.image_width) / Number(banner.image_height) : 16/7;
    const x = Math.min(100,Math.max(0,Number(banner.focus_x ?? 50))), y = Math.min(100,Math.max(0,Number(banner.focus_y ?? 50)));
    const image = `<img src="${esc(photo(source,hero?1600:1200))}" ${responsive} alt="${esc(alt)}" width="${Number(banner.image_width)||1600}" height="${Number(banner.image_height)||700}" decoding="async" loading="${hero?'eager':'lazy'}" ${hero?'fetchpriority="high"':''} style="object-position:${x}% ${y}%">`;
    const media = `${hero?`<h1 class="banner-sr-only">${esc(title||(lang==='ar'?'مكياج وعناية بالبشرة في الكويت':'Makeup and skincare in Kuwait'))}</h1>`:''}<div class="banner-media" style="--art-ratio:${ratio}">${image}</div>${!hero&&(title||description)?`<div class="banner-caption" dir="${lang==='ar'?'rtl':'ltr'}">${title?`<h2>${esc(title)}</h2>`:''}${description?`<p>${esc(description)}</p>`:''}<span>${lang==='ar'?'تسوقي الآن':'Shop now'} ↗</span></div>`:''}`;
    return `<section class="store-banner" ${banner.id?`data-banner-id="${esc(banner.id)}"`:''} data-fit="${banner.fit === 'cover' ? 'cover' : 'contain'}">${preview?`<div>${media}</div>`:`<a href="${esc(bannerLink(banner.link_url,lang))}" aria-label="${esc(title||alt)}">${media}</a>`}</section>`;
}
