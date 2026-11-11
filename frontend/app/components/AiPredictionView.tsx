"use client";

import React, { useState, useEffect } from "react";
import {
  CommunityZone,
  PredictionResponse,
  RISK_BADGE_STYLES,
} from "../types";

interface AiPredictionViewProps {
  zones: CommunityZone[];
  initialZone?: CommunityZone | null;
  token: string;
  onRefreshDashboard: () => void;
}

export default function AiPredictionView({
  zones,
  initialZone,
  token,
  onRefreshDashboard,
}: AiPredictionViewProps) {
  const defaultZone = initialZone || zones[0];

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    defaultZone ? String(defaultZone.id) : ""
  );
  const [ph, setPh] = useState<number>(defaultZone?.latest_water?.ph ?? 7.2);
  const [turbidity, setTurbidity] = useState<number>(
    defaultZone?.latest_water?.turbidity ?? 2.0
  );
  const [temperature, setTemperature] = useState<number>(
    defaultZone?.latest_water?.temperature ?? 26.0
  );
  const [tds, setTds] = useState<number>(
    defaultZone?.latest_water?.tds ?? 260
  );
  const [dissolvedOxygen, setDissolvedOxygen] = useState<number>(
    defaultZone?.latest_water?.dissolved_oxygen ?? 7.0
  );
  const [symptomCases, setSymptomCases] = useState<number>(
    defaultZone?.symptom_cases_active ?? 0
  );
  const [rainfallMm, setRainfallMm] = useState<number>(10);

  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runPrediction = async (customParams?: {
    zoneId?: string;
    ph?: number;
    turbidity?: number;
    temperature?: number;
    tds?: number;
    dissolvedOxygen?: number;
    symptomCases?: number;
    rainfallMm?: number;
    save?: boolean;
  }) => {
    setLoading(true);
    try {
      const zId = customParams?.zoneId ?? selectedZoneId;
      const zObj = zones.find((z) => String(z.id) === String(zId));

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone_id: zObj ? zObj.id : null,
          zone_name: zObj ? zObj.name : "Custom Water Scenario",
          ph: customParams?.ph ?? ph,
          turbidity: customParams?.turbidity ?? turbidity,
          temperature: customParams?.temperature ?? temperature,
          tds: customParams?.tds ?? tds,
          dissolved_oxygen: customParams?.dissolvedOxygen ?? dissolvedOxygen,
          symptom_cases_7d: customParams?.symptomCases ?? symptomCases,
          rainfall_mm: customParams?.rainfallMm ?? rainfallMm,
          save_record: customParams?.save ?? false,
        }),
      });
      if (res.ok) {
        const data: PredictionResponse = await res.json();
        setPrediction(data);
        if (customParams?.save) {
          onRefreshDashboard();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialZone) {
      setSelectedZoneId(String(initialZone.id));
      const newPh = initialZone.latest_water?.ph ?? 7.2;
      const newTurb = initialZone.latest_water?.turbidity ?? 2.0;
      const newTemp = initialZone.latest_water?.temperature ?? 26.0;
      const newTds = initialZone.latest_water?.tds ?? 260;
      const newDo = initialZone.latest_water?.dissolved_oxygen ?? 7.0;
      const newCases = initialZone.symptom_cases_active ?? 0;

      setPh(newPh);
      setTurbidity(newTurb);
      setTemperature(newTemp);
      setTds(newTds);
      setDissolvedOxygen(newDo);
      setSymptomCases(newCases);

      if (initialZone.latest_water) {
        runPrediction({
          zoneId: String(initialZone.id),
          ph: newPh,
          turbidity: newTurb,
          temperature: newTemp,
          tds: newTds,
          dissolvedOxygen: newDo,
          symptomCases: newCases,
        });
      }
    }
  }, [initialZone]);

  const applyZonePreset = (zId: string) => {
    setSelectedZoneId(zId);
    const z = zones.find((item) => String(item.id) === zId);
    if (z && z.latest_water) {
      setPh(z.latest_water.ph);
      setTurbidity(z.latest_water.turbidity);
      setTemperature(z.latest_water.temperature);
      setTds(z.latest_water.tds);
      setDissolvedOxygen(z.latest_water.dissolved_oxygen);
      setSymptomCases(z.symptom_cases_active);
      runPrediction({
        zoneId: zId,
        ph: z.latest_water.ph,
        turbidity: z.latest_water.turbidity,
        temperature: z.latest_water.temperature,
        tds: z.latest_water.tds,
        dissolvedOxygen: z.latest_water.dissolved_oxygen,
        symptomCases: z.symptom_cases_active,
      });
    }
  };

  const riskStyle =
    RISK_BADGE_STYLES[prediction?.predicted_risk_level || "Low"];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Disease Risk Predictor & 7-Day Forecast
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Adjust the sliders to test water quality scenarios and see the predicted disease risk and 7-day trend.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 5 Columns: Easy Sliders & Presets */}
        <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 lg:col-span-5">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="text-base font-semibold text-zinc-100">
              Water & Health Conditions
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              Pick a location or try one of the preset scenarios below.
            </p>

            {/* Quick Scenario Buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPh(7.2);
                  setTurbidity(1.5);
                  setTemperature(25);
                  setTds(220);
                  setDissolvedOxygen(7.5);
                  setSymptomCases(0);
                  setRainfallMm(5);
                  runPrediction({
                    ph: 7.2,
                    turbidity: 1.5,
                    temperature: 25,
                    tds: 220,
                    dissolvedOxygen: 7.5,
                    symptomCases: 0,
                    rainfallMm: 5,
                  });
                }}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Test Clean Water Scenario
              </button>
              <button
                type="button"
                onClick={() => {
                  setPh(5.7);
                  setTurbidity(16.0);
                  setTemperature(30);
                  setTds(880);
                  setDissolvedOxygen(3.0);
                  setSymptomCases(24);
                  setRainfallMm(65);
                  runPrediction({
                    ph: 5.7,
                    turbidity: 16.0,
                    temperature: 30,
                    tds: 880,
                    dissolvedOxygen: 3.0,
                    symptomCases: 24,
                    rainfallMm: 65,
                  });
                }}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
              >
                Test High-Risk Outbreak Scenario
              </button>
            </div>
          </div>

          {zones.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Load Values from Location
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => applyZonePreset(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Easy Sliders */}
          <div className="space-y-4">
            {[
              {
                label: "pH Level (Acidity / Alkalinity)",
                val: ph,
                set: setPh,
                min: 4.5,
                max: 10.0,
                step: 0.1,
                unit: "",
                safe: "Safe: 6.5 – 8.5",
              },
              {
                label: "Water Cloudiness (Turbidity)",
                val: turbidity,
                set: setTurbidity,
                min: 0.2,
                max: 25.0,
                step: 0.2,
                unit: " NTU",
                safe: "Safe: under 5 NTU",
              },
              {
                label: "Dissolved Solids (TDS)",
                val: tds,
                set: setTds,
                min: 50,
                max: 1500,
                step: 10,
                unit: " mg/L",
                safe: "Safe: under 500 mg/L",
              },
              {
                label: "Dissolved Oxygen",
                val: dissolvedOxygen,
                set: setDissolvedOxygen,
                min: 1.0,
                max: 11.0,
                step: 0.1,
                unit: " mg/L",
                safe: "Safe: above 5 mg/L",
              },
              {
                label: "Reported Illness Cases (Last 7 Days)",
                val: symptomCases,
                set: setSymptomCases,
                min: 0,
                max: 100,
                step: 1,
                unit: " cases",
                safe: "0 is ideal",
              },
              {
                label: "Recent Rainfall",
                val: rainfallMm,
                set: setRainfallMm,
                min: 0,
                max: 120,
                step: 2,
                unit: " mm",
                safe: "Heavy rain increases runoff risk",
              },
            ].map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-zinc-200">
                    {item.label}
                  </span>
                  <span className="font-semibold tabular-nums text-zinc-100">
                    {item.val}
                    {item.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.val}
                  onChange={(e) => item.set(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-zinc-100"
                />
                <div className="text-xs text-zinc-400">{item.safe}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => runPrediction({ save: false })}
              disabled={loading}
              className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {loading ? "Checking Risk..." : "Check Risk Now"}
            </button>
            <button
              type="button"
              onClick={() => runPrediction({ save: true })}
              disabled={loading || zones.length === 0}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
            >
              Save Result to Location
            </button>
          </div>
        </div>

        {/* Right 7 Columns: Clear Prediction Results */}
        <div className="space-y-6 lg:col-span-7">
          {!prediction ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
              <h3 className="text-lg font-semibold text-zinc-100">
                Ready to Check Disease Risk
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                Click{" "}
                <strong className="text-zinc-200">Check Risk Now</strong> (or one of the scenario buttons on the left) to see the predicted disease risk level, what’s causing it, and a 7-day forecast.
              </p>
              <button
                type="button"
                onClick={() => runPrediction({ save: false })}
                className="mt-5 rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
              >
                Check Current Values →
              </button>
            </div>
          ) : (
            <>
              {/* Big, Easy-to-Read Risk Summary Banner */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Predicted Outbreak Risk for {prediction.zone_name}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span
                        className={`text-3xl font-bold ${riskStyle.text}`}
                      >
                        {prediction.predicted_risk_level} Risk
                      </span>
                      <span className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-lg font-semibold tabular-nums text-zinc-100">
                        {prediction.risk_score} / 100
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs">
                    <div className="text-zinc-400">Water Sensor Check</div>
                    <div
                      className={`mt-0.5 font-semibold ${
                        prediction.is_anomaly
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {prediction.is_anomaly
                        ? "Unusual / Contaminated Reading"
                        : "Within Normal Range"}
                    </div>
                  </div>
                </div>

                {/* Recommended Next Steps & Potential Illnesses */}
                <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">
                      Recommended Actions
                    </h4>
                    <ul className="mt-2.5 space-y-2 text-sm text-zinc-300">
                      {prediction.recommended_actions.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">
                      Possible Waterborne Risks
                    </h4>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {prediction.likely_pathogens.map((pathogen) => (
                        <span
                          key={pathogen}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200"
                        >
                          {pathogen}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7-Day Forecast */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h3 className="text-base font-semibold text-zinc-100">
                  7-Day Disease Risk Forecast
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Compares expected risk if no action is taken vs. if water treatment (chlorination) is applied.
                </p>

                <div className="mt-5 grid grid-cols-7 gap-2.5">
                  {prediction.forecast_7d.map((pt) => {
                    const barColor =
                      pt.predicted_score >= 75
                        ? "bg-red-500"
                        : pt.predicted_score >= 55
                        ? "bg-amber-400"
                        : "bg-zinc-300";
                    return (
                      <div
                        key={pt.day}
                        className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                      >
                        <div className="text-xs font-medium text-zinc-400">
                          {pt.day}
                        </div>
                        <div className="my-3 flex h-28 w-full items-end justify-center gap-1.5">
                          <div
                            className={`w-3 rounded-t ${barColor}`}
                            style={{
                              height: `${Math.max(8, pt.predicted_score)}%`,
                            }}
                            title={`Without action: ${pt.predicted_score}%`}
                          />
                          <div
                            className="w-3 rounded-t bg-emerald-500/60"
                            style={{
                              height: `${Math.max(6, pt.mitigated_score)}%`,
                            }}
                            title={`With water treatment: ${pt.mitigated_score}%`}
                          />
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-zinc-100">
                          {pt.predicted_score}%
                        </div>
                        <div className="text-[11px] tabular-nums text-emerald-400">
                          {pt.mitigated_score}% treated
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Parameter Breakdown Table */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
                <div className="border-b border-zinc-800 p-5">
                  <h3 className="text-base font-semibold text-zinc-100">
                    Why Was This Risk Score Given?
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Shows how each water parameter compares against safe drinking water standards.
                  </p>
                </div>

                <div className="divide-y divide-zinc-800">
                  {prediction.explanations.map((exp) => (
                    <div
                      key={exp.parameter}
                      className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-zinc-100">
                            {exp.parameter}
                          </span>
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200">
                            Current: {exp.value}
                          </span>
                          <span className="text-xs text-zinc-400">
                            (Standard: {exp.threshold})
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          {exp.reason}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
                          exp.status === "Critical"
                            ? "bg-red-500/15 text-red-300"
                            : exp.status === "Warning"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {exp.status === "Optimal" ? "Safe" : exp.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
