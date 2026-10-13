// Nico Desk service worker. Kept small on purpose.
// Rules:
//  - Never cache /api/ or anything that carries a session. Page HTML holds private data, so it is never cached either.
//  - Static assets (/_next/static, /icons, fonts) are cache-first: their names change when their content changes.
//  - A page visit goes to the network first. If the network is down, the visitor sees /offline.html.
// Bump VERSION to drop every old cache on the next activate.
const VERSION = 'v1';
const CACHE = 'nico-desk-static-' + VERSION;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

// Which requests may be answered from the cache. Exported at the bottom so a test can check the rule.
function isStaticAsset(url) {
  const p = url.pathname;
  if (p.startsWith('/api/')) return false;
  return p.startsWith('/_next/static/') || p.startsWith('/icons/') || p === '/manifest.webmanifest' || p === OFFLINE_URL;
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nico-desk-') && k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // writes always go to the network, untouched
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return; // never cached, never touched

    if (req.mode === 'navigate') {
      event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
      return;
    }

    if (isStaticAsset(url)) {
      event.respondWith(
        caches.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })),
      );
    }
  });
}

if (typeof module !== 'undefined') module.exports = { isStaticAsset, VERSION, CACHE, OFFLINE_URL };
