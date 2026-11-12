"use client";

import React, { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { UserProfile } from "../types";

interface AuthViewProps {
  currentUser: UserProfile | null;
  token: string;
  onUserUpdated: (user: UserProfile) => void;
  onClose?: () => void;
}

export default function AuthView({
  currentUser,
  token,
  onUserUpdated,
  onClose,
}: AuthViewProps) {
  const [assignedZone, setAssignedZone] = useState(
    currentUser?.assigned_zone || "All Locations"
  );
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assigned_zone: assignedZone,
          phone,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUserUpdated(updated);
        setSavedMsg("Preferences saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">
            Account & Alert Preferences
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Set your local area and phone number to receive water safety alerts.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            Done
          </button>
        )}
      </div>

      {/* Account Summary Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center gap-4">
          <UserButton />
          <div>
            <div className="text-base font-medium text-zinc-100">
              {currentUser.name}
            </div>
            <div className="text-sm text-zinc-400">{currentUser.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Signed In
        </div>
      </div>

      {/* Contact Preferences Form */}
      <form
        onSubmit={handleSaveProfile}
        className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/60 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              My Town / Area
            </label>
            <input
              type="text"
              value={assignedZone}
              onChange={(e) => setAssignedZone(e.target.value)}
              placeholder="e.g., Central Ward or All Locations"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Phone Number (Optional, for SMS Alerts)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {savedMsg && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            {savedMsg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
