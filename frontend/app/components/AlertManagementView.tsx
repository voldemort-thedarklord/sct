"use client";

import React, { useState, useEffect } from "react";
import { AlertItem, UserProfile, RISK_BADGE_STYLES } from "../types";

interface AlertManagementViewProps {
  alerts: AlertItem[];
  currentUser: UserProfile;
  token: string;
  onRefresh: () => void;
}

export default function AlertManagementView({
  alerts,
  currentUser,
  token,
  onRefresh,
}: AlertManagementViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(
    alerts[0] || null
  );
  const [actionNotes, setActionNotes] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAlert && alerts.length > 0) {
      setSelectedAlert(alerts[0]);
    } else if (selectedAlert) {
      const updated = alerts.find((a) => a.id === selectedAlert.id);
      if (updated) setSelectedAlert(updated);
    }
  }, [alerts, selectedAlert]);

  const filteredAlerts =
    statusFilter === "All"
      ? alerts
      : alerts.filter((a) => a.status === statusFilter);

  const handleUpdateAlert = async (
    alertId: number,
    newStatus: "Verified" | "Dispatched" | "Resolved",
    defaultNote: string
  ) => {
    setUpdating(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/alerts/${alertId}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          verified_by: currentUser.name,
          action_taken: actionNotes.trim() || defaultNote,
        }),
      });
      if (!res.ok) throw new Error("Failed to update alert");
      setFeedback(`Alert marked as ${newStatus}.`);
      setActionNotes("");
      onRefresh();
    } catch (err: any) {
      setFeedback(err.message || "Error updating alert");
    } finally {
      setUpdating(false);
    }
  };

  const counts = {
    All: alerts.length,
    Pending: alerts.filter((a) => a.status === "Pending").length,
    Verified: alerts.filter((a) => a.status === "Verified").length,
    Dispatched: alerts.filter((a) => a.status === "Dispatched").length,
    Resolved: alerts.filter((a) => a.status === "Resolved").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Community Health Alerts
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Review, verify, and resolve early warnings triggered by unsafe water readings or illness clusters.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
          {(
            ["All", "Pending", "Verified", "Dispatched", "Resolved"] as const
          ).map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {st} ({counts[st]})
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
          <div className="text-base font-medium text-zinc-200">
            No active health alerts right now
          </div>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
            Alerts are created automatically whenever a water quality test or symptom report indicates High or Critical disease risk.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 Cols: Alert List */}
          <div className="space-y-3 lg:col-span-7">
            {filteredAlerts.map((al) => {
              const isSelected = selectedAlert?.id === al.id;
              const badge = RISK_BADGE_STYLES[al.severity];
              return (
                <button
                  key={al.id}
                  onClick={() => setSelectedAlert(al)}
                  className={`block w-full rounded-xl border p-5 text-left transition ${
                    isSelected
                      ? "border-zinc-400 bg-zinc-900"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-2 text-xs font-semibold ${badge.text}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                      {al.severity} Risk ({al.risk_score}%) · {al.zone_name}
                    </span>
                    <span className="rounded-md bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
                      {al.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-semibold text-zinc-100">
                    {al.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {al.message}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>Source: {al.trigger_source}</span>
                    <span>
                      {al.timestamp
                        ? new Date(al.timestamp).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Recent"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right 5 Cols: Selected Alert Action Panel */}
          <div className="lg:col-span-5">
            {selectedAlert && (
              <div className="sticky top-6 space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                <div className="border-b border-zinc-800 pb-4">
                  <div className="text-xs font-medium text-zinc-400">
                    Selected Alert · {selectedAlert.zone_name}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                    {selectedAlert.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {selectedAlert.message}
                  </p>
                </div>

                {selectedAlert.action_taken && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 text-xs">
                    <div className="font-medium text-zinc-300">
                      Last Recorded Action ({selectedAlert.verified_by || "Staff"}):
                    </div>
                    <p className="mt-1 text-zinc-400">
                      {selectedAlert.action_taken}
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Response Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="e.g., Dispatched water testing team and issued boil-water advisory."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-medium text-zinc-400">
                    Update Alert Status:
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        handleUpdateAlert(
                          selectedAlert.id,
                          "Verified",
                          "Alert verified by health officer."
                        )
                      }
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Mark Verified
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        handleUpdateAlert(
                          selectedAlert.id,
                          "Dispatched",
                          "Field team dispatched for chlorination and water sampling."
                        )
                      }
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      Dispatch Team
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        handleUpdateAlert(
                          selectedAlert.id,
                          "Resolved",
                          "Water quality restored to safe limits and alert resolved."
                        )
                      }
                      className="rounded-lg bg-zinc-100 px-3 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
