const BACKEND_ORIGIN = 'https://mikyaj-backend.onrender.com';

const BACKEND_PAGES = new Set([
  '/shop.html',
  '/blog.html',
  '/brands.html',
  '/product.html',
  '/terms.html',
  '/privacy.html',
  '/delivery.html',
  '/returns.html',
  '/about.html',
  '/contact.html',
  '/sitemap-products.xml',
  '/sitemap-categories.xml',
  '/sitemap-journal.xml',
]);

function localeHome(pathname) {
  if (pathname === '/ar/') return '/home-ar.html';
  if (pathname === '/en/') return '/home-en.html';
  return null;
}

function staticPageFallback(url) {
  if (!BACKEND_PAGES.has(url.pathname) || url.pathname.endsWith('.xml')) return null;
  return new URL(url.pathname + url.search, 'https://assets.local').href;
}

function usesBackend(pathname) {
  return pathname === '/api'
    || pathname.startsWith('/api/')
    || pathname === '/mikyaj/v1'
    || pathname.startsWith('/mikyaj/v1/')
    || pathname.startsWith('/ar/')
    || pathname.startsWith('/en/')
    || BACKEND_PAGES.has(pathname);
}

async function proxyToBackend(request) {
  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(incomingUrl.pathname + incomingUrl.search, BACKEND_ORIGIN);
  const initialProxyRequest = new Request(backendUrl, request);
  const headers = new Headers(initialProxyRequest.headers);

  headers.set('X-Forwarded-Host', incomingUrl.host);
  headers.set('X-Forwarded-Proto', incomingUrl.protocol.slice(0, -1));

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  return fetch(new Request(initialProxyRequest, { headers }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return Response.redirect(new URL('/admin/login.html', url), 302);
    }

    if (url.pathname === '/ar' || url.pathname === '/en') {
      return Response.redirect(new URL(`${url.pathname}/`, url), 308);
    }

    if (url.pathname === '/') {
      const indexAsset = new URL('/index.html', url);
      return env.ASSETS.fetch(new Request(indexAsset, request));
    }

    const homeAsset = localeHome(url.pathname);
    if (homeAsset) {
      const assetUrl = new URL(homeAsset, url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    if (usesBackend(url.pathname)) {
      try {
        const response = await proxyToBackend(request);
        if (response.status < 500 || request.method !== 'GET') return response;
      } catch (error) {
        if (request.method !== 'GET') throw error;
      }

      const fallback = staticPageFallback(url);
      if (fallback) return env.ASSETS.fetch(fallback);
      return new Response('The requested store page is temporarily unavailable.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
