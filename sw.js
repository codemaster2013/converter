/* MediaGrabber Pro – service worker
   Bump CACHE_VERSION whenever you change any file, so users get the update. */
const CACHE_VERSION = 'v2';
const CORE_CACHE = 'mgpro-core-' + CACHE_VERSION;
const RUNTIME_CACHE = 'mgpro-runtime-' + CACHE_VERSION;

// Relative paths so it works at a domain root (Vercel) AND a sub-path (GitHub Pages /converter/)
const CORE_ASSETS = [
  './',
  './index.html',
  './index (2).html',
  './index (3).html',
  './index (4).html',
  './index (5).html',
  './three-effects.js',
  './pwa.js',
  './site.webmanifest',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon-48x48.png',
  './apple-touch-icon.png',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png'
];

// Live data: never cache (feedback / VIP checks etc.)
const NETWORK_ONLY_HOSTS = [
  'firebaseio.com',
  'firebasedatabase.app',
  'google-analytics.com',
  'googletagmanager.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) =>
      // allSettled: one missing file must not break the whole install
      Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function putInCache(cacheName, request, response) {
  // cache good responses and opaque CDN <script> responses; ignore partial (206) / errors
  if (!response || (response.status !== 200 && response.type !== 'opaque')) return;
  const copy = response.clone();
  caches.open(cacheName).then((c) => c.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (NETWORK_ONLY_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // Pages: network first (always fresh when online), cached copy when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { putInCache(CORE_CACHE, req, res); return res; })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Everything else (own files + CDN libraries, fonts): cached copy now, refresh in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { putInCache(RUNTIME_CACHE, req, res); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
