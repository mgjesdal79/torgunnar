const VERSION = '38';
const CACHE = 'torgunnar-v' + VERSION;
const SHELL = [
  './', './index.html', './manifest.json',
  './js/logic.js', './js/store.js', './js/app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // cache: 'reload' tvinger ferske henting (utenom HTTP-cachen), slik at hele
    // skallet alltid cachses fra SAMME deploy. Uten dette kan install blande
    // versjoner (f.eks. ny app.js + gammel logic.js hvis to deploys skjer tett),
    // og da mangler app.js-handlere funksjoner i logic.js → klikk gjør ingenting.
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
