const cacheName = 'haitang-guitar-studio-1';
const index = '/index.html';
const localAsset = /\.(?:js|css|png|json|webmanifest|wav)$/i;

async function cacheShell() {
  const cache = await caches.open(cacheName);
  const response = await fetch(index, {cache:'reload'});
  if (!response.ok) throw Error('Missing app shell');
  await cache.put(index, response.clone());
  const html = await response.text();
  const files = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], self.location.origin))
    .filter(url => url.origin === self.location.origin && localAsset.test(url.pathname));
  await Promise.allSettled([...new Set(files.map(url => url.href))].map(url => cache.add(url)));
}
self.addEventListener('install', event => event.waitUntil(cacheShell()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('haitang-guitar-studio-') && name !== cacheName)
    .map(name => caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const shell = request.mode === 'navigate' && ['/',index].includes(url.pathname);
  const staticResource = ['script','style','image','manifest'].includes(request.destination) ||
    url.pathname.startsWith('/guitar-samples/');
  if (!shell && !(staticResource && localAsset.test(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok && !shell) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(shell ? index : request);
      if (cached) return cached;
      throw error;
    }
  })());
});
