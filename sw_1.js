/* Meridian Portfolio — Service Worker */
const CACHE_NAME = 'meridian-v3';
const BASE = 'https://jimmyleong888-sys.github.io/multi-asset-portfolio';

const PRECACHE = [
  `${BASE}/portfolio_monitor_1.html`,
  `${BASE}/manifest.json`,
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE.map(url =>
        cache.add(url).catch(e => console.warn('[SW] Could not cache', url, e.message))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLiveData = ['jsdelivr.net','frankfurter.app','er-api.com','finnhub.io',
    'tiingo.com','yahoo','query1.finance','query2.finance','localhost','127.0.0.1']
    .some(h => url.hostname.includes(h));

  if (isLiveData) {
    event.respondWith(fetch(event.request).catch(() => new Response('', {status:503})));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (event.request.method === 'GET' && response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match(`${BASE}/portfolio_monitor_1.html`);
        }
        return new Response('', {status:503});
      });
    })
  );
});
