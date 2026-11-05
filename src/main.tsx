import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register PWA service worker in production
if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] ServiceWorker active with scope:', reg.scope);
        // Force update check to ensure users get the latest sw.js immediately
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn('[PWA] ServiceWorker registration failed:', err));
  });
}
