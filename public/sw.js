/**
 * client/public/sw.js
 * WiFi Drop Progressive Web App (PWA) Service Worker
 * Offline asset caching and network fallback
 */

const CACHE_NAME = 'wifidrop-v2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/mobile',
];

// Install Event — Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests (ignores chrome-extension://, moz-extension://, etc.)
  if (!event.request.url.startsWith('http')) return;

  // Skip API requests and Socket.io requests from caching
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/socket.io/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
