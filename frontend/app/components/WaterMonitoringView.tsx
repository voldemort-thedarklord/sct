"use client";

import React, { useState } from "react";
import {
  CommunityZone,
  PredictionResponse,
  WaterReading,
  RISK_BADGE_STYLES,
} from "../types";

interface WaterMonitoringViewProps {
  zones: CommunityZone[];
  readings: WaterReading[];
  token: string;
  onRefresh: () => void;
  embedded?: boolean;
  onViewPrediction?: (zone: CommunityZone) => void;
}

const QUICK_LOCATIONS = [
  { name: "Yanam Municipal Supply", district: "Yanam", lat: "16.7333", lon: "82.2167", pop: "55000" },
  { name: "Central Ward Borewell", district: "Hyderabad", lat: "17.3850", lon: "78.4867", pop: "42000" },
  { name: "Riverside Pump House", district: "Vijayawada", lat: "16.5062", lon: "80.6480", pop: "38000" },
  { name: "North Sector Water Tank", district: "Visakhapatnam", lat: "17.6868", lon: "83.2185", pop: "64000" },
];

export default function WaterMonitoringView({
  zones,
  readings,
  token,
  onRefresh,
  embedded = false,
  onViewPrediction,
}: WaterMonitoringViewProps) {
  const [zoneId, setZoneId] = useState<number>(zones[0]?.id || 0);
  const [ph, setPh] = useState<string>("");
  const [turbidity, setTurbidity] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  const [tds, setTds] = useState<string>("");
  const [dissolvedOxygen, setDissolvedOxygen] = useState<string>("");
  const [rainfallMm, setRainfallMm] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingCsv, setUploadingCsv] = useState<boolean>(false);
  const [showCsvDrawer, setShowCsvDrawer] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "normal" | "alert";
    text: string;
  } | null>(null);
  const [lastVerdict, setLastVerdict] = useState<{
    zone: CommunityZone;
    analysis: PredictionResponse;
    alertTriggered: boolean;
  } | null>(null);

  // Add Location Form State
  const [showNewStation, setShowNewStation] = useState<boolean>(
    zones.length === 0
  );
  const [newCode, setNewCode] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newDistrict, setNewDistrict] = useState<string>("");
  const [newLat, setNewLat] = useState<string>("16.7333");
  const [newLon, setNewLon] = useState<string>("82.2167");
  const [newPop, setNewPop] = useState<string>("25000");
  const [newWaterSource, setNewWaterSource] = useState<string>(
    "Municipal Piped Supply"
  );
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [lookingUpGeo, setLookingUpGeo] = useState<boolean>(false);
  const [creatingStation, setCreatingStation] = useState<boolean>(false);

  const [filterZoneId, setFilterZoneId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeZoneId = zones.some((z) => z.id === zoneId)
    ? zoneId
    : zones[0]?.id || 0;

  const fillCleanSample = () => {
    setPh("7.2");
    setTurbidity("1.6");
    setTemperature("25.5");
    setTds("240");
    setDissolvedOxygen("7.4");
    setRainfallMm("0");
  };

  const fillSlightlyCloudySample = () => {
    setPh("6.6");
    setTurbidity("6.2");
    setTemperature("28.5");
    setTds("540");
    setDissolvedOxygen("5.6");
    setRainfallMm("18");
  };

  const fillContaminatedSample = () => {
    setPh("5.8");
    setTurbidity("15.4");
    setTemperature("29.5");
    setTds("840");
    setDissolvedOxygen("3.1");
    setRainfallMm("48");
  };

  /** Look up Indian city/town coordinates automatically via Open-Meteo Geocoding API. */
  const handleLookupCoordinates = async (queryText?: string) => {
    const query = (queryText ?? newDistrict).trim() || newName.trim();
    if (!query) {
      setGeoStatus("Enter a city, town, or village name first.");
      return;
    }
    setLookingUpGeo(true);
    setGeoStatus("Finding coordinates...");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query
        )}&count=5&language=en&format=json`
      );
      const data = await res.json();
      const results: Array<{
        name: string;
        admin1?: string;
        country_code?: string;
        latitude: number;
        longitude: number;
        population?: number;
      }> = data?.results || [];
      if (results.length === 0) {
        setGeoStatus(
          "No exact match found — using default coordinates or expand Advanced below."
        );
        return;
      }
      const match =
        results.find((r) => r.country_code === "IN") || results[0];
      setNewLat(match.latitude.toFixed(4));
      setNewLon(match.longitude.toFixed(4));
      if (match.population && (!newPop || newPop === "25000")) {
        setNewPop(String(match.population));
      }
      setGeoStatus(
        `Map pin matched: ${match.name}${
          match.admin1 ? `, ${match.admin1}` : ""
        }`
      );
    } catch {
      setGeoStatus("Could not look up location right now.");
    } finally {
      setLookingUpGeo(false);
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStation(true);
    setFeedback(null);
    try {
      const autoCode =
        newCode.trim() || `LOC-0${zones.length + 1}`;
      const res = await fetch("/api/zones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: autoCode,
          name: newName.trim(),
          district: newDistrict.trim() || "Local District",
          latitude: Number(newLat) || 16.7333,
          longitude: Number(newLon) || 82.2167,
          population: Number(newPop) || 10000,
          water_source_type: newWaterSource,
          sanitation_index: 75,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create location");
      setNewCode("");
      setNewName("");
      setNewDistrict("");
      setShowNewStation(false);
      setFeedback({
        type: "normal",
        text: `Location "${data.name}" added! You can now log water quality tests for it below.`,
      });
      onRefresh();
    } catch (err: unknown) {
      setFeedback({
        type: "alert",
        text: err instanceof Error ? err.message : "Error creating location",
      });
    } finally {
      setCreatingStation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZoneId) {
      setFeedback({
        type: "alert",
        text: "Please add or select a location first.",
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone_id: Number(activeZoneId),
          ph: Number(ph),
          turbidity: Number(turbidity),
          temperature: Number(temperature),
          tds: Number(tds),
          dissolved_oxygen: Number(dissolvedOxygen),
          rainfall_mm: rainfallMm === "" ? 0.0 : Number(rainfallMm),
          source: "Field Water Test",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save water test");
      const lvl = data.ml_analysis?.predicted_risk_level;
      const score = data.ml_analysis?.risk_score;
      const matchedZone = zones.find((z) => z.id === Number(activeZoneId));
      if (matchedZone && data.ml_analysis) {
        setLastVerdict({
          zone: matchedZone,
          analysis: data.ml_analysis,
          alertTriggered: Boolean(data.alert_triggered),
        });
      }
      setFeedback({
        type: lvl === "High" || lvl === "Critical" ? "alert" : "normal",
        text: `Water test saved! Safety Result: ${lvl} Risk (Score: ${score}/100)${
          data.alert_triggered
            ? " — A health alert was automatically created for this location."
            : " — Water parameters are within safe limits."
        }`,
      });
      setPh("");
      setTurbidity("");
      setTemperature("");
      setTds("");
      setDissolvedOxygen("");
      setRainfallMm("");
      onRefresh();
    } catch (err: unknown) {
      setFeedback({
        type: "alert",
        text: err instanceof Error ? err.message : "Error saving water test",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    setUploadingCsv(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/water/upload-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "CSV upload failed");
      }
      setFeedback({
        type: data.alerts_triggered > 0 ? "alert" : "normal",
        text: `CSV uploaded: ${data.rows_ingested} water tests imported, ${data.alerts_triggered} high-risk alerts created.`,
      });
      onRefresh();
    } catch (err: unknown) {
      setFeedback({
        type: "alert",
        text: err instanceof Error ? err.message : "Failed to upload CSV",
      });
    } finally {
      setUploadingCsv(false);
    }
  };

  const downloadCsvSchema = (withSampleRows = false) => {
    const lines = [
      "zone_id,ph,turbidity,temperature,tds,dissolved_oxygen,rainfall_mm",
      ...(withSampleRows
        ? [
            "1,7.2,1.6,25.5,240,7.4,2.0",
            "1,6.5,7.2,29.5,560,5.2,25.0",
            "1,5.7,16.5,31.5,890,3.1,",
          ]
        : []),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = withSampleRows
      ? "water_test_sample.csv"
      : "water_test_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredReadings = readings.filter((r) => {
    const matchesZone =
      filterZoneId === "all" || r.zone_id === Number(filterZoneId);
    const matchesSearch =
      !searchQuery ||
      r.zone_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.risk_level.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Toolbar / Header */}
      <div
        className={`flex flex-col justify-between gap-4 sm:flex-row sm:items-center ${
          embedded ? "" : "border-b border-zinc-800 pb-5"
        }`}
      >
        {!embedded ? (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Water Quality Testing
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Log water test results for your community locations to check drinking water safety.
            </p>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">
            Select a location and enter test readings — AI checks safety immediately.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNewStation((prev) => !prev)}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            {showNewStation ? "Close Location Form" : "+ Add New Location"}
          </button>
          <button
            type="button"
            onClick={() => setShowCsvDrawer((prev) => !prev)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            {showCsvDrawer ? "Hide CSV Import" : "Batch Import CSV"}
          </button>
        </div>
      </div>

      {/* Collapsible CSV Batch Upload Drawer */}
      {showCsvDrawer && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Upload Multiple Tests from CSV
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Required columns: <code className="text-zinc-200">ph, turbidity, temperature, tds</code> (optional: <code className="text-zinc-200">zone_id, dissolved_oxygen, rainfall_mm</code>).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadCsvSchema(false)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
              >
                Blank Template
              </button>
              <button
                type="button"
                onClick={() => downloadCsvSchema(true)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
              >
                Download 3-Row Sample
              </button>
              <label className="cursor-pointer rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white">
                {uploadingCsv ? "Uploading..." : "Choose .csv File"}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
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

      {/* Inline Instant AI Verdict Card */}
      {lastVerdict && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-xs font-medium text-zinc-400">
                Instant Safety Verdict · {lastVerdict.zone.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span
                  className={`text-xl font-bold ${
                    RISK_BADGE_STYLES[
                      lastVerdict.analysis.predicted_risk_level
                    ].text
                  }`}
                >
                  {lastVerdict.analysis.predicted_risk_level} Risk (
                  {lastVerdict.analysis.risk_score}/100)
                </span>
                <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200">
                  {lastVerdict.analysis.is_anomaly
                    ? "Unusual / Contaminated Sensor Reading"
                    : "Normal Sensor Pattern"}
                </span>
              </div>
              {lastVerdict.analysis.recommended_actions[0] && (
                <p className="mt-2 text-xs text-zinc-300">
                  Next step: {lastVerdict.analysis.recommended_actions[0]}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {onViewPrediction && (
                <button
                  type="button"
                  onClick={() => onViewPrediction(lastVerdict.zone)}
                  className="rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-white"
                >
                  Open 7-Day Forecast →
                </button>
              )}
              <button
                type="button"
                onClick={() => setLastVerdict(null)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Location Drawer */}
      {showNewStation && (
        <form
          onSubmit={handleCreateStation}
          className="rounded-xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Add a Community Monitoring Location
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Enter the name of the area or pick one of the quick presets below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-zinc-400">Quick Fill:</span>
              {QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => {
                    setNewName(loc.name);
                    setNewDistrict(loc.district);
                    setNewLat(loc.lat);
                    setNewLon(loc.lon);
                    setNewPop(loc.pop);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  {loc.district}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Location Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Yanam Main Water Tank"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                City / Village / District *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g., Varanasi or Yanam"
                  value={newDistrict}
                  onChange={(e) => {
                    setNewDistrict(e.target.value);
                    setGeoStatus(null);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={lookingUpGeo}
                  onClick={() => handleLookupCoordinates()}
                  className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
                >
                  {lookingUpGeo ? "Finding..." : "Find Pin"}
                </button>
              </div>
              {geoStatus && (
                <p className="mt-1 text-xs text-emerald-300">{geoStatus}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Water Source Type
              </label>
              <select
                value={newWaterSource}
                onChange={(e) => setNewWaterSource(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
              >
                <option value="Municipal Piped Supply">
                  Municipal Piped Supply
                </option>
                <option value="Groundwater Borewell">
                  Groundwater Borewell
                </option>
                <option value="River / Surface Canal">
                  River / Surface Canal
                </option>
                <option value="Community Well / Tank">
                  Community Well / Tank
                </option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Approximate Population Served
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g., 25000"
                value={newPop}
                onChange={(e) => setNewPop(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <summary className="cursor-pointer select-none text-xs font-medium text-zinc-400 hover:text-zinc-200">
              Advanced: Edit exact GPS coordinates (Current: {newLat}, {newLon})
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                />
              </div>
            </div>
          </details>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewStation(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingStation}
              className="rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {creatingStation ? "Saving Location..." : "Save Location"}
            </button>
          </div>
        </form>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Simple Water Test Form */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Log a Water Quality Test
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Enter test results or use a quick sample below to test the system.
                </p>
              </div>
            </div>

            {/* Qualitative Field Condition Presets */}
            <div className="mt-4 space-y-2 rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-3">
              <div className="text-xs font-medium text-zinc-400">
                Quick Field Condition Presets (or type exact readings below):
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fillCleanSample}
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  Clear & Odorless
                </button>
                <button
                  type="button"
                  onClick={fillSlightlyCloudySample}
                  className="rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:border-zinc-400"
                >
                  Slightly Cloudy / Hard
                </button>
                <button
                  type="button"
                  onClick={fillContaminatedSample}
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
                >
                  Muddy / Foul Odor
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Select Location
                </label>
                {zones.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    No locations yet. Please click{" "}
                    <strong>+ Add New Location</strong> at the top first.
                  </div>
                ) : (
                  <select
                    value={activeZoneId}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      pH Level
                    </label>
                    <span className="text-xs text-zinc-400">
                      Safe: 6.5 – 8.5
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    required
                    placeholder="e.g. 7.2"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      Turbidity (Cloudiness)
                    </label>
                    <span className="text-xs text-zinc-400">
                      Safe: &lt; 5 NTU
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="e.g. 1.8"
                    value={turbidity}
                    onChange={(e) => setTurbidity(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      Dissolved Solids (TDS)
                    </label>
                    <span className="text-xs text-zinc-400">
                      Safe: &lt; 500 mg/L
                    </span>
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="e.g. 240"
                    value={tds}
                    onChange={(e) => setTds(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      Dissolved Oxygen
                    </label>
                    <span className="text-xs text-zinc-400">
                      Safe: &gt; 5 mg/L
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="e.g. 7.0"
                    value={dissolvedOxygen}
                    onChange={(e) => setDissolvedOxygen(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      Water Temp (°C)
                    </label>
                    <span className="text-xs text-zinc-400">Normal: 20–30°C</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 26.0"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-zinc-200">
                      Recent Rainfall (mm)
                    </label>
                    <span className="text-xs text-zinc-400">Optional</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Auto-fetched if blank"
                    value={rainfallMm}
                    onChange={(e) => setRainfallMm(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || zones.length === 0}
                className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
              >
                {submitting
                  ? "Checking Water Safety..."
                  : "Save Water Test & Check Safety"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Clear, Easy-to-Read Water Test History */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
            <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Recent Water Test Results ({filteredReadings.length})
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Every reading is automatically checked for contamination and disease risk.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
                />
                <select
                  value={filterZoneId}
                  onChange={(e) => setFilterZoneId(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="all">All Locations</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredReadings.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-base font-medium text-zinc-200">
                  No water tests recorded yet
                </div>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
                  Select your location on the left, pick{" "}
                  <strong className="text-zinc-200">
                    Clear &amp; Odorless
                  </strong>{" "}
                  (or enter your own test numbers), and click{" "}
                  <strong className="text-zinc-200">
                    Save Water Test &amp; Check Safety
                  </strong>
                  .
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-medium text-zinc-400">
                      <th className="px-5 py-3">Location</th>
                      <th className="px-3 py-3 text-right">pH</th>
                      <th className="px-3 py-3 text-right">Cloudiness</th>
                      <th className="px-3 py-3 text-right">TDS</th>
                      <th className="px-3 py-3 text-right">Oxygen</th>
                      <th className="px-4 py-3">Safety Status</th>
                      <th className="px-5 py-3 text-right">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {filteredReadings.map((r) => {
                      const badge = RISK_BADGE_STYLES[r.risk_level];
                      const phWarning = r.ph < 6.5 || r.ph > 8.5;
                      const turbWarning = r.turbidity > 5.0;
                      return (
                        <tr
                          key={r.id}
                          className="transition hover:bg-zinc-900/90"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-zinc-100">
                              {r.zone_name}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {r.is_anomaly ? (
                                <span className="text-amber-400">
                                  Unusual reading detected
                                </span>
                              ) : (
                                "Normal sensor check"
                              )}
                            </div>
                          </td>
                          <td
                            className={`px-3 py-3.5 text-right tabular-nums ${
                              phWarning
                                ? "font-semibold text-amber-400"
                                : "text-zinc-200"
                            }`}
                          >
                            {r.ph}
                          </td>
                          <td
                            className={`px-3 py-3.5 text-right tabular-nums ${
                              turbWarning
                                ? "font-semibold text-amber-400"
                                : "text-zinc-200"
                            }`}
                          >
                            {r.turbidity} NTU
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                            {r.tds} mg/L
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-zinc-300">
                            {r.dissolved_oxygen} mg/L
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badge.text}`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${badge.dot}`}
                              />
                              {r.risk_level} Risk ({r.risk_score}%)
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-xs text-zinc-400">
                            {r.timestamp
                              ? new Date(r.timestamp).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Just now"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
