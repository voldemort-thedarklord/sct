"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertItem,
  CommunityZone,
  DashboardSummary,
  RISK_BADGE_STYLES,
  RiskLevel,
  UserRole,
  isCitizenRole,
} from "../types";

const RiskMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
      Loading community map...
    </div>
  ),
});

interface HomeDashboardViewProps {
  summary: DashboardSummary;
  zones: CommunityZone[];
  alerts: AlertItem[];
  userRole: UserRole;
  onLogWater: () => void;
  onReportSymptoms: () => void;
  onOpenAlerts: () => void;
  onSimulateZone: (zone: CommunityZone) => void;
}

/**
 * Plain-language Home & Action Center consolidating Overview and Community Map.
 * Surfaces urgent areas and active alerts first to minimize scrolling and jargon.
 */
export default function HomeDashboardView({
  summary,
  zones,
  alerts,
  userRole,
  onLogWater,
  onReportSymptoms,
  onOpenAlerts,
  onSimulateZone,
}: HomeDashboardViewProps) {
  const isCitizen = isCitizenRole(userRole);
  const urgentCount = summary.kpis.high_or_critical_zones;

  const [watchlistFilter, setWatchlistFilter] = useState<"urgent" | "all">(
    urgentCount > 0 ? "urgent" : "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMap, setExpandedMap] = useState(false);

  const visibleZones = zones
    .filter((z) => {
      if (
        watchlistFilter === "urgent" &&
        z.current_risk_level !== "High" &&
        z.current_risk_level !== "Critical"
      ) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        z.name.toLowerCase().includes(q) ||
        z.district.toLowerCase().includes(q) ||
        z.water_source_type.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.current_risk_score - a.current_risk_score);

  const statusTone =
    urgentCount > 0
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-emerald-500/30 bg-emerald-500/5";

  return (
    <div className="space-y-6">
      {/* Plain-Language Action Banner */}
      <div
        className={`flex flex-col justify-between gap-4 rounded-xl border p-6 sm:flex-row sm:items-center ${statusTone}`}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <span
              className={`h-2 w-2 rounded-full ${
                urgentCount > 0 ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {urgentCount > 0
              ? `${urgentCount} ${
                  urgentCount === 1 ? "location needs" : "locations need"
                } attention across ${summary.kpis.monitored_zones} monitored areas`
              : `All ${summary.kpis.monitored_zones} monitored areas are currently stable`}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-100">
            {urgentCount > 0
              ? "Active Water & Health Advisories"
              : "Community Water Safety Overview"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isCitizen
              ? "Check water safety near your town, review active advisories, or report symptoms in seconds."
              : "Focus on flagged areas below, verify active alerts, or log a new field sample."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onReportSymptoms}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:text-white"
          >
            + Report Illness
          </button>
          {!isCitizen && (
            <button
              onClick={onLogWater}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-white"
            >
              + Log Water Test
            </button>
          )}
        </div>
      </div>

      {/* 3 Focused KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            setWatchlistFilter((prev) => (prev === "urgent" ? "all" : "urgent"))
          }
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
        >
          <div className="text-xs font-medium text-zinc-400">
            Areas Needing Attention
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tabular-nums text-amber-400">
              {urgentCount}
            </span>
            <span className="text-xs text-zinc-400">
              of {summary.kpis.monitored_zones} locations
            </span>
          </div>
          <div className="mt-2.5 text-xs text-zinc-500">
            Overall water safety score: {summary.kpis.water_quality_index}/100
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenAlerts}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
        >
          <div className="text-xs font-medium text-zinc-400">
            Active Health Alerts
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tabular-nums text-red-400">
              {summary.kpis.active_alerts}
            </span>
            <span className="text-xs text-amber-400">
              {summary.kpis.pending_verification} awaiting review
            </span>
          </div>
          <div className="mt-2.5 text-xs text-zinc-500">
            {isCitizen
              ? "Click to read community advisories →"
              : "Click to verify & dispatch teams →"}
          </div>
        </button>

        <button
          type="button"
          onClick={onReportSymptoms}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
        >
          <div className="text-xs font-medium text-zinc-400">
            Reported Illness Cases
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tabular-nums text-zinc-100">
              {summary.kpis.total_affected_people}
            </span>
            <span className="text-xs text-zinc-400">
              {summary.kpis.total_health_reports} reports
            </span>
          </div>
          <div className="mt-2.5 text-xs text-zinc-500">
            Click to submit a new symptom report →
          </div>
        </button>
      </div>

      {/* Expandable Full Map or Split Map + Watchlist */}
      {expandedMap ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpandedMap(false)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
            >
              Collapse Full Map
            </button>
          </div>
          <RiskMap
            zones={zones}
            onSimulateZone={!isCitizen ? onSimulateZone : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 Cols: Priority Watchlist */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 lg:col-span-7">
            <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-medium text-zinc-100">
                  Location Watchlist ({visibleZones.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Sorted from highest risk to lowest
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search town..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                />
                <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setWatchlistFilter("urgent")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      watchlistFilter === "urgent"
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    Needs Attention
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchlistFilter("all")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      watchlistFilter === "all"
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    All ({zones.length})
                  </button>
                </div>
              </div>
            </div>

            {zones.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-400">
                <div className="font-medium text-zinc-200">
                  No community locations added yet
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {isCitizen
                    ? "Ask your community health worker to register a location."
                    : "Add your first town or station to start monitoring water risk."}
                </p>
                {!isCitizen && (
                  <button
                    onClick={onLogWater}
                    className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                  >
                    + Add First Location
                  </button>
                )}
              </div>
            ) : visibleZones.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                No matching High or Critical locations right now.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setWatchlistFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-zinc-200 underline hover:text-white"
                >
                  Show all {zones.length} locations
                </button>
              </div>
            ) : (
              <div className="max-h-[400px] divide-y divide-zinc-800/70 overflow-y-auto">
                {visibleZones.map((z) => {
                  const badge = RISK_BADGE_STYLES[z.current_risk_level];
                  return (
                    <div
                      key={z.id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-zinc-900/80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${badge.dot}`}
                          />
                          <span className="truncate text-sm font-medium text-zinc-100">
                            {z.name}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-400">
                          {z.district} · {z.symptom_cases_active} active illness{" "}
                          {z.symptom_cases_active === 1 ? "case" : "cases"}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right text-xs">
                          <div className={`font-semibold ${badge.text}`}>
                            {z.current_risk_level}
                          </div>
                          <div className="tabular-nums text-zinc-400">
                            {z.current_risk_score}/100
                          </div>
                        </div>

                        {!isCitizen && (
                          <button
                            type="button"
                            onClick={() => onSimulateZone(z)}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                          >
                            Simulate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 5 Cols: Interactive Map */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-zinc-100">
                  Community Safety Map
                </h2>
                <p className="text-xs text-zinc-400">
                  Click any pin to inspect water conditions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedMap(true)}
                className="text-xs font-medium text-zinc-300 underline hover:text-white"
              >
                Expand Map →
              </button>
            </div>
            <RiskMap
              zones={zones}
              compact={true}
              onSimulateZone={!isCitizen ? onSimulateZone : undefined}
            />
          </div>
        </div>
      )}

      {/* Compact Summary Footer Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Active Alerts */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-medium text-zinc-100">
              Latest Health Alerts
            </h3>
            <button
              onClick={onOpenAlerts}
              className="text-xs text-zinc-400 underline hover:text-zinc-100"
            >
              View all ({alerts.length})
            </button>
          </div>
          <div className="divide-y divide-zinc-800">
            {summary.recent_alerts.length === 0 ? (
              <div className="p-5 text-xs text-zinc-400">
                No active alerts right now.
              </div>
            ) : (
              summary.recent_alerts.slice(0, 3).map((al) => {
                const badge = RISK_BADGE_STYLES[al.severity];
                return (
                  <button
                    key={al.id}
                    onClick={onOpenAlerts}
                    className="block w-full p-4 text-left transition hover:bg-zinc-900/80"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${badge.text}`}>
                        {al.severity} ({al.risk_score}/100)
                      </span>
                      <span className="text-zinc-500">{al.status}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-zinc-100">
                      {al.title}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Most Reported Symptoms */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-100">
              Top Reported Symptoms
            </h3>
            <button
              type="button"
              onClick={onReportSymptoms}
              className="text-xs text-zinc-400 underline hover:text-zinc-100"
            >
              Log Case
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {Object.keys(summary.symptom_breakdown).length === 0 ? (
              <div className="text-xs text-zinc-400">
                No symptom reports logged yet.
              </div>
            ) : (
              Object.entries(summary.symptom_breakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([sym, count]) => (
                  <div key={sym} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-200">{sym}</span>
                      <span className="font-medium tabular-nums text-zinc-300">
                        {count} cases
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-zinc-200"
                        style={{
                          width: `${Math.min(100, Math.max(8, (count / 60) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Locations by Risk Level */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-medium text-zinc-100">
              Areas by Risk Level
            </h3>
          </div>
          <div className="divide-y divide-zinc-800 text-sm">
            {(["Critical", "High", "Moderate", "Low"] as RiskLevel[]).map(
              (lvl) => {
                const count = summary.risk_distribution[lvl] || 0;
                const st = RISK_BADGE_STYLES[lvl];
                return (
                  <div
                    key={lvl}
                    className="flex items-center justify-between px-5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                      <span className={`font-medium ${st.text}`}>
                        {lvl} Risk
                      </span>
                    </div>
                    <span className="tabular-nums text-zinc-300">
                      {count} {count === 1 ? "location" : "locations"}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
