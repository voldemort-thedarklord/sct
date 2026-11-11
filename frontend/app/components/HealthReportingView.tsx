"use client";

import React, { useState, useEffect } from "react";
import { CommunityZone, HealthReport, UserProfile } from "../types";

interface HealthReportingViewProps {
  zones: CommunityZone[];
  reports: HealthReport[];
  currentUser: UserProfile;
  token: string;
  onRefresh: () => void;
}

const SYMPTOM_OPTIONS = [
  { id: "Acute Diarrhea", desc: "Watery stools or stomach infection" },
  { id: "Vomiting / Nausea", desc: "Throwing up or severe nausea" },
  { id: "High Fever", desc: "Elevated body temperature / chills" },
  { id: "Abdominal Cramps", desc: "Sharp stomach pain" },
  { id: "Jaundice", desc: "Yellowing of eyes or skin (Hepatitis risk)" },
  { id: "Dehydration", desc: "Extreme thirst, dizziness, or weakness" },
];

const WATER_SOURCES = [
  "Municipal Piped Supply",
  "Groundwater Borewell",
  "Community Well / Tank",
  "River / Surface Canal",
  "Water Tanker Delivery",
];

export default function HealthReportingView({
  zones,
  reports,
  currentUser,
  token,
  onRefresh,
}: HealthReportingViewProps) {
  const [zoneId, setZoneId] = useState<number>(zones[0]?.id || 0);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [affectedCount, setAffectedCount] = useState<string>("");
  const [severity, setSeverity] = useState<"Mild" | "Moderate" | "Severe">(
    "Moderate"
  );
  const [waterSourceUsed, setWaterSourceUsed] = useState<string>(
    WATER_SOURCES[0]
  );
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "normal" | "alert";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (zones.length > 0 && (!zoneId || !zones.some((z) => z.id === zoneId))) {
      setZoneId(zones[0].id);
    }
  }, [zones, zoneId]);

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneId) {
      setFeedback({
        type: "alert",
        text: "Please add a community location in the Water Quality tab first.",
      });
      return;
    }
    if (selectedSymptoms.length === 0) {
      setFeedback({
        type: "alert",
        text: "Please select at least one symptom being reported.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/health-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone_id: Number(zoneId),
          reporter_name: currentUser.name,
          reporter_role: currentUser.role,
          symptoms: selectedSymptoms,
          affected_count: Number(affectedCount) || 1,
          severity,
          water_source_used: waterSourceUsed,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not submit report");
      setFeedback({
        type: data.alert_triggered ? "alert" : "normal",
        text: `Health report saved! Updated location risk: ${data.updated_zone_risk.level} (${data.updated_zone_risk.score}%)${
          data.alert_triggered
            ? " — A community health alert was automatically triggered."
            : "."
        }`,
      });
      setSelectedSymptoms([]);
      setAffectedCount("");
      setNotes("");
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: "alert",
        text: err.message || "Error submitting health report",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalAffected = reports.reduce((acc, r) => acc + r.affected_count, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Community Health Reports
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Report stomach illness, fever, or water-related symptoms in your area to help spot outbreaks early.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm">
            <span className="text-zinc-400">Reports: </span>
            <span className="font-semibold text-zinc-100">
              {reports.length}
            </span>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm">
            <span className="text-zinc-400">Total Cases: </span>
            <span className="font-semibold text-zinc-100">{totalAffected}</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3.5 text-sm font-medium ${
            feedback.type === "alert"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Easy Symptom Report Form */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <div className="border-b border-zinc-800 pb-4">
              <h3 className="text-base font-semibold text-zinc-100">
                Submit a Symptom Report
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Select the location, click the symptoms observed, and enter how many people are affected.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Community Location
              </label>
              {zones.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  No locations registered yet. Please add a location in the{" "}
                  <strong>Water Quality</strong> tab first.
                </div>
              ) : (
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.district})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Easy Symptom Cards */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">
                What symptoms are people experiencing? (Select one or more)
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SYMPTOM_OPTIONS.map((sym) => {
                  const active = selectedSymptoms.includes(sym.id);
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => toggleSymptom(sym.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-zinc-200 bg-zinc-800 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{sym.id}</span>
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{sym.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Number of People Affected
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  required
                  placeholder="e.g. 5"
                  value={affectedCount}
                  onChange={(e) => setAffectedCount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Symptom Severity
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["Mild", "Moderate", "Severe"] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`rounded-lg border py-2.5 text-xs font-medium transition ${
                        severity === sev
                          ? "border-zinc-200 bg-zinc-100 text-zinc-950"
                          : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Drinking Water Source Used
              </label>
              <select
                value={waterSourceUsed}
                onChange={(e) => setWaterSourceUsed(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
              >
                {WATER_SOURCES.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Several households near the main market reported murky tap water."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || zones.length === 0}
              className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {submitting ? "Submitting Report..." : "Submit Health Report"}
            </button>
          </form>
        </div>

        {/* Right: Recent Community Reports */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
            <div className="border-b border-zinc-800 p-5">
              <h3 className="text-base font-semibold text-zinc-100">
                Recent Community Health Reports ({reports.length})
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Reports logged by health workers and community members
              </p>
            </div>

            {reports.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-base font-medium text-zinc-200">
                  No symptom reports submitted yet
                </div>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
                  Use the form on the left to log community illness cases. Reports automatically update the location’s outbreak risk score.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 transition hover:bg-zinc-900/90"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-base font-semibold text-zinc-100">
                          {r.zone_name}
                        </span>
                        <span className="ml-2 text-xs text-zinc-400">
                          · {r.water_source_used}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${
                            r.severity === "Severe"
                              ? "bg-red-500/15 text-red-300"
                              : r.severity === "Moderate"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {r.severity} Severity
                        </span>
                        <span className="rounded-md bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-100">
                          {r.affected_count} people affected
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.symptoms.map((sym) => (
                        <span
                          key={sym}
                          className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>

                    {r.notes && (
                      <p className="mt-2.5 text-xs leading-relaxed text-zinc-300">
                        “{r.notes}”
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                      <span>Reported by {r.reporter_name}</span>
                      <span>
                        {r.timestamp
                          ? new Date(r.timestamp).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
