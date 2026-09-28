// CoTribu — service worker : cache hors ligne de l'app + réception des notifications.
// Changer VERSION à chaque mise en ligne.
const VERSION = 'cotribu-v14';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/icons.js', './js/core.js', './js/store.js', './js/ui.js', './js/maison.js', './js/courses.js',
  './js/planning.js', './js/extras.js', './js/accueil.js', './js/push.js', './js/proches.js', './js/premium.js', './js/ai.js', './js/points.js', './js/family.js', './js/guide.js', './js/moments.js',
  './vendor/supabase-2.117.2.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png', './icons/badge.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
// L'app affiche « Nouvelle version disponible » ; un toucher envoie 'skip' pour l'activer.
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (toujours la dernière version), cache si hors ligne.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // « no-cache » : le navigateur revérifie toujours auprès du serveur (les mises à jour arrivent tout de suite)
  const net = req.mode === 'navigate' ? new Request(req.url, {cache: 'no-cache', credentials: 'same-origin'}) : new Request(req, {cache: 'no-cache'});
  e.respondWith(
    fetch(net).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, {ignoreSearch: req.mode === 'navigate'}))
  );
});

// Notifications
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {body: e.data && e.data.text()}; }
  e.waitUntil(self.registration.showNotification(d.title || 'CoTribu', {
    body: d.body || '', tag: d.tag, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/badge.png', data: {url: d.url || './'},
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    return clients.openWindow(target);
  }));
});
