/**
 * "Who serves this lane" for a new quote: the carriers with a rate on file (green) and the Directory vendors that
 * serve the country but have no rate on file yet (red). Each is shown by its short airline / liner code.
 */
import { contactCountries, vendorKind } from "@/lib/directory/coverage";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { AirTariff, DirectoryContact, SeaTariff } from "@/lib/types";

export interface CarrierCodeRow {
  code: string;
  name: string;
}

export interface LaneChip {
  /** Short code: "EK", "QR", "MSCU". */
  code: string;
  /** Full name used when the carrier is added. */
  name: string;
  /** green = a rate is on file for this lane; red = serves it, no rate on file yet. */
  status: "rate" | "none";
}

export const MAX_LANE_CHIPS = 9;

/** The code to show for a name: the tariff's own code, else the carriers list, else its initials. */
export function shortCode(name: string, given: string | undefined, list: CarrierCodeRow[]): string {
  const g = (given || "").trim().toUpperCase();
  if (g.length >= 2 && g.length <= 4 && /^[A-Z0-9]+$/.test(g)) return g;
  const n = normalizeCarrierName(name);
  const hit = list.find((r) => normalizeCarrierName(r.name) === n) ?? list.find((r) => n && (normalizeCarrierName(r.name).startsWith(n) || n.startsWith(normalizeCarrierName(r.name))));
  if (hit?.code) return hit.code.toUpperCase().slice(0, 4);
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase() || "??";
}

function newestPerCarrier<T extends { carrier: string; origin: string; destination: string; createdAt?: string }>(rows: T[], o: string, d: string): T[] {
  const best = new Map<string, T>();
  for (const t of rows) {
    if (t.origin.toUpperCase() !== o || t.destination.toUpperCase() !== d) continue;
    const key = normalizeCarrierName(t.carrier);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (t.createdAt || "") > (prev.createdAt || "")) best.set(key, t);
  }
  return [...best.values()];
}

const hasAirRate = (t: AirTariff) => Object.values(t.breaks || {}).some((b) => (b?.sell ?? 0) > 0 || (b?.buy ?? 0) > 0);
const hasSeaRate = (t: SeaTariff) => (t.lclRate?.sell ?? 0) > 0 || (t.lclRate?.buy ?? 0) > 0 || Object.values(t.fclRates || {}).some((r) => (r?.sell ?? 0) > 0 || (r?.buy ?? 0) > 0);

export interface LaneInput {
  mode: "air" | "sea";
  originCode: string;
  destCode: string;
  originCountry?: string;
  destCountry?: string;
  seaMode?: string;
  airTariffs: AirTariff[];
  seaTariffs: SeaTariff[];
  contacts: DirectoryContact[];
  codes: CarrierCodeRow[];
}

export function laneChips(i: LaneInput): LaneChip[] {
  if (!i.originCode || !i.destCode) return [];
  const o = i.originCode.toUpperCase();
  const d = i.destCode.toUpperCase();
  const green: LaneChip[] =
    i.mode === "air"
      ? newestPerCarrier(i.airTariffs, o, d)
          .filter(hasAirRate)
          .map((t) => ({ code: shortCode(t.carrier, t.carrierCode, i.codes), name: t.carrier, status: "rate" as const }))
      : newestPerCarrier(i.seaTariffs.filter((t) => !i.seaMode || t.mode === i.seaMode), o, d)
          .filter(hasSeaRate)
          .map((t) => ({ code: shortCode(t.carrier, t.carrierCode, i.codes), name: t.carrier, status: "rate" as const }));

  // The foreign end of the lane decides which vendors serve it.
  const foreign = [i.originCountry, i.destCountry].filter((c): c is string => !!c && c !== "IN");
  const kinds = i.mode === "air" ? ["airline", "coloader"] : ["liner", "coloader"];
  const have = new Set(green.map((g) => normalizeCarrierName(g.name)));
  const red: LaneChip[] = [];
  for (const c of i.contacts) {
    if (c.suspended || (c.category || "").toLowerCase() === "agency") continue;
    if (!kinds.includes(vendorKind(c))) continue;
    const key = normalizeCarrierName(c.name);
    if (!key || have.has(key)) continue;
    if (!contactCountries(c, true).some((cc) => foreign.includes(cc))) continue;
    have.add(key);
    red.push({ code: shortCode(c.name, undefined, i.codes), name: c.name, status: "none" });
  }
  green.sort((a, b) => a.code.localeCompare(b.code));
  red.sort((a, b) => a.code.localeCompare(b.code));
  return [...green, ...red];
}
