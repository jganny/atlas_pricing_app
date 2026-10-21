/* Vertex PWA shell — never cache Firestore. Bump CACHE on every UI release. */
const CACHE = "atlas-app-shell-v34";
const PRECACHE = [
  "/app/manifest.webmanifest",
  "/app/icon-192.png",
  "/app/icon-512.png",
  "/app/icon-maskable-512.png",
  "/app/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // Stay waiting until Refresh now posts SKIP_WAITING. Auto-activate + claiming
  // clients during a reload makes Safari restore the session 2–3 times.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== "atlas-static-v1").map((k) => caches.delete(k)))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

// The app's code files have a different name every time their content changes (hash in the file name),
// so a file we already hold can never be stale: serve it from the device with no network wait.
// Kept in its own cache and trimmed, so old releases' files don't pile up.
const STATIC_CACHE = "atlas-static-v1";
const STATIC_MAX = 400;

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Only real files: a missing file is answered with the app's HTML page, which must never be kept as a script.
  const type = (response && response.headers.get("content-type")) || "";
  if (response && response.ok && !/text\/html/i.test(type)) {
    void cache.put(request, response.clone()).then(async () => {
      const keys = await cache.keys();
      if (keys.length > STATIC_MAX) await Promise.all(keys.slice(0, keys.length - STATIC_MAX).map((k) => cache.delete(k)));
    });
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
      return response;
    }
  } catch {
    /* fall through to cache */
  }
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}

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

  if (url.pathname.startsWith("/app/_next/static/")) {
    event.respondWith(cacheFirstStatic(req));
    return;
  }

  // HTML must not stick — Safari was serving Control tower after deploys.
  const isHtmlNav =
    req.mode === "navigate" ||
    url.pathname === "/app" ||
    url.pathname === "/app/" ||
    url.pathname.endsWith(".html");
  if (isHtmlNav) {
    // Online: always the fresh page (a copy is kept). Offline: the last copy of this page, so the
    // app — and Team chat, with its on-device messages — still opens without a connection.
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/app/")) || Response.error()),
    );
    return;
  }

  const isScriptOrStyle =
    req.destination === "script" ||
    req.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");
  if (isScriptOrStyle) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok && (req.destination === "image" || url.pathname.endsWith(".webmanifest"))) {
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

// Team chat alerts. The server sends a small data message; show it unless Atlas is already on screen.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const d = payload.data || payload.notification || payload;
  if (!d || (!d.title && !d.body)) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      if (wins.some((w) => w.visibilityState === "visible")) return undefined;
      return self.registration.showNotification(d.title || "Atlas Pricing", {
        body: d.body || "",
        tag: d.tag || "atlas-chat",
        icon: "/app/icon-192.png",
        badge: "/app/icon-192.png",
        data: { url: d.url || "/app/chat/" },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/chat/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.includes("/app"));
      if (open) {
        void open.navigate(url).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
