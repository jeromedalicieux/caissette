/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

const CACHE_NAME = `rebond-cache-${version}`
const API_CACHE = `rebond-api-${version}`

const ASSETS = [...build, ...files]

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  )
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE).map((key) => caches.delete(key)),
      ),
    ),
  )
})

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)

  // Skip non-GET for caching
  if (event.request.method !== 'GET') return

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(API_CACHE)
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          return new Response(JSON.stringify({ error: 'Hors ligne' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }),
    )
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached ?? fetch(event.request)
    }),
  )
})
