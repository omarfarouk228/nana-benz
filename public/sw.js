// Jeu hors ligne : le jeu se met en cache à la première visite, puis se lance sans réseau.
// Les fichiers sont servis depuis le cache et mis à jour en arrière-plan quand le réseau revient.
const CACHE = 'nana-benz-v3';
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png']).catch(() => {})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// la page envoie la liste de ce qu'elle a déjà chargé (scripts, styles, polices)
self.addEventListener('message', (e) => {
  const urls = (e.data && e.data.cache) || [];
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.filter(ok).map((u) => c.add(u).catch(() => {})))));
});
const ok = (u) => { try { const x = new URL(u); return x.origin === self.location.origin || FONTS.includes(x.origin); } catch { return false; } };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !ok(req.url)) return;
  // la page : le réseau d'abord (pour avoir la dernière version), le cache sans réseau
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }
  // le reste : le cache tout de suite, mis à jour en arrière-plan
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
