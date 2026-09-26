"use client";

import { useEffect, useState } from "react";

/**
 * Safari's "AutoFill > Other forms" resurrects a dropdown of every value
 * ever typed into a field with a given name, regardless of autocomplete="off"
 * — and renaming the field once only resets it, since typing into the new
 * fixed name just rebuilds the same history under that key. A name that
 * differs on every mount means there is never a stable key to accumulate
 * against. Starts undefined (server/first client render match, no
 * hydration warning) and is set once, client-only, right after mount.
 */
export function useAntiAutofillName(prefix: string): string | undefined {
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => {
    setName(`${prefix}-${Math.random().toString(36).slice(2, 10)}`);
  }, [prefix]);
  return name;
}
