export interface LossReasonOption {
  code: string;
  label: string;
}

export const LOSS_REASON_CODES: LossReasonOption[] = [
  { code: "price", label: "Price — lost on rate" },
  { code: "timing", label: "Timing / no budget right now" },
  { code: "competitor", label: "Went with a competitor" },
  { code: "went_silent", label: "Prospect went silent" },
  { code: "lane_not_served", label: "Lane / service not offered" },
  { code: "other", label: "Other" },
];

export function lossReasonLabel(code?: string): string {
  return LOSS_REASON_CODES.find((r) => r.code === code)?.label || code || "";
}
