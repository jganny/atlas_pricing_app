/* Vertex PWA shell — never cache Firestore. Bump CACHE on every UI release. */
const CACHE = "atlas-app-shell-v12";
const PRECACHE = [
  "/app/manifest.webmanifest",
  "/app/icon-192.png",
  "/app/icon-512.png",
  "/app/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (
    url.pathname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firebaseio")
  ) {
    return;
  }
  if (!url.pathname.startsWith("/app")) return;

  // HTML must not stick — Safari was serving Control tower after deploys.
  const isHtmlNav =
    req.mode === "navigate" ||
    url.pathname === "/app" ||
    url.pathname === "/app/" ||
    url.pathname.endsWith(".html");
  if (isHtmlNav) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match("/app/")));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (
            res.ok &&
            (req.destination === "style" ||
              req.destination === "script" ||
              req.destination === "image" ||
              url.pathname.endsWith(".webmanifest"))
          ) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
