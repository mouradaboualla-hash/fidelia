// Service worker mínimo: permite instalar la app y abrirla sin conexión con la última versión vista.
const CACHE = "fidelia-v1";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok && new URL(req.url).origin === location.origin) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req))
  );
});
