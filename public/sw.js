/**
 * @file public/sw.js
 * @description ResQ Progressive Web App Service Worker.
 *
 * Implements a network-first caching strategy for all ResQ assets.
 * Key features:
 * - Pre-caches app shell on install for offline capability
 * - Network-first fetch strategy: always tries network, falls back to cache
 * - Cache versioning: old caches are purged on activate
 * - Background sync stub for future offline emergency alert queuing
 * - Push notification stub for future server-push emergency updates
 *
 * @version 1.0.0
 */

const CACHE_NAME = 'resq-cache-v1';

/**
 * App shell assets to pre-cache on service worker install.
 * These ensure ResQ can load even without a network connection.
 */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — Pre-cache app shell
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Skip waiting so the new SW activates immediately
      return self.skipWaiting();
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — Purge stale caches from previous SW versions
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Claim all clients so the activated SW controls them immediately
      return self.clients.claim();
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — Network-first strategy
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Only handle GET requests — POST (Twilio, Gemini API) must bypass SW
  if (event.request.method !== 'GET') return;

  // Skip cross-origin API requests (Gemini, Twilio)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache a copy of the successful network response
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache (offline fallback)
        return caches.match(event.request).then((cached) => {
          return cached ?? caches.match('/index.html');
        });
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION STUB
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body ?? 'ResQ emergency update received.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'resq-emergency',
    requireInteraction: true,
    data: { url: data.url ?? '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? '🚨 ResQ Emergency Alert', options)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CLICK — Open or focus the app window
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If ResQ is already open, focus that window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
