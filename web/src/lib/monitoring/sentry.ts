/** Optional Sentry hook — no-op unless NEXT_PUBLIC_SENTRY_DSN is set. */

export function initMonitoring() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return;
  // Lightweight beacon so production can wire @sentry/nextjs without blocking cutover.
  window.addEventListener("error", (ev) => {
    try {
      void fetch("https://sentry.io/api/0/envelope/", {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          dsn,
          message: String(ev.message || "error"),
          url: location.href,
        }),
      });
    } catch {
      /* ignore */
    }
  });
}

export function captureMessage(message: string) {
  if (process.env.NODE_ENV === "development") {
    console.info("[atlas]", message);
  }
}
