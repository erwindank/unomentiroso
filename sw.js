// ============================================================
// Service worker (idea Y2 — install as an app)
//
// Network first, always: you get the newest version whenever you are online, and the
// last copy only when the network fails (so the app still opens offline and can show
// the start page and the guided game). Only this site's own files are cached;
// Firebase, fonts and other sites are left alone.
// ============================================================

const CACHE = 'uno-mentiroso-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // only files inside this game's folder (VIRUS! lives on the same site)
  if (!new URL(req.url).pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match(req, { ignoreSearch: true })))
  );
});
