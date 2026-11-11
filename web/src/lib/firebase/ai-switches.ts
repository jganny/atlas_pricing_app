"use client";

import { useQuery } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import { allOn, readSwitches, type AiSwitches } from "@/lib/ai/ai-switches";

const fn = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp(), "us-central1"), name, { timeout: 30_000 });

/** The current switches (any signed-in person). */
export async function fetchAiSwitches(): Promise<AiSwitches> {
  const res = await fn<Record<string, never>, unknown>("aiSwitchesGet")({});
  return readSwitches(res.data);
}

/** Save the switches (admin only). Takes effect on the server within a minute. */
export async function saveAiSwitches(next: AiSwitches): Promise<void> {
  await fn<AiSwitches, { ok: boolean }>("aiSwitchesSave")(next);
}

export const AI_SWITCHES_KEY = ["aiSwitches"] as const;

/** Switches for screens that show or hide an AI choice. While loading, or if the server cannot be reached, everything shows as on. */
export function useAiSwitches(): AiSwitches {
  const q = useQuery<AiSwitches>({ queryKey: AI_SWITCHES_KEY, queryFn: fetchAiSwitches, staleTime: 60_000, retry: 0 });
  return q.data ?? allOn();
}
