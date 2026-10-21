"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";
import type { Instruction } from "@/lib/hub/instruction";

/** Asks the deployed `parseQuoteInstruction` function to read plain words. Returns null when it can't (the rules' reading stands). */
export async function readInstructionWithAI(text: string): Promise<Partial<Instruction> | null> {
  try {
    const call = httpsCallable<{ text: string }, { instruction: Partial<Instruction> }>(getFunctions(getFirebaseApp(), "us-central1"), "parseQuoteInstruction");
    const res = await call({ text });
    return res.data.instruction ?? null;
  } catch {
    return null;
  }
}
