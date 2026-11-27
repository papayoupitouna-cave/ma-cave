// Ma Cave — fonctionnement hors ligne. Réseau d'abord (mises à jour immédiates), copie locale si hors ligne.
const VERSION = 'ma-cave-v1.8';
const FICHIERS = ['./', 'index.html', 'style.css', 'app.js', 'appellations.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS.map(f => new Request(f, {cache: 'reload'}))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Google & Drive : jamais en cache
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, {cache: 'no-cache'}) : new Request(e.request, {cache: 'no-cache'});
  e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
});
