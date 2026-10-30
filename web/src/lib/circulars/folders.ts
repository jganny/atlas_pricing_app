/**
 * Circulars as folders: station › airline / liner / courier › carrier › its files.
 * A carrier's tariff and its fuel-surcharge (FSC) or line circulars sit together in that carrier's folder,
 * so nobody has to search one place for the tariff and another for the circular.
 */
import type { CircularRecord } from "@/lib/types";
import { STATION_NAMES, stationByName, stationLabel } from "./stations";

export type FolderKind = "airline" | "liner" | "courier" | "general";
export type FileRole = "tariff" | "fsc" | "circular" | "general";

export const KIND_ORDER: FolderKind[] = ["airline", "liner", "courier", "general"];
export const KIND_LABEL: Record<FolderKind, string> = {
  airline: "Airline tariffs",
  liner: "Liner tariffs",
  courier: "Courier tariffs",
  general: "Other circulars",
};
export const ROLE_LABEL: Record<FileRole, string> = { tariff: "Tariff", fsc: "FSC", circular: "Circular", general: "General" };

export function kindOf(category: string | undefined): FolderKind {
  switch (category) {
    case "airline_tariff":
    case "fuel_circular_airline":
      return "airline";
    case "sea_tariff":
    case "line_circular":
    case "fuel_circular_shipping":
      return "liner";
    case "courier_tariff":
      return "courier";
    default:
      return "general";
  }
}

export function roleOf(category: string | undefined): FileRole {
  switch (category) {
    case "airline_tariff":
    case "sea_tariff":
    case "courier_tariff":
      return "tariff";
    case "fuel_circular_airline":
    case "fuel_circular_shipping":
      return "fsc";
    case "line_circular":
      return "circular";
    default:
      return "general";
  }
}

const ROLE_RANK: Record<FileRole, number> = { tariff: 0, fsc: 1, circular: 2, general: 3 };

export interface CarrierFolder {
  key: string;
  label: string;
  files: CircularRecord[];
  hasTariff: boolean;
  hasFsc: boolean;
}
export interface KindGroup {
  kind: FolderKind;
  label: string;
  carriers: CarrierFolder[];
  fileCount: number;
}
export interface StationGroup {
  /** The station's name, or null for circulars with no station yet. */
  station: string | null;
  label: string;
  kinds: KindGroup[];
  fileCount: number;
}

const carrierKey = (name: string | undefined) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const when = (c: CircularRecord) => Date.parse(c.effectiveDate || c.createdAt || "") || 0;

export function buildFolders(circulars: CircularRecord[]): StationGroup[] {
  const byStation = new Map<string | null, Map<FolderKind, Map<string, CarrierFolder>>>();
  for (const c of circulars) {
    const st = stationByName(c.station)?.name ?? null;
    const kind = kindOf(c.category);
    const key = carrierKey(c.carrier) || "—";
    const kinds = byStation.get(st) ?? new Map<FolderKind, Map<string, CarrierFolder>>();
    const carriers = kinds.get(kind) ?? new Map<string, CarrierFolder>();
    const folder = carriers.get(key) ?? { key, label: String(c.carrier ?? "").trim() || "No carrier set", files: [], hasTariff: false, hasFsc: false };
    folder.files.push(c);
    const role = roleOf(c.category);
    if (role === "tariff") folder.hasTariff = true;
    if (role === "fsc") folder.hasFsc = true;
    carriers.set(key, folder);
    kinds.set(kind, carriers);
    byStation.set(st, kinds);
  }
  const order: (string | null)[] = [...STATION_NAMES, null];
  return order
    .filter((st) => byStation.has(st))
    .map((st) => {
      const kindMap = byStation.get(st)!;
      const kinds: KindGroup[] = KIND_ORDER.filter((k) => kindMap.has(k)).map((kind) => {
        const carriers = [...kindMap.get(kind)!.values()]
          .map((f) => ({ ...f, files: [...f.files].sort((a, b) => ROLE_RANK[roleOf(a.category)] - ROLE_RANK[roleOf(b.category)] || when(b) - when(a)) }))
          .sort((a, b) => (a.key === "—" ? 1 : b.key === "—" ? -1 : a.label.localeCompare(b.label)));
        return { kind, label: KIND_LABEL[kind], carriers, fileCount: carriers.reduce((n, f) => n + f.files.length, 0) };
      });
      return { station: st, label: st ? stationLabel(st) : "Station not set", kinds, fileCount: kinds.reduce((n, k) => n + k.fileCount, 0) };
    });
}
