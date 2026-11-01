const CACHE_NAME = 'royal-realms-shell-v7-wood-studio-webgl-recovery';
const CORE = [
  '/', '/index.html', '/manifest.webmanifest', '/icon.svg',
  '/assets/obsidian-realm.webp', '/assets/frostspire.webp',
  '/assets/mystic-empire.webp', '/assets/zenith-classic.webp',
  '/assets/shadow-crown.webp', '/assets/celestial-order.webp',
  '/assets/dragons-fang.webp', '/assets/nordic-legacy.webp',
  '/assets/void-realm.webp', '/assets/royal-aurora.webp',
  '/audio/wood-move.wav', '/audio/wood-capture.wav'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    for (const file of ['/engine/stockfish-19-lite-single.js', '/engine/stockfish-19-lite-single.wasm']) {
      try {
        const response = await fetch(file);
        if (response.ok) await cache.put(file, response);
      } catch (_) { /* Engine is optional until installed. */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('royal-realms-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});


self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new Request(url.href, { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && request.destination !== 'document' && !request.headers.has('range')) {
        cache.put(cacheKey, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return (await cache.match('/index.html')) || Response.error();
      return Response.error();
    }
  })());
});
