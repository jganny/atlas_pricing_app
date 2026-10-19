"use client";

import { useEffect } from "react";
import { markQuoteStart } from "@/lib/quotes/quote-timer";

/** Starts the stopwatch when a desk is opened. Invisible to the user. */
export function useQuoteTimer(): void {
  useEffect(() => {
    markQuoteStart();
  }, []);
}
