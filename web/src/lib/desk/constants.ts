/** Shared desk currency list — USD / EUR / GBP / INR default everywhere. */
export const DESK_CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
export type DeskCurrency = (typeof DESK_CURRENCIES)[number];

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
