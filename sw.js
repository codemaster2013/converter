/* MediaGrabber Pro – service worker
   Bump CACHE_VERSION whenever you change any file, so users get the update. */
const CACHE_VERSION = 'v14';
const CORE_CACHE = 'mgpro-core-' + CACHE_VERSION;
const RUNTIME_CACHE = 'mgpro-runtime-' + CACHE_VERSION;
const SHARE_CACHE = 'mgpro-share';          // files received through "Share to MG Pro"
const RUNTIME_MAX_ENTRIES = 200;

// Relative paths so it works at a domain root (Vercel) AND a sub-path (GitHub Pages /converter/)
const CORE_ASSETS = [
  './', './index.html', './index (2).html', './index (3).html', './index (4).html', './index (5).html',
  './offline.html', './pwa.js', './mg-libs.js', './mg-deeplink.js', './mg-icons.js', './tools.js', './site.webmanifest',
  './lib-pdf.min.js', './lib-pdf.worker.min.js', './lib-pdf-lib.min.js', './lib-jszip.min.js', './lib-jspdf.umd.min.js', './lib-qrcode.min.js',
  './lib-firebase-app.js', './lib-firebase-database.js',
  './favicon.ico', './favicon-16x16.png', './favicon-32x32.png', './favicon-48x48.png',
  './apple-touch-icon.png', './android-chrome-192x192.png', './android-chrome-512x512.png', './android-chrome-maskable-192x192.png', './android-chrome-maskable-512x512.png'
];

// Live data: never cache (feedback / VIP checks etc.)
const NETWORK_ONLY_HOSTS = ['firebaseio.com', 'firebasedatabase.app', 'google-analytics.com', 'googletagmanager.com'];

// Large, rarely-changing files (OCR engine/language data): cache-first so they are downloaded only once
const BIG_FILES = /traineddata|tessdata|tesseract-core|\.wasm(\.js)?(\?|$)|worker\.min\.js|\/lib-[^/]*$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      // No skipWaiting() here: an update waits until the person taps "Update" (see SKIP_WAITING message below)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Tap on a "your file is ready" notification -> focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});

function trimCache(name, max) {
  caches.open(name).then((cache) => cache.keys().then((keys) => {
    if (keys.length > max) return Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  })).catch(() => {});
}

function putInCache(cacheName, request, response) {
  // cache good responses and opaque CDN <script> responses; ignore partial (206) / errors
  if (!response || (response.status !== 200 && response.type !== 'opaque')) return;
  const copy = response.clone();
  caches.open(cacheName).then((c) => c.put(request, copy)).then(() => trimCache(cacheName, RUNTIME_MAX_ENTRIES)).catch(() => {});
}

// Share target: receives files from the system "Share" sheet, stores them, opens the app
async function handleShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((f) => typeof f === 'object' && f && 'name' in f);
    const cache = await caches.open(SHARE_CACHE);
    await Promise.all((await cache.keys()).map((k) => cache.delete(k)));
    await Promise.all(files.map((f, i) => cache.put(
      new URL('shared/' + i, scope).href,
      new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name) } })
    )));
    return Response.redirect(new URL('./?shared=' + files.length, scope).href, 303);
  } catch (err) {
    return Response.redirect(new URL('./', scope).href, 303);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShare(req));
    return;
  }

  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;
  if (!/^https?:$/.test(url.protocol)) return;
  if (NETWORK_ONLY_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // Pages: network first (always fresh when online), cached copy / offline page when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { putInCache(CORE_CACHE, req, res); return res; })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match('./index.html'))
            .then((hit) => hit || caches.match('./offline.html'))
        )
    );
    return;
  }

  // OCR engine / language data: cache first (download once)
  if (BIG_FILES.test(req.url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => { putInCache(RUNTIME_CACHE, req, res); return res; }))
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
