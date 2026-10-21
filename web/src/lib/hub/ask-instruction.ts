/**
 * Ask Vertex: "quote air BLR to LHR 120 kg use EK +100 add 10/kg in USD" opens the Air desk already filled — the lane,
 * the weight, and the instruction part, which the desk then applies exactly as it does for a Quote Hub drop.
 * "quote sea INMAA to AEJEA 12 cbm use MSC 40HC add 50/container in USD" does the same on the Sea desk.
 * Returns null when the line says nothing beyond a plain "quote air BLR to LHR" (the desk then just opens as before).
 */
import type { SmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { hasInstruction, parseInstruction, volumeFromText, weightFromText } from "./instruction";

export function askPrefill(text: string, intent: { mode: string; origin?: string; dest?: string }): SmartQuotePrefill | null {
  if (intent.mode !== "air" && intent.mode !== "sea") return null;
  const kg = weightFromText(text);
  const cbm = intent.mode === "sea" ? volumeFromText(text) : undefined;
  if (!hasInstruction(parseInstruction(text)) && !kg && !cbm) return null;
  return {
    mode: intent.mode,
    parsed: {
      customer: "",
      origin: intent.origin ?? "",
      destination: intent.dest ?? "",
      grossWeight: kg,
      ...(cbm ? { volume: cbm } : {}),
      packages: intent.mode === "air" && kg ? [{ qty: 1, gw: kg }] : [],
      containers: [],
      confidence: 0.5,
      source: "Ask Vertex",
    },
    carrierLabel: "",
    tariffFound: false,
    createdAt: Date.now(),
    instruction: text,
  };
}
