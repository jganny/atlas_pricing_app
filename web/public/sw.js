/* Atlas Pricing PWA shell — static assets only; never cache Firestore. */
const CACHE = "atlas-app-shell-v2";
const PRECACHE = [
  "/app/",
  "/app/m/",
  "/app/quote/",
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

  // Network-first for HTML navigations so deploys show up quickly.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/app/m/"))),
    );
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
