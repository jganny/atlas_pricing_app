"use client";

import { useSyncExternalStore } from "react";
import { getSeatsVersion, subscribeSeats } from "@/lib/auth/desk-seats";

/** Call in any component that shows person names so it re-renders when a desk seat is reassigned. */
export function useSeatsVersion(): number {
  return useSyncExternalStore(subscribeSeats, getSeatsVersion, () => 0);
}
