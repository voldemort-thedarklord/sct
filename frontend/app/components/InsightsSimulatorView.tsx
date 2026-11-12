"use client";

import React from "react";
import { CommunityZone } from "../types";
import AiPredictionView from "./AiPredictionView";
import ReportsAnalyticsView from "./ReportsAnalyticsView";

export type InsightsTab = "simulator" | "trends";

interface InsightsSimulatorViewProps {
  zones: CommunityZone[];
  initialZone?: CommunityZone | null;
  tab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
  token: string;
  onRefreshDashboard: () => void;
}

/**
 * Combined analytical workspace pairing the What-If Outbreak Simulator
 * with multi-location comparison tables and CSV exports.
 */
export default function InsightsSimulatorView({
  zones,
  initialZone,
  tab,
  onTabChange,
  token,
  onRefreshDashboard,
}: InsightsSimulatorViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Insights &amp; Risk Simulator
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Test &ldquo;what-if&rdquo; water scenarios, review 7-day forecasts, and export location comparison reports.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
          <button
            type="button"
            onClick={() => onTabChange("simulator")}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition ${
              tab === "simulator"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            What-If Simulator
          </button>
          <button
            type="button"
            onClick={() => onTabChange("trends")}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition ${
              tab === "trends"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            Trends &amp; CSV Export
          </button>
        </div>
      </div>

      {tab === "simulator" ? (
        <AiPredictionView
          key={initialZone?.id ?? "default"}
          zones={zones}
          initialZone={initialZone}
          token={token}
          onRefreshDashboard={onRefreshDashboard}
          embedded={true}
        />
      ) : (
        <ReportsAnalyticsView token={token} embedded={true} />
      )}
    </div>
  );
}
