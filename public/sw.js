const CACHE_NAME = 'localnet-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only process GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // STRICT BYPASS: Never intercept cross-origin (S3, CDN), APIs, or media streams/ranges
  if (
    url.origin !== location.origin ||
    url.pathname.startsWith('/api/') ||
    event.request.headers.has('range') ||
    event.request.destination === 'video' ||
    event.request.destination === 'audio' ||
    url.pathname.match(/\.(mp4|webm|mp3|ogg|wav|m4v)$/i)
  ) {
    // Return early without calling respondWith -> Native browser pipeline handles it directly
    return;
  }

  // Cache-first for immutable static bundles and icons
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
        );
      })
    );
  }
});
