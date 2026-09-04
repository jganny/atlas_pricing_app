"use client";

import { Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";

export default function HrPage() {
  const members = Object.entries(TEAM_ROLES).filter(([, r]) => r.type === "member");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">HR / roster</h1>
        <Badge tone="info">Phase 13</Badge>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Desk roster from TEAM_ROLES — full HR module (leave, payroll) stays future scope.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(([id, role]) => (
          <Card key={id}>
            <div className="font-bold text-[var(--color-atlas-navy)]">{role.name}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{id}</div>
            <div className="mt-2 text-sm">{role.category || "General"}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
