/**
 * Suggest the station a circular belongs to, from the airport or seaport code in its title or file name
 * ("EK_BLR", "TG_BLR Rate Sheet", "BOM ET Rates eff 05 Aug"). Only a single, clear code gives a suggestion:
 * no code, or codes pointing to two different stations, are left for a person to decide.
 */
import type { CircularRecord } from "@/lib/types";
import { stationByName, stationForOrigin, type Station } from "./stations";

export interface StationSuggestion {
  circularId: string;
  station: Station;
  /** The code found, e.g. "BLR". */
  code: string;
  /** Where it was found. */
  from: "title" | "file name";
}

function stationsIn(text: string | undefined): Array<{ code: string; station: Station }> {
  const found: Array<{ code: string; station: Station }> = [];
  for (const token of String(text ?? "").split(/[^A-Za-z0-9]+/)) {
    if (token.length !== 3 && token.length !== 5) continue;
    if (token !== token.toUpperCase()) continue; // "Rate", "sheet" are words, not codes
    const station = stationForOrigin(token);
    if (station) found.push({ code: token, station });
  }
  return found;
}

export function suggestStation(c: Pick<CircularRecord, "id" | "title" | "fileName" | "station">): StationSuggestion | null {
  if (stationByName(c.station)) return null; // already set
  for (const [text, from] of [[c.title, "title"], [c.fileName, "file name"]] as const) {
    const hits = stationsIn(text);
    if (!hits.length) continue;
    if (new Set(hits.map((h) => h.station.name)).size > 1) return null; // two stations in one title: not clear
    return { circularId: c.id, station: hits[0].station, code: hits[0].code, from };
  }
  return null;
}

export function suggestStations(circulars: Array<Pick<CircularRecord, "id" | "title" | "fileName" | "station">>): StationSuggestion[] {
  return circulars.map(suggestStation).filter((s): s is StationSuggestion => s !== null);
}
