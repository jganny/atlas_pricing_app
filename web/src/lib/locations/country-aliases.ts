/** ISO2 codes we price / display on Courier (and infer from city names). */
export const COURIER_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "BH", name: "Bahrain" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "CH", name: "Switzerland" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "LK", name: "Sri Lanka" },
  { code: "BD", name: "Bangladesh" },
  { code: "NP", name: "Nepal" },
  { code: "PK", name: "Pakistan" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

const COUNTRY_BY_NAME: Record<string, string> = Object.fromEntries(
  COURIER_COUNTRIES.flatMap((c) => [
    [c.name.toLowerCase(), c.code],
    [c.code.toLowerCase(), c.code],
  ]),
);

/** Common city / country aliases so typing "bahrain" never stays on IN. */
const PLACE_ALIASES: Record<string, string> = {
  ...COUNTRY_BY_NAME,
  bahrain: "BH",
  manama: "BH",
  muharraq: "BH",
  riffa: "BH",
  bangalore: "IN",
  bengaluru: "IN",
  bengalooru: "IN",
  mumbai: "IN",
  bombay: "IN",
  delhi: "IN",
  "new delhi": "IN",
  chennai: "IN",
  madras: "IN",
  hyderabad: "IN",
  kolkata: "IN",
  calcutta: "IN",
  pune: "IN",
  ahmedabad: "IN",
  surat: "IN",
  jaipur: "IN",
  kochi: "IN",
  cochin: "IN",
  dubai: "AE",
  "abu dhabi": "AE",
  sharjah: "AE",
  ajman: "AE",
  doha: "QA",
  "kuwait city": "KW",
  kuwait: "KW",
  muscat: "OM",
  riyadh: "SA",
  jeddah: "SA",
  dammam: "SA",
  london: "GB",
  manchester: "GB",
  birmingham: "GB",
  paris: "FR",
  frankfurt: "DE",
  hamburg: "DE",
  munich: "DE",
  berlin: "DE",
  amsterdam: "NL",
  rotterdam: "NL",
  antwerp: "BE",
  brussels: "BE",
  singapore: "SG",
  "hong kong": "HK",
  shanghai: "CN",
  beijing: "CN",
  shenzhen: "CN",
  tokyo: "JP",
  osaka: "JP",
  seoul: "KR",
  sydney: "AU",
  melbourne: "AU",
  "new york": "US",
  "los angeles": "US",
  chicago: "US",
  houston: "US",
  miami: "US",
  toronto: "CA",
  colombo: "LK",
  dhaka: "BD",
  kathmandu: "NP",
  karachi: "PK",
  "kuala lumpur": "MY",
  bangkok: "TH",
  jakarta: "ID",
  manila: "PH",
};

/**
 * Infer ISO2 from a city, country name, or PIN label.
 * Returns null when unknown (do not overwrite a user-set country).
 */
export function inferCountryFromText(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (text.length < 2) return null;

  const iso = text.match(/\b([a-z]{2})\b/g);
  if (text.length === 2 && PLACE_ALIASES[text]) return PLACE_ALIASES[text];

  if (PLACE_ALIASES[text]) return PLACE_ALIASES[text];

  // "bangalore → bahrain" chips / "Manama, Bahrain" postal labels
  const parts = text.split(/[^a-z]+/).filter((p) => p.length >= 2);
  for (let i = parts.length - 1; i >= 0; i--) {
    const hit = PLACE_ALIASES[parts[i]];
    if (hit) return hit;
  }

  for (const [alias, code] of Object.entries(PLACE_ALIASES)) {
    if (alias.length >= 4 && text.includes(alias)) return code;
  }

  if (iso) {
    for (const token of iso) {
      const code = token.toUpperCase();
      if (COURIER_COUNTRIES.some((c) => c.code === code)) return code;
    }
  }
  return null;
}

export function countrySelectOptions(extra: string[] = []): Array<{ code: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ code: string; name: string }> = [];
  for (const row of [...COURIER_COUNTRIES, ...extra.filter(Boolean).map((code) => ({ code, name: code }))]) {
    const code = row.code.toUpperCase().slice(0, 2);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      name: COURIER_COUNTRIES.find((c) => c.code === code)?.name ?? row.name,
    });
  }
  return out;
}
