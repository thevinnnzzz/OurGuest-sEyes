// Minimal service worker: no caching, just the fetch handler that browsers
// require before they will offer to install the app. Every request goes
// straight to the network, so a new deploy is picked up immediately.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request));
});
