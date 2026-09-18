"use client";

import { useState } from "react";
import { Briefcase } from "lucide-react";
import { Tabs } from "@/components/ui";
import { PipelineView } from "@/components/sales/PipelineView";
import { AccountsView } from "@/components/sales/AccountsView";
import { ForecastView } from "@/components/sales/ForecastView";
import { GuideTipButton } from "@/components/GuideTipButton";

type SalesTab = "pipeline" | "accounts" | "forecast";

export default function SalesPage() {
  const [tab, setTab] = useState<SalesTab>("pipeline");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-[var(--color-atlas-sky)]" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Sales</h1>
        </div>
        <GuideTipButton label="Tips" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SalesTab)}
        idPrefix="sales-tab"
        items={[
          { value: "pipeline", label: "Pipeline" },
          { value: "accounts", label: "Accounts" },
          { value: "forecast", label: "Forecast" },
        ]}
      />

      {tab === "pipeline" ? <PipelineView /> : tab === "accounts" ? <AccountsView /> : <ForecastView />}
    </div>
  );
}
