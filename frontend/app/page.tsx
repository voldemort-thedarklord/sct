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
import {
  ActivePage,
  CommunityZone,
  WaterReading,
  HealthReport,
  AlertItem,
  DashboardSummary,
  UserProfile,
} from "./types";
import HomeDashboardView from "./components/HomeDashboardView";
import FieldReportingView, {
  ReportMode,
} from "./components/FieldReportingView";
import InsightsSimulatorView, {
  InsightsTab,
} from "./components/InsightsSimulatorView";
import AlertManagementView from "./components/AlertManagementView";
import AuthView from "./components/AuthView";

function SignedInApp() {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();

  const [activePage, setActivePage] = useState<ActivePage>("home");
  const [reportMode, setReportMode] = useState<ReportMode>("water");
  const [insightsTab, setInsightsTab] = useState<InsightsTab>("simulator");
  const [profileOpen, setProfileOpen] = useState<boolean>(false);

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
    if (!authLoaded || !userLoaded || !isSignedIn) return;
    const timer = window.setTimeout(() => {
      void fetchAllData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoaded, userLoaded, isSignedIn, fetchAllData]);

  const handleSimulateZone = (zone: CommunityZone) => {
    setSimulatedZone(zone);
    setInsightsTab("simulator");
    setActivePage("insights");
  };

  const openReportView = (mode: ReportMode) => {
    setReportMode(mode);
    setActivePage("report");
  };

  const fallbackUser: UserProfile = currentUser || {
    id: 1,
    name:
      clerkUser?.fullName ||
      clerkUser?.firstName ||
      clerkUser?.primaryEmailAddress?.emailAddress ||
      "Community User",
    email: clerkUser?.primaryEmailAddress?.emailAddress || "",
    assigned_zone: "All Locations",
  };

  const navItems: {
    id: ActivePage;
    label: string;
    badge?: number;
  }[] = [
    { id: "home", label: "Home" },
    { id: "report", label: "Log & Report" },
    {
      id: "alerts",
      label: "Health Alerts",
      badge: summary?.kpis.active_alerts || 0,
    },
    { id: "insights", label: "Forecast & Trends" },
  ];

  return (
    <div className="flex min-h-screen bg-[#0A0A0B] text-[#F4F4F5]">
      {/* Clean Simplified Sidebar */}
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
              Water Quality &amp; Disease Prevention
            </p>
          </div>

          {/* 4 Goal-Driven Tabs */}
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

        {/* User Profile Footer -> Opens Contact Preferences Drawer */}
        <div className="border-t border-zinc-800/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserButton />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {fallbackUser.name}
                </div>
                <div className="truncate text-xs text-zinc-400">
                  {fallbackUser.assigned_zone || "All Locations"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setProfileOpen(true)}
              className="shrink-0 rounded border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
            >
              Profile
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-[#0D0D10] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">
              {navItems.find((n) => n.id === activePage)?.label || "Home"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAllData}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Refresh
            </button>
            <button
              onClick={() => openReportView("health")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
            >
              + Report Illness
            </button>
            <button
              onClick={() => openReportView("water")}
              className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white"
            >
              + Log Water Test
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 lg:hidden"
            >
              Profile
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
              {activePage === "home" && summary && (
                <HomeDashboardView
                  summary={summary}
                  zones={zones}
                  alerts={alerts}
                  onLogWater={() => openReportView("water")}
                  onReportSymptoms={() => openReportView("health")}
                  onOpenAlerts={() => setActivePage("alerts")}
                  onSimulateZone={handleSimulateZone}
                />
              )}

              {activePage === "report" && (
                <FieldReportingView
                  zones={zones}
                  waterReadings={waterReadings}
                  healthReports={healthReports}
                  currentUser={fallbackUser}
                  token={token}
                  mode={reportMode}
                  onModeChange={setReportMode}
                  onRefresh={fetchAllData}
                  onViewPrediction={handleSimulateZone}
                />
              )}

              {activePage === "alerts" && (
                <AlertManagementView
                  alerts={alerts}
                  currentUser={fallbackUser}
                  token={token}
                  onRefresh={fetchAllData}
                />
              )}

              {activePage === "insights" && (
                <InsightsSimulatorView
                  zones={zones}
                  initialZone={simulatedZone}
                  tab={insightsTab}
                  onTabChange={setInsightsTab}
                  token={token}
                  onRefreshDashboard={fetchAllData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Account & Contact Preferences Slide-Over Drawer */}
      {profileOpen && (
        <div className="fixed inset-0 z-[1000] flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-[#0D0D10] p-6 shadow-2xl">
            <AuthView
              key={fallbackUser.id}
              currentUser={fallbackUser}
              token={token}
              onUserUpdated={(updated) => setCurrentUser(updated)}
              onClose={() => setProfileOpen(false)}
            />
          </div>
        </div>
      )}
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
