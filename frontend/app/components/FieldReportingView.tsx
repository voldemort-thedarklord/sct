"use client";

import React from "react";
import {
  CommunityZone,
  HealthReport,
  UserProfile,
  WaterReading,
} from "../types";
import WaterMonitoringView from "./WaterMonitoringView";
import HealthReportingView from "./HealthReportingView";

export type ReportMode = "water" | "health";

interface FieldReportingViewProps {
  zones: CommunityZone[];
  waterReadings: WaterReading[];
  healthReports: HealthReport[];
  currentUser: UserProfile;
  token: string;
  mode: ReportMode;
  onModeChange: (mode: ReportMode) => void;
  onRefresh: () => void;
  onViewPrediction: (zone: CommunityZone) => void;
}

/**
 * Unified data intake screen combining Location & Water Testing and Symptom Reporting
 * under a single tab accessible to anyone.
 */
export default function FieldReportingView({
  zones,
  waterReadings,
  healthReports,
  currentUser,
  token,
  mode,
  onModeChange,
  onRefresh,
  onViewPrediction,
}: FieldReportingViewProps) {
  return (
    <div className="space-y-6">
      {/* Unified Header & Segmented Mode Switch */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Log Water Test or Report Illness
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Add any town or village, log a water test, or report illness symptoms in your community.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
          <button
            type="button"
            onClick={() => onModeChange("water")}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition ${
              mode === "water"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            Log Water Test
          </button>
          <button
            type="button"
            onClick={() => onModeChange("health")}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition ${
              mode === "health"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            Report Illness
          </button>
        </div>
      </div>

      {mode === "water" ? (
        <WaterMonitoringView
          zones={zones}
          readings={waterReadings}
          token={token}
          onRefresh={onRefresh}
          embedded={true}
          onViewPrediction={onViewPrediction}
        />
      ) : (
        <HealthReportingView
          zones={zones}
          reports={healthReports}
          currentUser={currentUser}
          token={token}
          onRefresh={onRefresh}
          embedded={true}
          onAddLocationRequested={() => onModeChange("water")}
        />
      )}
    </div>
  );
}
