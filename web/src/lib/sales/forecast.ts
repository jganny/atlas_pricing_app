import type { LeadStatus, SalesLead } from "@/lib/types";

/** Default win probability per stage, used when a lead has no per-lead override. */
export const STAGE_PROBABILITY: Record<LeadStatus, number> = {
  new: 10,
  contacted: 25,
  qualified: 50,
  quoted: 70,
  won: 100,
  lost: 0,
};

export const OPEN_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "quoted"];

export function isOpenLead(lead: SalesLead): boolean {
  return lead.status !== "won" && lead.status !== "lost";
}

/** Per-lead override (clamped 0-100) wins over the stage default. */
export function effectiveProbability(lead: SalesLead): number {
  if (typeof lead.probability === "number" && Number.isFinite(lead.probability)) {
    return Math.min(100, Math.max(0, lead.probability));
  }
  return STAGE_PROBABILITY[lead.status] ?? 0;
}

export function weightedForecastValue(lead: SalesLead): number {
  return ((lead.dealValue || 0) * effectiveProbability(lead)) / 100;
}

export function weightedPipelineTotal(leads: SalesLead[]): number {
  return leads.filter(isOpenLead).reduce((sum, l) => sum + weightedForecastValue(l), 0);
}

export interface ForecastBucket {
  key: string;
  count: number;
  total: number;
  weighted: number;
}

function addTo(bucket: ForecastBucket, lead: SalesLead) {
  bucket.count += 1;
  bucket.total += lead.dealValue || 0;
  bucket.weighted += weightedForecastValue(lead);
}

export function forecastByStage(leads: SalesLead[]): ForecastBucket[] {
  return OPEN_STAGES.map((stage) => {
    const bucket: ForecastBucket = { key: stage, count: 0, total: 0, weighted: 0 };
    for (const lead of leads) if (lead.status === stage) addTo(bucket, lead);
    return bucket;
  });
}

export const UNSCHEDULED = "unscheduled";

/** Open leads bucketed by expectedCloseDate month (YYYY-MM); undated ones land in "unscheduled", last. */
export function forecastByMonth(leads: SalesLead[]): ForecastBucket[] {
  const buckets = new Map<string, ForecastBucket>();
  for (const lead of leads.filter(isOpenLead)) {
    const month = /^\d{4}-\d{2}/.test(lead.expectedCloseDate || "")
      ? (lead.expectedCloseDate as string).slice(0, 7)
      : UNSCHEDULED;
    let bucket = buckets.get(month);
    if (!bucket) {
      bucket = { key: month, count: 0, total: 0, weighted: 0 };
      buckets.set(month, bucket);
    }
    addTo(bucket, lead);
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.key === UNSCHEDULED) return 1;
    if (b.key === UNSCHEDULED) return -1;
    return a.key.localeCompare(b.key);
  });
}
