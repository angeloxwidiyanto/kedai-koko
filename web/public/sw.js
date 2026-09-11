// Service Worker untuk Kedai Koko PWA
const CACHE_NAME = 'kedai-koko-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api')) return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
