import { ALL_CURRENCIES } from "@/lib/desk/currencies";

/** Shared desk currency list: every currency in the world (the common ones first). USD / EUR / GBP / INR stay the usual starting points. */
export const DESK_CURRENCIES: readonly string[] = ALL_CURRENCIES;
export type DeskCurrency = string;

export const INDIA_VEHICLE_TYPES = [
  "Tata Ace / Chota Hathi",
  "Pickup 1 ton",
  "Tata 407 (2.5 ton)",
  "Eicher 14 ft",
  "Eicher 17 ft",
  "Eicher 19 ft",
  "20 ft container truck",
  "32 ft SXL",
  "32 ft MXL",
  "40 ft trailer",
  "Trailer (low-bed)",
  "Tempo traveller cargo",
  "LCV open",
  "HCV open",
  "Refrigerated truck",
  "Box truck / closed body",
  "Curtain sider",
  "Tank / tanker",
  "Flatbed",
  "Car carrier",
] as const;

export const TRANSPORT_SERVICE_TYPES = [
  "FTL (Full truck load)",
  "LTL / PTL (Part load)",
  "Container trucking",
  "First mile / last mile",
  "Cross-border road",
  "Over-dimensional cargo (ODC)",
  "Reefer / temperature controlled",
] as const;

export const WAREHOUSE_LOCATIONS = [
  "JNPT CFS",
  "Nhava Sheva ICD",
  "Mundra CFS",
  "Pipavav CFS",
  "Chennai CFS",
  "Ennore ICD",
  "Tuticorin CFS",
  "Kolkatta / Haldia CFS",
  "Delhi / Tughlakabad ICD",
  "Dadri ICD",
  "Bangalore ICD",
  "Hyderabad ICD",
  "Ahmedabad ICD",
  "Bonded warehouse — customer nominated",
  "Others",
] as const;
