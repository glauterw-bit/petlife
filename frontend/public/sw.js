// PetLife — service worker mínimo
// Estratégia: stale-while-revalidate para assets estáticos, network-first para HTML/API.
const VERSION = 'petlife-v1'
const STATIC_CACHE = `static-${VERSION}`

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Nunca cachear API do backend nem rotas dinâmicas de auth
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')) return
  if (url.pathname.startsWith('/auth/')) return

  // Documentos HTML: network-first com fallback ao cache
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then(c => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req))
    )
    return
  }

  // Estáticos do _next/static: cache-first (são imutáveis com hash no path)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then(c => c.put(req, copy))
          return res
        })
      )
    )
    return
  }
})

// Push: handler pronto para integração futura com Web Push
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  const title = data.title || 'PetLife'
  const options = {
    body: data.body || '',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    data: data.url || '/',
    tag: data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(self.clients.openWindow(url))
})
