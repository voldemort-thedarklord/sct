"use client";

import React, { useEffect, useState } from "react";
import { AnalyticsData, RISK_BADGE_STYLES } from "../types";

interface ReportsAnalyticsViewProps {
  token: string;
}

export default function ReportsAnalyticsView({
  token,
}: ReportsAnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to load trends data");
        }
        return r.json();
      })
      .then((res) => setData(res))
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const exportCsvReport = () => {
    if (!data) return;
    const headers = [
      "Location Code",
      "Location Name",
      "District",
      "Population",
      "Water Source",
      "Risk Level",
      "Risk Score",
      "pH",
      "Turbidity (NTU)",
      "TDS (mg/L)",
      "Dissolved Oxygen (mg/L)",
      "Active Illness Cases",
    ];
    const rows = data.zone_comparison.map((z) => [
      z.code,
      `"${z.name}"`,
      `"${z.district}"`,
      z.population,
      `"${z.water_source}"`,
      z.risk_level,
      z.risk_score,
      z.ph,
      z.turbidity,
      z.tds,
      z.dissolved_oxygen,
      z.total_symptom_cases,
    ]);
    const csvContent =
      headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "community_health_summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJsonReport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "community_health_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (errorMsg) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
        {errorMsg}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-sm text-zinc-400">
        Loading community health trends and comparison tables...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Trends & Historical Data
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Compare all monitored locations side-by-side and export your data for reporting.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCsvReport}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Download CSV Report
          </button>
          <button
            onClick={exportJsonReport}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Download JSON
          </button>
        </div>
      </div>

      {/* Location Comparison Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 p-5">
          <h3 className="text-base font-semibold text-zinc-100">
            Side-by-Side Location Comparison ({data.zone_comparison.length})
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            Summary of water test averages, reported illness cases, and risk score for each location.
          </p>
        </div>

        {data.zone_comparison.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            No locations added yet. Add a location in the{" "}
            <strong className="text-zinc-200">Water Quality</strong> tab to compare data here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-medium text-zinc-400">
                  <th className="px-5 py-3">Location</th>
                  <th className="px-3 py-3 text-right">Population</th>
                  <th className="px-3 py-3 text-right">pH</th>
                  <th className="px-3 py-3 text-right">Cloudiness</th>
                  <th className="px-3 py-3 text-right">TDS</th>
                  <th className="px-3 py-3 text-right">Oxygen</th>
                  <th className="px-3 py-3 text-right">Illness Cases</th>
                  <th className="px-5 py-3">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {data.zone_comparison.map((z) => {
                  const badge = RISK_BADGE_STYLES[z.risk_level];
                  return (
                    <tr
                      key={z.code}
                      className="transition hover:bg-zinc-900/90"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-zinc-100">
                          {z.name}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {z.district} · {z.water_source}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                        {z.population.toLocaleString()}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-200">
                        {z.ph}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-200">
                        {z.turbidity} NTU
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                        {z.tds} mg/L
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                        {z.dissolved_oxygen} mg/L
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums font-medium text-zinc-100">
                        {z.total_symptom_cases}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badge.text}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${badge.dot}`}
                          />
                          {z.risk_level} ({z.risk_score}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Trend Summary */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h3 className="text-base font-semibold text-zinc-100">
          Daily Water Quality & Risk History
        </h3>
        <p className="mt-0.5 text-xs text-zinc-400">
          Average daily risk score and water test measurements from logged readings.
        </p>

        {data.daily_trends.length === 0 ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-8 text-center text-sm text-zinc-400">
            Log water quality tests to build your daily trend chart.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {data.daily_trends.slice(-7).map((d) => (
              <div
                key={d.date}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="text-xs font-medium text-zinc-400">
                  {d.date}
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">
                  {d.avg_risk_score}%
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    risk
                  </span>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-zinc-400">
                  <div>pH: {d.avg_ph}</div>
                  <div>Turbidity: {d.avg_turbidity} NTU</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Model Accuracy & Dataset Summary (Simple & Friendly) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs font-medium text-zinc-400">
            Disease Risk Classifier
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">
            {data.ml_metrics.random_forest.accuracy}% Accuracy
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Trained on {data.ml_metrics.dataset?.total_records ?? 3781} real water quality records (Indian CPCB & Potability benchmark).
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs font-medium text-zinc-400">
            Unusual Sensor Reading Detector
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">
            {data.ml_metrics.isolation_forest.detection_sensitivity}% Sensitivity
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Automatically flags sudden spikes in water cloudiness, TDS, or pH.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-xs font-medium text-zinc-400">
            7-Day Outbreak Trend Forecaster
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-100">
            {data.ml_metrics.xgboost.r2_score}% R² Score
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Predicts how risk will change over the next 7 days with and without water treatment.
          </p>
        </div>
      </div>
    </div>
  );
}
