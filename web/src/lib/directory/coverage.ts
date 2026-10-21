/**
 * Which countries a Directory contact serves, and which country a place is in.
 * Used to choose who receives a rate request. Countries are kept as two-letter codes (ISO 3166).
 */
import type { DirectoryContact } from "@/lib/types";

export interface Country {
  code: string;
  name: string;
  aliases: string[];
}

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", aliases: [] },
  { code: "AL", name: "Albania", aliases: [] },
  { code: "DZ", name: "Algeria", aliases: [] },
  { code: "AO", name: "Angola", aliases: [] },
  { code: "AR", name: "Argentina", aliases: [] },
  { code: "AM", name: "Armenia", aliases: [] },
  { code: "AU", name: "Australia", aliases: [] },
  { code: "AT", name: "Austria", aliases: [] },
  { code: "AZ", name: "Azerbaijan", aliases: [] },
  { code: "BH", name: "Bahrain", aliases: [] },
  { code: "BD", name: "Bangladesh", aliases: [] },
  { code: "BY", name: "Belarus", aliases: [] },
  { code: "BE", name: "Belgium", aliases: [] },
  { code: "BJ", name: "Benin", aliases: [] },
  { code: "BT", name: "Bhutan", aliases: [] },
  { code: "BO", name: "Bolivia", aliases: [] },
  { code: "BA", name: "Bosnia and Herzegovina", aliases: [] },
  { code: "BW", name: "Botswana", aliases: [] },
  { code: "BR", name: "Brazil", aliases: [] },
  { code: "BN", name: "Brunei", aliases: [] },
  { code: "BG", name: "Bulgaria", aliases: [] },
  { code: "KH", name: "Cambodia", aliases: [] },
  { code: "CM", name: "Cameroon", aliases: [] },
  { code: "CA", name: "Canada", aliases: [] },
  { code: "CL", name: "Chile", aliases: [] },
  { code: "CN", name: "China", aliases: ["shanghai", "beijing", "shenzhen", "guangzhou"] },
  { code: "CO", name: "Colombia", aliases: [] },
  { code: "CD", name: "Congo (DRC)", aliases: ["drc", "dr congo", "democratic republic of congo"] },
  { code: "CG", name: "Congo", aliases: [] },
  { code: "CR", name: "Costa Rica", aliases: [] },
  { code: "CI", name: "Ivory Coast", aliases: ["cote d'ivoire", "c\u00f4te d'ivoire"] },
  { code: "HR", name: "Croatia", aliases: [] },
  { code: "CU", name: "Cuba", aliases: [] },
  { code: "CY", name: "Cyprus", aliases: [] },
  { code: "CZ", name: "Czech Republic", aliases: ["czechia"] },
  { code: "DK", name: "Denmark", aliases: [] },
  { code: "DJ", name: "Djibouti", aliases: [] },
  { code: "DO", name: "Dominican Republic", aliases: [] },
  { code: "EC", name: "Ecuador", aliases: [] },
  { code: "EG", name: "Egypt", aliases: [] },
  { code: "SV", name: "El Salvador", aliases: [] },
  { code: "ER", name: "Eritrea", aliases: [] },
  { code: "EE", name: "Estonia", aliases: [] },
  { code: "ET", name: "Ethiopia", aliases: [] },
  { code: "FJ", name: "Fiji", aliases: [] },
  { code: "FI", name: "Finland", aliases: [] },
  { code: "FR", name: "France", aliases: [] },
  { code: "GA", name: "Gabon", aliases: [] },
  { code: "GE", name: "Georgia", aliases: [] },
  { code: "DE", name: "Germany", aliases: [] },
  { code: "GH", name: "Ghana", aliases: [] },
  { code: "GR", name: "Greece", aliases: [] },
  { code: "GT", name: "Guatemala", aliases: [] },
  { code: "GN", name: "Guinea", aliases: [] },
  { code: "HT", name: "Haiti", aliases: [] },
  { code: "HN", name: "Honduras", aliases: [] },
  { code: "HK", name: "Hong Kong", aliases: ["hongkong"] },
  { code: "HU", name: "Hungary", aliases: [] },
  { code: "IS", name: "Iceland", aliases: [] },
  { code: "IN", name: "India", aliases: ["mumbai", "delhi", "chennai", "bangalore", "bengaluru"] },
  { code: "ID", name: "Indonesia", aliases: [] },
  { code: "IR", name: "Iran", aliases: ["persia"] },
  { code: "IQ", name: "Iraq", aliases: [] },
  { code: "IE", name: "Ireland", aliases: [] },
  { code: "IL", name: "Israel", aliases: [] },
  { code: "IT", name: "Italy", aliases: [] },
  { code: "JM", name: "Jamaica", aliases: [] },
  { code: "JP", name: "Japan", aliases: [] },
  { code: "JO", name: "Jordan", aliases: [] },
  { code: "KZ", name: "Kazakhstan", aliases: [] },
  { code: "KE", name: "Kenya", aliases: [] },
  { code: "KW", name: "Kuwait", aliases: [] },
  { code: "KG", name: "Kyrgyzstan", aliases: [] },
  { code: "LA", name: "Laos", aliases: [] },
  { code: "LV", name: "Latvia", aliases: [] },
  { code: "LB", name: "Lebanon", aliases: ["beirut"] },
  { code: "LR", name: "Liberia", aliases: [] },
  { code: "LY", name: "Libya", aliases: [] },
  { code: "LT", name: "Lithuania", aliases: [] },
  { code: "LU", name: "Luxembourg", aliases: [] },
  { code: "MO", name: "Macau", aliases: [] },
  { code: "MG", name: "Madagascar", aliases: [] },
  { code: "MW", name: "Malawi", aliases: [] },
  { code: "MY", name: "Malaysia", aliases: [] },
  { code: "MV", name: "Maldives", aliases: [] },
  { code: "ML", name: "Mali", aliases: [] },
  { code: "MT", name: "Malta", aliases: [] },
  { code: "MU", name: "Mauritius", aliases: [] },
  { code: "MX", name: "Mexico", aliases: [] },
  { code: "MD", name: "Moldova", aliases: [] },
  { code: "MN", name: "Mongolia", aliases: [] },
  { code: "ME", name: "Montenegro", aliases: [] },
  { code: "MA", name: "Morocco", aliases: [] },
  { code: "MZ", name: "Mozambique", aliases: [] },
  { code: "MM", name: "Myanmar", aliases: ["burma"] },
  { code: "NA", name: "Namibia", aliases: [] },
  { code: "NP", name: "Nepal", aliases: [] },
  { code: "NL", name: "Netherlands", aliases: [] },
  { code: "NZ", name: "New Zealand", aliases: [] },
  { code: "NI", name: "Nicaragua", aliases: [] },
  { code: "NE", name: "Niger", aliases: [] },
  { code: "NG", name: "Nigeria", aliases: [] },
  { code: "MK", name: "North Macedonia", aliases: [] },
  { code: "NO", name: "Norway", aliases: [] },
  { code: "OM", name: "Oman", aliases: [] },
  { code: "PK", name: "Pakistan", aliases: [] },
  { code: "PS", name: "Palestine", aliases: [] },
  { code: "PA", name: "Panama", aliases: [] },
  { code: "PG", name: "Papua New Guinea", aliases: [] },
  { code: "PY", name: "Paraguay", aliases: [] },
  { code: "PE", name: "Peru", aliases: [] },
  { code: "PH", name: "Philippines", aliases: [] },
  { code: "PL", name: "Poland", aliases: [] },
  { code: "PT", name: "Portugal", aliases: [] },
  { code: "QA", name: "Qatar", aliases: [] },
  { code: "RO", name: "Romania", aliases: [] },
  { code: "RU", name: "Russia", aliases: ["russian federation"] },
  { code: "RW", name: "Rwanda", aliases: [] },
  { code: "SA", name: "Saudi Arabia", aliases: ["ksa", "riyadh", "jeddah", "dammam"] },
  { code: "SN", name: "Senegal", aliases: [] },
  { code: "RS", name: "Serbia", aliases: [] },
  { code: "SG", name: "Singapore", aliases: ["singapore"] },
  { code: "SK", name: "Slovakia", aliases: [] },
  { code: "SI", name: "Slovenia", aliases: [] },
  { code: "SO", name: "Somalia", aliases: [] },
  { code: "ZA", name: "South Africa", aliases: [] },
  { code: "KR", name: "South Korea", aliases: ["korea", "republic of korea", "seoul"] },
  { code: "SS", name: "South Sudan", aliases: [] },
  { code: "ES", name: "Spain", aliases: [] },
  { code: "LK", name: "Sri Lanka", aliases: [] },
  { code: "SD", name: "Sudan", aliases: [] },
  { code: "SE", name: "Sweden", aliases: [] },
  { code: "CH", name: "Switzerland", aliases: [] },
  { code: "SY", name: "Syria", aliases: ["syrian"] },
  { code: "TW", name: "Taiwan", aliases: [] },
  { code: "TJ", name: "Tajikistan", aliases: [] },
  { code: "TZ", name: "Tanzania", aliases: [] },
  { code: "TH", name: "Thailand", aliases: [] },
  { code: "TG", name: "Togo", aliases: [] },
  { code: "TT", name: "Trinidad and Tobago", aliases: [] },
  { code: "TN", name: "Tunisia", aliases: [] },
  { code: "TR", name: "Turkey", aliases: ["turkiye", "t\u00fcrkiye"] },
  { code: "TM", name: "Turkmenistan", aliases: [] },
  { code: "UG", name: "Uganda", aliases: [] },
  { code: "UA", name: "Ukraine", aliases: [] },
  { code: "AE", name: "United Arab Emirates", aliases: ["uae", "dubai", "abu dhabi", "sharjah", "jebel ali"] },
  { code: "GB", name: "United Kingdom", aliases: ["uk", "england", "great britain", "london", "scotland", "britain"] },
  { code: "US", name: "United States", aliases: ["usa", "u.s.a", "america", "united states of america", "new york", "los angeles", "chicago"] },
  { code: "UY", name: "Uruguay", aliases: [] },
  { code: "UZ", name: "Uzbekistan", aliases: [] },
  { code: "VE", name: "Venezuela", aliases: [] },
  { code: "VN", name: "Vietnam", aliases: ["viet nam"] },
  { code: "YE", name: "Yemen", aliases: [] },
  { code: "ZM", name: "Zambia", aliases: [] },
  { code: "ZW", name: "Zimbabwe", aliases: [] },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const norm = (s: string) => s.toLowerCase().replace(/[.,()]/g, " ").replace(/\s+/g, " ").trim();

// Longest names first, so "south korea" is matched before "korea" and "south sudan" before "sudan".
const NAME_INDEX: Array<{ key: string; code: string }> = COUNTRIES.flatMap((c) => [norm(c.name), ...c.aliases.map(norm)].map((key) => ({ key, code: c.code }))).sort(
  (a, b) => b.key.length - a.key.length,
);

export function countryName(code: string): string {
  return BY_CODE.get(code.toUpperCase())?.name ?? code;
}

/** Every country named in a piece of free text ("Dubai, UAE", "Germany / Netherlands"). */
export function countryCodesIn(text: string | undefined | null): string[] {
  const t = ` ${norm(text || "")} `;
  if (t.trim().length < 2) return [];
  const found: string[] = [];
  let rest = t;
  for (const { key, code } of NAME_INDEX) {
    if (key.length < 3) continue;
    const needle = ` ${key} `;
    if (rest.includes(needle)) {
      if (!found.includes(code)) found.push(code);
      rest = rest.split(needle).join(" ");
    }
  }
  // A bare two-letter code on its own ("IN", "AE") counts too.
  for (const tok of (text || "").split(/[^A-Za-z]+/)) {
    if (tok.length === 2 && tok === tok.toUpperCase() && BY_CODE.has(tok) && !found.includes(tok)) found.push(tok);
  }
  return found;
}

/** Normalises what a person typed under "countries served" (names, codes or a mix) to codes. */
export function parseCoverage(text: string | undefined | null): string[] {
  const out: string[] = [];
  for (const piece of (text || "").split(/[;,\n]+/)) {
    const hit = countryCodesIn(piece)[0] ?? (BY_CODE.has(piece.trim().toUpperCase()) ? piece.trim().toUpperCase() : "");
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export function coverageLabel(codes: string[] | undefined): string {
  return (codes || []).map(countryName).join(", ");
}

export type VendorKind = "airline" | "liner" | "coloader" | "transporter" | "other";

function kindOf(text: string): VendorKind {
  const g = text.toLowerCase();
  if (/co-?load|consol|nvo|lcl/.test(g)) return "coloader";
  if (/airline|air line|\bair\b|cargo airline/.test(g)) return "airline";
  if (/liner|shipping|ocean|sea|vessel|\bfcl\b/.test(g)) return "liner";
  if (/transport|truck|haul|logistic/.test(g)) return "transporter";
  return "other";
}

/**
 * What sort of vendor a contact is. The Directory group ("Shipping Lines", "Co-loaders") is what people actually
 * edit, so it decides; the category is only used when the group says nothing (the category often stays "airline"
 * on contacts whose group was changed later).
 */
export function vendorKind(c: Pick<DirectoryContact, "category" | "sheetGroup">): VendorKind {
  const fromGroup = kindOf(c.sheetGroup || "");
  return fromGroup !== "other" ? fromGroup : kindOf(c.category || "");
}

/**
 * The countries a contact serves: what was set under "Countries served" when there is something, otherwise
 * read from its location (and, for vendors, its notes). Agents are placed by their location.
 */
export function contactCountries(c: DirectoryContact, includeNotes = false): string[] {
  if (c.coverage && c.coverage.length) return c.coverage.map((x) => x.toUpperCase());
  const fromLocation = countryCodesIn(c.location);
  if (fromLocation.length || !includeNotes) return fromLocation;
  return countryCodesIn(c.notes);
}

/** The country of an airport/seaport/city chosen on a desk ("BOM - Mumbai", "AEJEA - Jebel Ali", "Beirut"). */
export function countryOfPlace(
  place: string | undefined | null,
  lookup?: { airports?: Map<string, string>; seaports?: Map<string, string> },
): string | undefined {
  const text = (place || "").trim();
  if (!text) return undefined;
  const code = text.split(/\s+-\s+|\s+/)[0].toUpperCase();
  if (/^[A-Z]{5}$/.test(code) && BY_CODE.has(code.slice(0, 2))) return code.slice(0, 2); // UN/LOCODE starts with the country
  if (/^[A-Z]{3}$/.test(code) && lookup?.airports?.has(code)) return lookup.airports.get(code);
  return countryCodesIn(text)[0];
}
