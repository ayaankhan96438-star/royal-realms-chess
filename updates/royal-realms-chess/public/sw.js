const CACHE_NAME = 'royal-realms-shell-v4';
const CORE = [
  '/', '/index.html', '/manifest.webmanifest', '/icon.svg',
  '/assets/obsidian-realm.webp', '/assets/frostspire.webp',
  '/assets/mystic-empire.webp', '/assets/zenith-classic.webp',
  '/assets/shadow-crown.webp', '/assets/celestial-order.webp',
  '/assets/dragons-fang.webp', '/assets/nordic-legacy.webp',
  '/assets/void-realm.webp', '/assets/royal-aurora.webp',
  '/cinematics/knight-captures-queen.mp4',
  '/cinematics/pawn-battle.mp4',
  '/cinematics/bishop-defeats-knight.mp4',
  '/cinematics/king-battles-pawn.mp4',
  '/cinematics/queen-checkmates-king.mp4'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache UI and theme art first. Cinematic clips are optional and cached
    // individually so an unavailable clip never blocks installing the game.
    await cache.addAll(CORE.slice(0, 14));
    for (const file of CORE.slice(14)) {
      try {
        const response = await fetch(file);
        if (response.ok) await cache.put(file, response);
      } catch (_) { /* The board's realtime 3D combat still works without clips. */ }
    }
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

async function serveRange(cachedResponse, rangeHeader) {
  const bytes = await cachedResponse.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return cachedResponse;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
  let end = match[2] ? Number(match[2]) : size - 1;
  start = Math.max(0, Math.min(start, size - 1));
  end = Math.max(start, Math.min(end, size - 1));
  const slice = bytes.slice(start, end + 1);
  const headers = new Headers(cachedResponse.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(slice.byteLength));
  return new Response(slice, { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new Request(url.href, { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      if (request.headers.has('range') && url.pathname.endsWith('.mp4')) {
        return serveRange(cached, request.headers.get('range'));
      }
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
