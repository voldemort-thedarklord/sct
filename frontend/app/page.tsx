"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import {
  SignIn,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import dynamic from "next/dynamic";
import {
  CommunityZone,
  WaterReading,
  HealthReport,
  AlertItem,
  DashboardSummary,
  UserProfile,
  RISK_BADGE_STYLES,
  RiskLevel,
} from "./types";
import WaterMonitoringView from "./components/WaterMonitoringView";
import HealthReportingView from "./components/HealthReportingView";
import AiPredictionView from "./components/AiPredictionView";
import AlertManagementView from "./components/AlertManagementView";
import ReportsAnalyticsView from "./components/ReportsAnalyticsView";
import AuthView from "./components/AuthView";

const RiskMap = dynamic(() => import("./components/RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
      Loading community map...
    </div>
  ),
});

type NavPage =
  | "dashboard"
  | "water"
  | "health"
  | "predict"
  | "map"
  | "alerts"
  | "analytics"
  | "auth";

function SignedInApp() {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();

  const [activePage, setActivePage] = useState<NavPage>("dashboard");
  const [token, setToken] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [zones, setZones] = useState<CommunityZone[]>([]);
  const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
  const [healthReports, setHealthReports] = useState<HealthReport[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatedZone, setSimulatedZone] = useState<CommunityZone | null>(
    null
  );

  const fetchAllData = useCallback(async () => {
    if (!authLoaded || !isSignedIn) return;
    try {
      const freshToken = await getToken();
      if (!freshToken) return;
      setToken(freshToken);

      const email =
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        "";
      const fullName =
        clerkUser?.fullName ||
        clerkUser?.firstName ||
        email.split("@")[0] ||
        "Community Member";

      const headers: Record<string, string> = {
        Authorization: `Bearer ${freshToken}`,
        "X-Clerk-User-Email": email,
        "X-Clerk-User-Name": fullName,
      };

      // Sync Clerk user to Supabase sch_users table
      const syncRes = await fetch("/api/auth/clerk-sync", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name: fullName,
        }),
      });
      if (syncRes.ok) {
        const syncedProfile = await syncRes.json();
        setCurrentUser(syncedProfile);
      }

      const [sumRes, zonesRes, waterRes, healthRes, alertsRes] =
        await Promise.all([
          fetch("/api/dashboard/summary", { headers }),
          fetch("/api/zones", { headers }),
          fetch("/api/water?limit=35", { headers }),
          fetch("/api/health-reports?limit=30", { headers }),
          fetch("/api/alerts", { headers }),
        ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (zonesRes.ok) setZones(await zonesRes.json());
      if (waterRes.ok) setWaterReadings(await waterRes.json());
      if (healthRes.ok) setHealthReports(await healthRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [authLoaded, isSignedIn, getToken, clerkUser]);

  useEffect(() => {
    if (authLoaded && userLoaded && isSignedIn) {
      fetchAllData();
    }
  }, [authLoaded, userLoaded, isSignedIn, fetchAllData]);

  const handleSimulateZone = (zone: CommunityZone) => {
    setSimulatedZone(zone);
    setActivePage("predict");
  };

  const navItems: {
    id: NavPage;
    label: string;
    badge?: number;
  }[] = [
    { id: "dashboard", label: "Overview" },
    { id: "water", label: "Water Quality" },
    { id: "health", label: "Health Reports" },
    { id: "predict", label: "Risk Predictor" },
    { id: "map", label: "Community Map" },
    {
      id: "alerts",
      label: "Health Alerts",
      badge: summary?.kpis.active_alerts || 0,
    },
    { id: "analytics", label: "Trends & Data" },
    { id: "auth", label: "Account & Role" },
  ];

  const fallbackUser: UserProfile = currentUser || {
    id: 1,
    name:
      clerkUser?.fullName ||
      clerkUser?.firstName ||
      clerkUser?.primaryEmailAddress?.emailAddress ||
      "User",
    email: clerkUser?.primaryEmailAddress?.emailAddress || "",
    role: "authority",
    assigned_zone: "All Locations",
  };

  return (
    <div className="flex min-h-screen bg-[#0A0A0B] text-[#F4F4F5]">
      {/* Clean Modern Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-[#0D0D10] lg:flex">
        <div>
          {/* Brand Header */}
          <div className="border-b border-zinc-800/80 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-base font-semibold tracking-tight text-zinc-100">
                Smart Community Health
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Water Quality & Disease Prevention
            </p>
          </div>

          {/* Simple, Readable Navigation */}
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3.5 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-zinc-100 font-medium text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        active
                          ? "bg-zinc-900 text-amber-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer with Clerk UserButton */}
        <div className="border-t border-zinc-800/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserButton />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {fallbackUser.name}
                </div>
                <div className="truncate text-xs capitalize text-zinc-400">
                  {fallbackUser.role.replace("_", " ")}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActivePage("auth")}
              className="shrink-0 rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            >
              Role
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-[#0D0D10] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">
              {navItems.find((n) => n.id === activePage)?.label || "Overview"}
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              • Connected to Supabase Cloud
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAllData}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Refresh Data
            </button>
            <button
              onClick={() => setActivePage("water")}
              className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white"
            >
              + Log Water Test
            </button>
            <div className="flex items-center lg:hidden">
              <UserButton />
            </div>
          </div>

          {/* Mobile Navigation Bar */}
          <div className="flex w-full gap-1.5 overflow-x-auto border-t border-zinc-800/80 pt-2.5 lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  activePage === item.id
                    ? "bg-zinc-100 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1380px] flex-1 p-6 sm:p-8">
          {loading && !summary ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
              Loading your community health dashboard...
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {activePage === "dashboard" && summary && (
                <div className="space-y-8">
                  {/* Welcome Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/80 pb-5 sm:flex-row sm:items-end">
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                        Community Health Overview
                      </h1>
                      <p className="mt-1 text-sm text-zinc-400">
                        Monitor local water safety, community symptom reports, and early disease risk warnings in one place.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActivePage("health")}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                      >
                        Report Symptoms
                      </button>
                      <button
                        onClick={() => setActivePage("predict")}
                        className="rounded-md bg-zinc-100 px-3.5 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                      >
                        Run Risk Check
                      </button>
                    </div>
                  </div>

                  {/* 4 Key Summary Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      onClick={() => setActivePage("water")}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
                    >
                      <div className="text-xs font-medium text-zinc-400">
                        Water Safety Score
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-3xl font-semibold tabular-nums text-zinc-100">
                          {summary.kpis.water_quality_index}
                          <span className="text-sm font-normal text-zinc-500">
                            /100
                          </span>
                        </span>
                        <span className="text-xs text-zinc-400">
                          Avg pH {summary.kpis.avg_ph}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">
                        Turbidity {summary.kpis.avg_turbidity} NTU · TDS{" "}
                        {summary.kpis.avg_tds} mg/L
                      </div>
                    </button>

                    <button
                      onClick={() => setActivePage("health")}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
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
                      <div className="mt-3 text-xs text-zinc-500">
                        Submitted by health workers & citizens
                      </div>
                    </button>

                    <button
                      onClick={() => setActivePage("predict")}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
                    >
                      <div className="text-xs font-medium text-zinc-400">
                        High-Risk Locations
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-3xl font-semibold tabular-nums text-amber-400">
                          {summary.kpis.high_or_critical_zones}
                        </span>
                        <span className="text-xs text-zinc-400">
                          of {summary.kpis.monitored_zones} areas
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">
                        {summary.kpis.anomalies_detected} unusual water readings detected
                      </div>
                    </button>

                    <button
                      onClick={() => setActivePage("alerts")}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-zinc-700"
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
                      <div className="mt-3 text-xs text-zinc-500">
                        Click to view & verify community warnings →
                      </div>
                    </button>
                  </div>

                  {/* Main Grid: Left 8 Cols (Locations & Map) / Right 4 Cols (Alerts & Symptoms) */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-6 lg:col-span-8">
                      {/* Monitored Locations Table */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                          <div>
                            <h2 className="text-base font-medium text-zinc-100">
                              Monitored Community Locations ({zones.length})
                            </h2>
                            <p className="text-xs text-zinc-400">
                              Latest water test results and disease risk level for each community area
                            </p>
                          </div>
                          <button
                            onClick={() => setActivePage("water")}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 hover:text-white"
                          >
                            + Add Location / Reading
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs text-zinc-400">
                                <th className="px-5 py-3 font-medium">
                                  Location
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                  pH
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                  Turbidity
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                  TDS
                                </th>
                                <th className="px-3 py-3 text-right font-medium">
                                  Active Cases
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Risk Level
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/70">
                              {zones.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-5 py-10 text-center text-sm text-zinc-400"
                                  >
                                    <div className="font-medium text-zinc-200">
                                      No community locations added yet
                                    </div>
                                    <p className="mt-1 text-xs text-zinc-400">
                                      Add your first monitoring location and water test to start tracking risk.
                                    </p>
                                    <button
                                      onClick={() => setActivePage("water")}
                                      className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                                    >
                                      + Add First Location in Water Quality
                                    </button>
                                  </td>
                                </tr>
                              ) : (
                                zones.map((z) => {
                                  const badge =
                                    RISK_BADGE_STYLES[z.current_risk_level];
                                  return (
                                    <tr
                                      key={z.id}
                                      className="transition hover:bg-zinc-900/80"
                                    >
                                      <td className="px-5 py-3.5">
                                        <div className="font-medium text-zinc-100">
                                          {z.name}
                                        </div>
                                        <div className="text-xs text-zinc-400">
                                          {z.district} · {z.water_source_type}
                                        </div>
                                      </td>
                                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-200">
                                        {z.latest_water?.ph ?? "—"}
                                      </td>
                                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-200">
                                        {z.latest_water?.turbidity
                                          ? `${z.latest_water.turbidity} NTU`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                                        {z.latest_water?.tds
                                          ? `${z.latest_water.tds} mg/L`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-3.5 text-right tabular-nums text-zinc-100">
                                        {z.symptom_cases_active}
                                      </td>
                                      <td className="px-3 py-3.5 text-xs font-medium">
                                        <span className={badge.text}>
                                          {z.current_risk_level} (
                                          {z.current_risk_score}%)
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 text-right">
                                        <button
                                          onClick={() => handleSimulateZone(z)}
                                          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                        >
                                          Check Risk
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Map Preview */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h2 className="text-base font-medium text-zinc-100">
                              Community Risk Map
                            </h2>
                            <p className="text-xs text-zinc-400">
                              Geographic view of monitored locations and current risk levels
                            </p>
                          </div>
                          <button
                            onClick={() => setActivePage("map")}
                            className="text-xs font-medium text-zinc-300 underline hover:text-white"
                          >
                            Open Full Map →
                          </button>
                        </div>
                        <RiskMap
                          zones={zones}
                          compact={true}
                          onSimulateZone={handleSimulateZone}
                        />
                      </div>
                    </div>

                    {/* Right 4 Columns */}
                    <div className="space-y-6 lg:col-span-4">
                      {/* Recent Alerts */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                          <h3 className="text-base font-medium text-zinc-100">
                            Recent Health Alerts
                          </h3>
                          <button
                            onClick={() => setActivePage("alerts")}
                            className="text-xs text-zinc-400 underline hover:text-zinc-100"
                          >
                            View all ({alerts.length})
                          </button>
                        </div>
                        <div className="divide-y divide-zinc-800">
                          {summary.recent_alerts.length === 0 ? (
                            <div className="p-5 text-sm text-zinc-400">
                              No active alerts right now. Alerts appear automatically when high water contamination or outbreak risk is detected.
                            </div>
                          ) : (
                            summary.recent_alerts.slice(0, 4).map((al) => {
                              const badge = RISK_BADGE_STYLES[al.severity];
                              return (
                                <button
                                  key={al.id}
                                  onClick={() => setActivePage("alerts")}
                                  className="block w-full p-4 text-left transition hover:bg-zinc-900/80"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className={`font-medium ${badge.text}`}>
                                      {al.severity} Risk ({al.risk_score}%)
                                    </span>
                                    <span className="text-zinc-500">
                                      {al.status}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-zinc-100">
                                    {al.title}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                                    {al.message}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Reported Symptoms Summary */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                        <h3 className="text-base font-medium text-zinc-100">
                          Most Reported Symptoms
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Community health complaints logged across all areas
                        </p>
                        <div className="mt-4 space-y-3">
                          {Object.keys(summary.symptom_breakdown).length === 0 ? (
                            <div className="text-sm text-zinc-400">
                              No symptom reports logged yet.
                            </div>
                          ) : (
                            Object.entries(summary.symptom_breakdown)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([sym, count]) => (
                                <div key={sym} className="space-y-1.5">
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
                                        width: `${Math.min(
                                          100,
                                          Math.max(8, (count / 60) * 100)
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>

                      {/* Locations by Risk Level */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                        <div className="border-b border-zinc-800 px-5 py-4">
                          <h3 className="text-base font-medium text-zinc-100">
                            Locations by Risk Level
                          </h3>
                        </div>
                        <div className="divide-y divide-zinc-800 text-sm">
                          {(
                            ["Critical", "High", "Moderate", "Low"] as RiskLevel[]
                          ).map((lvl) => {
                            const count = summary.risk_distribution[lvl] || 0;
                            const st = RISK_BADGE_STYLES[lvl];
                            return (
                              <div
                                key={lvl}
                                className="flex items-center justify-between px-5 py-3"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${st.dot}`}
                                  />
                                  <span className={st.text}>{lvl} Risk</span>
                                </div>
                                <span className="tabular-nums text-zinc-300">
                                  {count} {count === 1 ? "location" : "locations"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* WATER QUALITY */}
              {activePage === "water" && (
                <WaterMonitoringView
                  zones={zones}
                  readings={waterReadings}
                  token={token}
                  onRefresh={fetchAllData}
                />
              )}

              {/* HEALTH REPORTS */}
              {activePage === "health" && (
                <HealthReportingView
                  zones={zones}
                  reports={healthReports}
                  currentUser={fallbackUser}
                  token={token}
                  onRefresh={fetchAllData}
                />
              )}

              {/* RISK PREDICTOR */}
              {activePage === "predict" && (
                <AiPredictionView
                  zones={zones}
                  initialZone={simulatedZone}
                  token={token}
                  onRefreshDashboard={fetchAllData}
                />
              )}

              {/* COMMUNITY MAP */}
              {activePage === "map" && (
                <RiskMap zones={zones} onSimulateZone={handleSimulateZone} />
              )}

              {/* HEALTH ALERTS */}
              {activePage === "alerts" && (
                <AlertManagementView
                  alerts={alerts}
                  currentUser={fallbackUser}
                  token={token}
                  onRefresh={fetchAllData}
                />
              )}

              {/* TRENDS & DATA */}
              {activePage === "analytics" && (
                <ReportsAnalyticsView token={token} />
              )}

              {/* ACCOUNT & ROLE */}
              {activePage === "auth" && (
                <AuthView
                  currentUser={fallbackUser}
                  token={token}
                  onUserUpdated={(updated) => setCurrentUser(updated)}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SmartCommunityHealthApp() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] text-sm text-zinc-400">
          Loading Smart Community Health...
        </div>
      }
    >
      <Show when="signed-out">
        <div className="flex min-h-screen flex-col bg-[#0A0A0B] text-[#F4F4F5]">
          {/* Clean Professional Top Bar */}
          <header className="border-b border-zinc-800/80 bg-[#0D0D10] px-6 py-4">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-base font-semibold tracking-tight text-zinc-100">
                  Smart Community Health
                </span>
              </div>
              <div className="flex items-center gap-3">
                <SignInButton mode="modal">
                  <button className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white">
                    Create Account
                  </button>
                </SignUpButton>
              </div>
            </div>
          </header>

          {/* Clean, Welcoming Sign-In Page */}
          <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Community Water & Health Protection
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
                Keep your community’s water safe and prevent disease outbreaks early.
              </h1>
              <p className="text-base leading-relaxed text-zinc-400">
                Sign in to log local water quality tests, report community health symptoms, and get instant early warnings powered by real-time machine learning and Supabase cloud storage.
              </p>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-4">
                  <div className="text-sm font-medium text-zinc-100">
                    Easy Water & Symptom Logging
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Record pH, turbidity, and local symptom reports in seconds from any device.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-4">
                  <div className="text-sm font-medium text-zinc-100">
                    Early Outbreak Warnings
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Automatically spots unsafe water readings and predicts 7-day disease risk.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:col-span-6 lg:justify-end">
              <SignIn routing="hash" />
            </div>
          </main>
        </div>
      </Show>

      <Show when="signed-in">
        <SignedInApp />
      </Show>
    </Suspense>
  );
}
