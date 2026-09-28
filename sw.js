// CoTribu — cache hors ligne de l'application (pas des données).
// Changer VERSION à chaque mise en ligne pour que les téléphones prennent la nouvelle version.
const VERSION = 'cotribu-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/supabase-2.117.2.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase, polices : réseau direct

  // La page : réseau d'abord (toujours la dernière version), cache si hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Le reste (bibliothèque, icônes) : cache d'abord.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
