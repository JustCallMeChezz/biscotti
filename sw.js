const SHELL_CACHE = 'biscotti-shell-v2';
const RUNTIME_CACHE = 'biscotti-runtime-v2';
const SHELL = ['./', 'index.html', 'ui.css', 'biscotti.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(e, cacheName, fallback) {
  const req = e.request;
  const cache = await caches.open(cacheName);
  const nav = req.mode === 'navigate';
  const hit = (await cache.match(req, { ignoreSearch: nav })) || (nav && fallback ? await cache.match(fallback) : undefined);
  const fresh = fetch(req)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(nav ? 'index.html' : req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    e.waitUntil(fresh);
    return hit;
  }
  return (await fresh) || Response.error();
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) e.respondWith(staleWhileRevalidate(e, SHELL_CACHE, 'index.html'));
  else if (EXTERNAL.includes(url.hostname)) e.respondWith(staleWhileRevalidate(e, RUNTIME_CACHE));
});
