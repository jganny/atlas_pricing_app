import { reloadOnceIfStale, reportError } from "./error-report";

let started = false;

/**
 * Starts first-party error monitoring: uncaught errors and unhandled promise
 * rejections are recorded to the admin "Error monitor" (see error-report.ts).
 * Idempotent. (File name kept so existing imports don't change.)
 */
export function initMonitoring() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("error", (ev) => {
    const message = ev.message || (ev.error instanceof Error ? ev.error.message : "");
    if (reloadOnceIfStale(message)) return;
    reportError({ message: message || ev.error, stack: ev.error instanceof Error ? ev.error.stack : undefined, source: "window" });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason as { message?: unknown; stack?: unknown } | string | undefined;
    const message = typeof r === "string" ? r : r?.message;
    if (typeof message === "string" && reloadOnceIfStale(message)) return;
    reportError({ message, stack: typeof r === "object" ? r?.stack : undefined, source: "promise" });
  });
}

export function captureMessage(message: string) {
  if (process.env.NODE_ENV === "development") {
    console.info("[atlas]", message);
  }
}
