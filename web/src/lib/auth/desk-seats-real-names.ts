import type { DeskSeatId } from "@/lib/auth/desk-seats";

/**
 * Real seat labels and real person-name fallbacks — split into their own
 * file so the demo build (scripts/build-demo.sh) can swap this exact file
 * out for a demo-safe stub before compiling, guaranteeing these strings
 * never enter that build's output. See team-roles-real-names.ts for why a
 * runtime check alone isn't enough. Never import this file from anywhere
 * except desk-seats.ts.
 */
export const REAL_SEAT_LABELS: Record<DeskSeatId, string> = {
  admin: "Pricing Team",
  manager: "Manager",
  "air-nom": "Air Nom",
  "sea-nom": "Sea Nom",
  nrs: "NRS",
  freehand: "Free Hand",
  pricing: "Pricing agent",
};

export const REAL_PERSON_NAMES: Record<string, string> = {
  ganny: "Ganny",
  manager: "Manager",
  shashank: "Shashank",
  shaheer: "Shaheer",
  kavya: "Kavya",
  jaya: "Jaya",
  cathrina: "Cathrina",
  pricing: "Pricing",
  sunil: "Sunil",
  ramesh: "Ramesh",
  goutham: "Goutham",
  spoorthi: "Spoorthi",
  linson: "Linson",
};
