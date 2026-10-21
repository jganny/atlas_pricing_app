/**
 * Atlas branches / origin stations, and which airport and seaport codes belong to each.
 * Used to label every circular with the station it is for, and to filter circulars and tariffs by station.
 */
export interface Station {
  /** Branch name, spelt as in the customs-holiday branch list. */
  name: string;
  /** Short code shown on labels. */
  code: string;
  air: string[];
  sea: string[];
}

export const STATIONS: Station[] = [
  { name: "Ahmedabad", code: "AMD", air: ["AMD"], sea: ["INAMD"] },
  { name: "Bangalore", code: "BLR", air: ["BLR"], sea: ["INBLR", "INWFD"] },
  { name: "Bhubaneshwar", code: "BBI", air: ["BBI"], sea: ["INBBI", "INPBD"] },
  { name: "Calicut", code: "CCJ", air: ["CCJ"], sea: ["INCCJ", "INBEY"] },
  { name: "Chennai", code: "MAA", air: ["MAA"], sea: ["INMAA", "INENR", "INKAT"] },
  { name: "Cochin", code: "COK", air: ["COK"], sea: ["INCOK", "INVLC"] },
  { name: "Delhi", code: "DEL", air: ["DEL"], sea: ["INDEL", "INTKD", "INPPG", "INICD"] },
  { name: "Goa", code: "GOI", air: ["GOI", "GOX"], sea: ["INMRM", "INGOI"] },
  { name: "Hyderabad", code: "HYD", air: ["HYD"], sea: ["INHYD"] },
  { name: "Kandla", code: "IXY", air: ["IXY", "BHJ"], sea: ["INIXY", "INMUN", "INKDL"] },
  { name: "Kannur", code: "CNN", air: ["CNN"], sea: ["INCNN"] },
  { name: "Kolkatta", code: "CCU", air: ["CCU"], sea: ["INCCU", "INHAL"] },
  { name: "Mumbai", code: "BOM", air: ["BOM"], sea: ["INBOM", "INNSA", "INNHV", "INMUM"] },
  { name: "Nagpur", code: "NAG", air: ["NAG"], sea: ["INNAG"] },
  { name: "Pune", code: "PNQ", air: ["PNQ"], sea: ["INPNQ"] },
  { name: "Trivandrum", code: "TRV", air: ["TRV"], sea: ["INTRV"] },
  { name: "Tuticorin", code: "TUT", air: ["TCR"], sea: ["INTUT"] },
  { name: "Vishakapatnam", code: "VTZ", air: ["VTZ"], sea: ["INVTZ"] },
];

const byName = new Map(STATIONS.map((s) => [s.name.toLowerCase(), s]));
const byCode = new Map<string, Station>();
for (const s of STATIONS) {
  byCode.set(s.code, s);
  s.air.forEach((c) => byCode.set(c, s));
  s.sea.forEach((c) => byCode.set(c, s));
}

export const STATION_NAMES: string[] = STATIONS.map((s) => s.name);

export function stationByName(name: string | undefined | null): Station | undefined {
  return byName.get((name || "").trim().toLowerCase());
}

/** "Bangalore (BLR)" — the label shown on a circular. */
export function stationLabel(name: string | undefined | null): string {
  const s = stationByName(name);
  return s ? `${s.name} (${s.code})` : (name || "").trim();
}

/** The station an origin code belongs to — an airport ("BLR") or a seaport ("INMAA - Chennai") — or undefined. */
export function stationForOrigin(origin: string | undefined | null): Station | undefined {
  const code = (origin || "").trim().split(/\s+-\s+|\s+/)[0].toUpperCase();
  return byCode.get(code);
}
