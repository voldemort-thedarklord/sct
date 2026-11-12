"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as LeafletType from "leaflet";
import { CommunityZone, RISK_BADGE_STYLES } from "../types";

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || "";

type MapStyleId = "voyager" | "dark" | "osm";

const MAP_TILE_STYLES: Record<
  MapStyleId,
  { label: string; url: string; attribution: string }
> = {
  voyager: {
    label: "Clear Map",
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  dark: {
    label: "Dark Map",
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  osm: {
    label: "Street Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

interface RiskMapProps {
  zones: CommunityZone[];
  onSimulateZone?: (zone: CommunityZone) => void;
  compact?: boolean;
}

export default function RiskMap({
  zones,
  onSimulateZone,
  compact = false,
}: RiskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const tileLayerRef = useRef<LeafletType.TileLayer | null>(null);
  const layerGroupRef = useRef<LeafletType.LayerGroup | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyleId>("voyager");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>("All");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(
    zones[0]?.id ?? null
  );

  const selectedZone =
    zones.find((z) => z.id === selectedZoneId) || zones[0] || null;

  const filteredZones =
    selectedRiskFilter === "All"
      ? zones
      : zones.filter((z) => z.current_risk_level === selectedRiskFilter);

  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function renderMap() {
      if (!mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      // Initialize map instance once
      if (!mapInstanceRef.current) {
        const containerEl = mapContainerRef.current as HTMLDivElement & {
          _leaflet_id?: number | null;
        };
        if (containerEl._leaflet_id) {
          containerEl._leaflet_id = null;
        }

        const defaultCenter: [number, number] =
          zones.length === 1
            ? [zones[0].latitude, zones[0].longitude]
            : [21.5, 79.0];

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: zones.length === 1 ? 11 : compact ? 4 : 5,
          zoomControl: true,
        });

        const styleConfig = MAP_TILE_STYLES[mapStyle];
        tileLayerRef.current = L.tileLayer(styleConfig.url, {
          attribution: styleConfig.attribution,
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        // Ensure tiles fill the container even after tab transitions
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 120);

        if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize();
            }
          });
          resizeObserver.observe(mapContainerRef.current);
        }
      }

      // Always ensure the active tile layer uses the latest URL with ?key=
      if (mapInstanceRef.current) {
        const styleConfig = MAP_TILE_STYLES[mapStyle];
        if (!tileLayerRef.current) {
          mapInstanceRef.current.eachLayer((layer: LeafletType.Layer) => {
            if (layer instanceof L.TileLayer) {
              mapInstanceRef.current?.removeLayer(layer);
            }
          });
          tileLayerRef.current = L.tileLayer(styleConfig.url, {
            attribution: styleConfig.attribution,
            subdomains: "abcd",
            maxZoom: 19,
          }).addTo(mapInstanceRef.current);
        } else {
          tileLayerRef.current.setUrl(styleConfig.url);
        }
      }

      const LGroup = layerGroupRef.current;
      if (!LGroup) return;
      LGroup.clearLayers();

      filteredZones.forEach((zone) => {
        const markerColor =
          zone.current_risk_level === "Critical"
            ? "#EF4444"
            : zone.current_risk_level === "High"
            ? "#F59E0B"
            : zone.current_risk_level === "Moderate"
            ? "#3B82F6"
            : "#10B981";

        const radiusMeters =
          zone.current_risk_level === "Critical"
            ? 16000
            : zone.current_risk_level === "High"
            ? 12000
            : zone.current_risk_level === "Moderate"
            ? 9000
            : 6000;

        const circle = L.circle([zone.latitude, zone.longitude], {
          color: markerColor,
          weight: selectedZone?.id === zone.id ? 3 : 2,
          fillColor: markerColor,
          fillOpacity: selectedZone?.id === zone.id ? 0.3 : 0.18,
          radius: radiusMeters,
        });

        const coreMarker = L.circleMarker([zone.latitude, zone.longitude], {
          radius: selectedZone?.id === zone.id ? 9 : 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 1,
        });

        const popupHtml = `
          <div style="min-width: 210px; padding: 4px; font-family: inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:11px; color:#A1A1AA;">${zone.district}</span>
              <span style="font-size:11px; font-weight:700; color:${markerColor};">
                ${zone.current_risk_level} Risk (${zone.current_risk_score}%)
              </span>
            </div>
            <div style="font-weight:600; font-size:13px; color:#F4F4F5; margin-bottom:2px;">${zone.name}</div>
            <div style="font-size:11px; color:#A1A1AA; margin-bottom:8px;">${zone.water_source_type}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px; border-top:1px solid #27272A; padding-top:6px;">
              <div><span style="color:#A1A1AA;">pH:</span> ${zone.latest_water?.ph ?? "—"}</div>
              <div><span style="color:#A1A1AA;">Cloudiness:</span> ${zone.latest_water?.turbidity ?? "—"} NTU</div>
              <div><span style="color:#A1A1AA;">TDS:</span> ${zone.latest_water?.tds ?? "—"} mg/L</div>
              <div><span style="color:#A1A1AA;">Cases:</span> ${zone.symptom_cases_active}</div>
            </div>
          </div>
        `;

        circle.bindPopup(popupHtml);
        coreMarker.bindPopup(popupHtml);

        const handleSelect = () => setSelectedZoneId(zone.id);
        circle.on("click", handleSelect);
        coreMarker.on("click", handleSelect);

        circle.addTo(LGroup);
        coreMarker.addTo(LGroup);
      });
    }

    renderMap();
    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [filteredZones, selectedZone, compact, zones, mapStyle]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const focusZoneOnMap = (zone: CommunityZone) => {
    setSelectedZoneId(zone.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([zone.latitude, zone.longitude], 12, {
        duration: 0.5,
      });
    }
  };

  if (compact) {
    return (
      <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <div ref={mapContainerRef} className="h-full w-full" />
        {/* Map Style Switcher */}
        <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950/90 p-1 text-xs">
          {(["voyager", "dark", "osm"] as MapStyleId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMapStyle(id)}
              className={`rounded px-2 py-1 font-medium transition ${
                mapStyle === id
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              {MAP_TILE_STYLES[id].label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-200">Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-zinc-200">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-zinc-200">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-zinc-200">Critical</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header & Filter Tabs */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Community Risk Map
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Click any location pin or item in the list to inspect water safety and reported illness cases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Map Style Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
            {(["voyager", "dark", "osm"] as MapStyleId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMapStyle(id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  mapStyle === id
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {MAP_TILE_STYLES[id].label}
              </button>
            ))}
          </div>

          {/* Risk Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
            {["All", "Critical", "High", "Moderate", "Low"].map((lvl) => {
              const active = selectedRiskFilter === lvl;
              const count =
                lvl === "All"
                  ? zones.length
                  : zones.filter((z) => z.current_risk_level === lvl).length;
              return (
                <button
                  key={lvl}
                  onClick={() => setSelectedRiskFilter(lvl)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {lvl} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Split Map & Location Details */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 lg:grid-cols-12">
        {/* Left 8 Cols: Interactive Map */}
        <div className="relative h-[540px] border-b border-zinc-800 lg:col-span-8 lg:border-r lg:border-b-0">
          <div ref={mapContainerRef} className="h-full w-full" />
          <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-lg border border-zinc-700 bg-zinc-950/90 px-3.5 py-2 text-xs">
            <div className="mb-1 font-medium text-zinc-400">Risk Levels</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-200">Low</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-zinc-200">Moderate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-zinc-200">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-zinc-200">Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Selected Location Info */}
        <div className="flex flex-col justify-between divide-y divide-zinc-800 lg:col-span-4">
          {selectedZone ? (
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    {selectedZone.district}
                  </div>
                  <h3 className="mt-0.5 text-lg font-semibold text-zinc-100">
                    {selectedZone.name}
                  </h3>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {selectedZone.water_source_type}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-sm font-semibold ${
                      RISK_BADGE_STYLES[selectedZone.current_risk_level].text
                    }`}
                  >
                    {selectedZone.current_risk_level} Risk
                  </div>
                  <div className="text-xl font-bold tabular-nums text-zinc-100">
                    {selectedZone.current_risk_score}%
                  </div>
                </div>
              </div>

              <div className="mt-5 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-400">Population Served</span>
                  <span className="font-medium tabular-nums text-zinc-200">
                    {selectedZone.population.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-400">pH / Cloudiness</span>
                  <span className="font-medium tabular-nums text-zinc-200">
                    {selectedZone.latest_water?.ph ?? "—"} pH ·{" "}
                    {selectedZone.latest_water?.turbidity ?? "—"} NTU
                  </span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-400">TDS / Dissolved Oxygen</span>
                  <span className="font-medium tabular-nums text-zinc-200">
                    {selectedZone.latest_water?.tds ?? "—"} mg/L ·{" "}
                    {selectedZone.latest_water?.dissolved_oxygen ?? "—"} mg/L
                  </span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-400">Reported Illness Cases</span>
                  <span className="font-semibold tabular-nums text-zinc-100">
                    {selectedZone.symptom_cases_active} cases
                  </span>
                </div>
              </div>

              {onSimulateZone && (
                <button
                  onClick={() => onSimulateZone(selectedZone)}
                  className="mt-5 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                >
                  Check 7-Day Forecast →
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 text-sm text-zinc-400">
              No locations added yet. Add a location in{" "}
              <strong className="text-zinc-200">Log &amp; Report</strong> to view it on the map.
            </div>
          )}

          {/* Location List */}
          <div className="flex-1 overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-2.5 text-xs font-medium text-zinc-400">
              All Locations ({filteredZones.length})
            </div>
            <div className="max-h-[220px] divide-y divide-zinc-800 overflow-y-auto">
              {filteredZones.map((z) => {
                const isSelected = selectedZone?.id === z.id;
                const badge = RISK_BADGE_STYLES[z.current_risk_level];
                return (
                  <button
                    key={z.id}
                    onClick={() => focusZoneOnMap(z)}
                    className={`flex w-full items-center justify-between px-6 py-3 text-left transition ${
                      isSelected ? "bg-zinc-800/80" : "hover:bg-zinc-900"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {z.name}
                      </div>
                      <div className="text-xs text-zinc-400">{z.district}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums">
                      <span className={badge.text}>{z.current_risk_level}</span>
                      <span className="text-zinc-400">
                        ({z.current_risk_score}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
