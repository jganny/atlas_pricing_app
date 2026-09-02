export const SLA_HOURS_GREEN = 4;
export const SLA_HOURS_AMBER = 8;

export function hoursSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

export function isOpenQuoteStatus(status: string | undefined): boolean {
  return !status || status === "new" || status === "quoted";
}
