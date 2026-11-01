/* Vertex Chat service worker — keeps the app opening offline and shows chat alerts. Never caches Firestore. Bump CACHE on every release. */
const CACHE = "vertex-chat-shell-v1";
const STATIC_CACHE = "vertex-chat-static-v1";
const STATIC_MAX = 300;
const PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  // Waits until the page asks to update, so a reload never swaps code half-way.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
});

// Code files carry a hash in their name, so one we already hold is never stale.
async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  const type = (response && response.headers.get("content-type")) || "";
  if (response && response.ok && !/text\/html/i.test(type)) {
    void cache.put(request, response.clone()).then(async () => {
      const keys = await cache.keys();
      if (keys.length > STATIC_MAX) await Promise.all(keys.slice(0, keys.length - STATIC_MAX).map((k) => cache.delete(k)));
    });
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // database, sign-in and file servers are never touched
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstStatic(req));
    return;
  }
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/") {
    // Online: the fresh page (a copy is kept). Offline: the last copy, so the chat — and the messages kept on the phone — still open.
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && (req.destination === "image" || url.pathname.endsWith(".webmanifest"))) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// The server sends a small data message with a link into the Pricing app (/app/chat/?room=…). Here that means "open that chat".
function chatUrl(raw) {
  try {
    const room = new URL(raw, self.location.origin).searchParams.get("room");
    return room ? `/?room=${encodeURIComponent(room)}` : "/";
  } catch {
    return "/";
  }
}

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
      return self.registration.showNotification(d.title || "Vertex Chat", {
        body: d.body || "",
        tag: d.tag || "vertex-chat",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: chatUrl(d.url || "") },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      if (open) {
        void open.navigate(url).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
