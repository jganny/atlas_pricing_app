"use client";

import { useQuery } from "@tanstack/react-query";
import { getAiUsageSummary } from "@/lib/firebase/ai-usage";
import { listChatStaff } from "@/lib/firebase/chat-staff";
import { fetchClientErrors } from "@/lib/firebase/client-errors";
import { groupErrors, withinHours } from "@/lib/monitoring/error-groups";
import type { AdminContext } from "@/lib/admin/sections";
import type { AdminSignals } from "@/lib/admin/signals";

/**
 * The few live numbers the Admin console shows up front. Each lookup runs only for people who may open that section,
 * and shares its cache with the section itself, so opening the section later does not fetch twice.
 * undefined = still loading, null = not available (the tile is simply left out).
 */
export function useAdminSignals(ctx: AdminContext, resets: AdminSignals["resets"]): AdminSignals {
  const ai = useQuery({ queryKey: ["adminAiSummary"], queryFn: getAiUsageSummary, enabled: ctx.isGanny && ctx.live, staleTime: 60_000, retry: 0 });
  const errs = useQuery({ queryKey: ["clientErrors"], queryFn: () => fetchClientErrors(400), enabled: ctx.isAdmin, staleTime: 30_000, retry: 0 });
  const staff = useQuery({ queryKey: ["chatStaffList"], queryFn: listChatStaff, enabled: ctx.isGanny && ctx.live, staleTime: 60_000, retry: 0 });

  return {
    ai: ai.isError ? null : ai.data,
    resets,
    errors: errs.isError
      ? null
      : errs.data
        ? { week: groupErrors(withinHours(errs.data, 168)).length, day: withinHours(errs.data, 24).length }
        : undefined,
    staff: staff.isError
      ? null
      : staff.data
        ? (() => {
            const active = staff.data.filter((r) => r.state !== "off");
            return { joined: active.filter((r) => r.state === "joined").length, invited: active.filter((r) => r.state === "invited").length, total: active.length };
          })()
        : undefined,
  };
}
