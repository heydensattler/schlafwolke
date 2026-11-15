/* Offline-Speicher für die App-Dateien (Wetter kommt immer frisch aus dem Netz) */
const VERSION = 'schlafwolke-7';
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'wetter.js', 'beikost.js', 'who.js', 'pflege.js', 'gesundheit.js', 'erinnerungen.js', 'kosten.js', 'schwanger.js', 'oberflaeche.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Wetterdienst nicht zwischenspeichern
  // Netz zuerst (damit Änderungen ankommen), sonst Offline-Kopie
  // immer beim Server nachfragen (sonst kommen neue Fassungen erst Minuten später an)
  const frisch = e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(frisch.then(r => { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); return r; })
    .catch(() => caches.match(e.request)));
});
