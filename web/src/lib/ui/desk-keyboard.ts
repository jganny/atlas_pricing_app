/** Shared keyboard helpers so every desk can be driven without the mouse. */

export function isForwardTab(e: {
  key: string;
  shiftKey: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  return e.key === "Tab" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
}

export function isBackTab(e: {
  key: string;
  shiftKey: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  return e.key === "Tab" && e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
}

export function focusById(id: string | undefined) {
  if (!id || typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        try {
          el.select();
        } catch {
          /* not selectable */
        }
      }
    }
  });
}

/**
 * Synchronous focus-by-id used to intercept Tab mid-step (e.g. jump from a
 * surcharge table's last Delete button to the next table's first Name
 * field) — unlike focusById above, this returns whether the target was
 * actually focused, so a caller only preventDefault()s the Tab when the
 * jump succeeds and otherwise falls through to normal DOM tab order.
 */
export function focusByIdNow(id: string | undefined): boolean {
  if (!id || typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return false;
  if (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  ) {
    return false;
  }
  el.focus();
  return document.activeElement === el;
}

export function lastFieldTab(
  e: { key: string; shiftKey: boolean; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; preventDefault: () => void },
  go: () => void,
) {
  if (!isForwardTab(e)) return;
  e.preventDefault();
  go();
}

export function firstFieldBackTab(
  e: { key: string; shiftKey: boolean; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; preventDefault: () => void },
  go: () => void,
) {
  if (!isBackTab(e)) return;
  e.preventDefault();
  go();
}
