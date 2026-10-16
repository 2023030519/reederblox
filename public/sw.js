// Keeps the app shell available offline. Only same-origin GETs; Supabase calls and images are never touched.
const PAGES = "rb-pages-v1";
const STATIC = "rb-static-v1";
const MAX_STATIC = 150;

self.addEventListener("install", (e) => {
  // The downloads page doubles as the offline fallback.
  e.waitUntil(caches.open(PAGES).then((c) => c.add("/offline")).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Build assets are fingerprinted: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        await c.put(req, res.clone());
        // Old deploys' fingerprinted files are never requested again; cap the cache, oldest first.
        const keys = await c.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC)).map((k) => c.delete(k)));
      }
      return res;
    }));
    return;
  }

  // Pages: network first, remember the last good copy, fall back to it (or to /offline) without a connection.
  if (req.mode === "navigate") {
    e.respondWith(caches.open(PAGES).then(async (c) => {
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        return (await c.match(req)) || (await c.match("/offline")) || Response.error();
      }
    }));
  }
});
