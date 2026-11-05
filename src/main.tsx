import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

// Automatically bridge relative /api/ requests to the live production server when running inside Native Android/iOS
const isNativePlatform =
  Capacitor.isNativePlatform() ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

if (isNativePlatform) {
  const PROD_HOST = 'https://shanlocalnet.vercel.app';
  console.log('[NativeBridge] Routing relative /api calls to live production backend:', PROD_HOST);

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      if (input.startsWith('/api/')) {
        input = `${PROD_HOST}${input}`;
      }
    } else if (input instanceof URL && input.pathname.startsWith('/api/')) {
      input = new URL(`${PROD_HOST}${input.pathname}${input.search}`);
    }
    return originalFetch(input, init);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = `${PROD_HOST}${url}`;
    }
    return (originalXhrOpen as any).apply(this, [method, url, ...rest]);
  };
}

createRoot(document.getElementById('root')!).render(<App />);

// Register PWA service worker in production
if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost') && window.location.protocol !== 'capacitor:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] ServiceWorker active with scope:', reg.scope);
        // Force update check to ensure users get the latest sw.js immediately
        reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => console.warn('[PWA] ServiceWorker registration failed:', err));
  });
}
