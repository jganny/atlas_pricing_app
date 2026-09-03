export const DEFAULT_AIR_TERMS =
  "1. The above rates are NET NET\n" +
  "2. Rates quoted are valid for General/ Non Haz/ Non Stackable, unless specified.\n" +
  "3. Quoted rates are subject to space and booking confirmation.\n" +
  "4. Transit Times are subject to the Service chosen.\n" +
  "5. Any incidental or statutory charges, if any, would be applicable at the time of shipment, at actuals.";

export const DEFAULT_SEA_TERMS =
  "1. The Above rates are NET NET\n" +
  "2. Rates are subject to Surcharges, if applicable at the time of shipment.\n" +
  "3. Rates are valid for Non Haz, Non Temp, Non Stackable, General cargo only.\n" +
  "4. Any incidental or statutory charges, if any, would be applicable at the time of shipment, at actuals.\n" +
  "5. Rates are subject to space, booking and onward confirmation.";

export function getDefaultFreightTerms(mode: "air" | "sea"): string {
  return mode === "sea" ? DEFAULT_SEA_TERMS : DEFAULT_AIR_TERMS;
}
