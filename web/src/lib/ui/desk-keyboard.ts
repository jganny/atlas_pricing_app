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
