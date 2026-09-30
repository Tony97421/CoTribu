// CoTribu — service worker : cache hors ligne de l'app + réception des notifications.
// Changer VERSION à chaque mise en ligne.
const VERSION = 'cotribu-v44';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/icons.js', './js/core.js', './js/store.js', './js/ui.js', './js/maison.js', './js/courses.js',
  './js/planning.js', './js/extras.js', './js/accueil.js', './js/push.js', './js/proches.js', './js/premium.js', './js/ai.js', './js/points.js', './js/family.js', './js/guide.js', './js/moments.js', './js/launch.js', './js/drag.js', './js/social.js', './js/places.js', './js/feedback.js', './js/rating.js', './js/schedule.js', './js/cook.js', './js/recipes.js',
  './vendor/supabase-2.117.2.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png', './icons/badge.png',
  './icons/shortcut-courses.png', './icons/shortcut-task.png', './icons/shortcut-event.png', './icons/shortcut-memory.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
// L'app affiche « Nouvelle version disponible » ; un toucher envoie 'skip' pour l'activer.
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (toujours la dernière version), cache si hors ligne.
// « Partager vers CoTribu » (Android) : on garde le contenu reçu, puis on ouvre l'app qui le propose.
const SHARE = 'cotribu-share';
async function receiveShare(req){
  try {
    const f = await req.formData(), c = await caches.open(SHARE);
    for (const k of await c.keys()) await c.delete(k);
    const files = f.getAll('photos').filter(x => x && typeof x !== 'string' && x.size).slice(0, 12);
    for (let i = 0; i < files.length; i++) await c.put(`./__share/${i}`, new Response(files[i], {headers: {'content-type': files[i].type || 'image/jpeg'}}));
    const meta = {title: f.get('title') || '', text: f.get('text') || '', url: f.get('url') || '', files: files.length, at: Date.now()};
    await c.put('./__share/meta', new Response(JSON.stringify(meta), {headers: {'content-type': 'application/json'}}));
  } catch (e) { console.warn('share', e); }
  return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) { e.respondWith(receiveShare(req)); return; }
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
    icon: 'icons/icon-192.png', badge: 'icons/badge.png', data: {url: d.url || './', done: d.done || null},
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
  }));
});
// « C'est fait ✓ » : on coche la tâche sans ouvrir l'app (lien signé par le serveur)
async function markDoneFromNotif(n){
  const x = n.data && n.data.done; if (!x) return false;
  try {
    const res = await fetch(x.url, {method: 'POST', headers: {'Content-Type': 'application/json', ...(x.key ? {apikey: x.key, Authorization: 'Bearer ' + x.key} : {})},
      body: JSON.stringify({mode: 'done', h: x.h, t: x.t, m: x.m, d: x.d, sig: x.sig})});
    const r = await res.json().catch(() => ({}));
    if (!res.ok || !r.ok) return false;
    await self.registration.showNotification(r.already ? 'Déjà fait 👍' : 'Bravo, c’est noté ✓', {body: r.name || '', tag: n.tag || 'done', icon: 'icons/icon-192.png', badge: 'icons/badge.png', silent: true, data: {url: './'}});
    return true;
  } catch (_) { return false; }
}
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'done') {
    e.waitUntil(markDoneFromNotif(e.notification).then(ok => ok || clients.openWindow(new URL('./', self.registration.scope).href)));
    return;
  }
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    return clients.openWindow(target);
  }));
});
