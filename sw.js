/* Meridian Portfolio — Service Worker
   Caches the app shell for fully offline use on iPhone.
   Data is stored in localStorage on-device, so no server needed.
*/

const CACHE_NAME = 'meridian-v1';

// All external scripts we need cached for offline use
const PRECACHE = [
  './portfolio_monitor.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.min.js',
];

// ── Install: cache everything we need ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      // Cache what we can; don't fail install if CDN is unreachable
      return Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Could not cache', url, e.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-first for live data ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for live data endpoints (FX, prices, IG helper)
  const isLiveData = (
    url.hostname.includes('frankfurter.app') ||
    url.hostname.includes('finnhub.io') ||
    url.hostname.includes('tiingo.com') ||
    url.hostname.includes('yahoo') ||
    url.hostname.includes('query1.finance') ||
    url.hostname.includes('query2.finance') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  );

  if (isLiveData) {
    // Network-only for live data; fall back silently if offline
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Cache-first for everything else (app shell, CDN scripts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML navigation
        if (event.request.destination === 'document') {
          return caches.match('./portfolio_monitor.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
