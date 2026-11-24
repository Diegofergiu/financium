/* Service worker de Mi Bolsillo: hace la app instalable y gestiona los clics en notificaciones. */
const VERSION = 'mibolsillo-v1';
const SHELL = ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero; si no hay conexión, se sirve lo que haya en caché (solo GET del mismo origen).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || req.url.includes('/_next/static/') || req.url.includes('/icons/'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/dashboard') : undefined)))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Listo para Web Push (Firebase Cloud Messaging u otro servidor) si se configura en el futuro.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Mi Bolsillo', body: event.data && event.data.text() };
  }
  const n = data.notification || data;
  event.waitUntil(
    self.registration.showNotification(n.title || 'Mi Bolsillo', {
      body: n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: (data.data && data.data.url) || n.url || '/dashboard' },
    })
  );
});
