const CACHE_NAME = 'localnet-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Only process GET requests
  if (event.request.method !== 'GET') return;

  const urlStr = event.request.url;

  // STRICT BYPASS: Never intercept cross-origin (S3, AWS, CDNs), APIs, media streams/ranges, or APK downloads
  if (
    !urlStr.startsWith(location.origin) ||
    urlStr.includes('/api/') ||
    urlStr.includes('/downloads/') ||
    urlStr.includes('/videos/') ||
    urlStr.includes('WhatsApp') ||
    urlStr.includes('s3.') ||
    urlStr.includes('amazonaws.com') ||
    event.request.headers.has('range') ||
    event.request.destination === 'video' ||
    event.request.destination === 'audio' ||
    /\.(mp4|webm|mp3|ogg|wav|m4v|apk)$/i.test(urlStr)
  ) {
    // Native browser pipeline handles it directly
    return;
  }

  const url = new URL(urlStr);

  // Cache-first ONLY for immutable static assets in /assets/ or app icons
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
          }).catch(() => cached)
        );
      })
    );
  }
});
