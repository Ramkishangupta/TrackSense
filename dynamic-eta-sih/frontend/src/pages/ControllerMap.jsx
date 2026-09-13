// frontend/src/pages/ControllerMap.jsx
// ======================================
// Phase 5 — Controller Dashboard: 3D live map + H3 congestion heatmap.
//
// MapLibre GL JS renders the dark base map and train markers.
// Deck.gl H3HexagonLayer renders the congestion heatmap on top.
// Data flows in via the useTrainSocket hook (passed as props from App.jsx).

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DeckGL }           from "@deck.gl/react";
import { H3HexagonLayer }   from "@deck.gl/geo-layers";
import axios                from "axios";
import { AlertTriangle, RefreshCw, Layers, Train } from "lucide-react";
import { statusHexColor, statusLabel, formatDelay, formatTime, congestionRGBA } from "../utils/statusHelpers";

const NODE_URL   = import.meta.env.VITE_NODE_URL   || "http://localhost:5000";
// Carto Dark Matter — free, no API key required
const MAP_STYLE  = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// CNB (Kanpur Central) — default map centre
const INITIAL_VIEW = { longitude: 79.5, latitude: 26.8, zoom: 6.5, pitch: 40, bearing: 0 };

// ── Train marker HTML element factory ────────────────────────────────────────
function makeMarkerEl(color) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:18px;height:18px;cursor:pointer;";

  // Pulsing ring
  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;inset:0;border-radius:50%;
    background:${color};opacity:0.35;
    animation:pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite;
  `;

  // Solid dot
  const dot = document.createElement("div");
  dot.style.cssText = `
    position:absolute;inset:3px;border-radius:50%;
    background:${color};
    box-shadow:0 0 8px 2px ${color}80;
  `;

  wrap.appendChild(ring);
  wrap.appendChild(dot);
  return wrap;
}

// ── Legend ────────────────────────────────────────────────────────────────────
function MapLegend({ trainCount, congestionCount }) {
  return (
    <div className="glass-panel p-4 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Legend</p>
      <div className="space-y-2 text-xs">
        {[
          { color: "#10B981", label: "On Time"       },
          { color: "#F59E0B", label: "Minor Delay"   },
          { color: "#F97316", label: "Moderate Delay"},
          { color: "#F43F5E", label: "Major Delay"   },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 text-xs text-slate-400">
        <p><span className="text-blue-400 font-mono">{trainCount}</span> active trains</p>
        <p><span className="text-amber-400 font-mono">{congestionCount}</span> congested cells</p>
      </div>
    </div>
  );
}

// ── Train Info Popup ──────────────────────────────────────────────────────────
function TrainPopup({ train, onClose }) {
  if (!train) return null;
  const color = statusHexColor(train.status);
  return (
    <div className="glass-panel p-4 min-w-[220px] fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Train size={14} style={{ color }} />
          <span className="font-mono text-sm font-semibold" style={{ color }}>
            {train.train_no}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
      </div>
      <p className="text-sm text-slate-200 font-medium mb-3 leading-tight">{train.train_name}</p>
      <div className="space-y-1.5 text-xs">
        <Row label="Status"   value={statusLabel(train.status)} valueStyle={{ color }} />
        <Row label="Delay"    value={formatDelay(train.delay_minutes)} />
        <Row label="Speed"    value={`${train.current_speed?.toFixed(0) ?? 0} km/h`} />
        <Row label="ETA"      value={train.total_eta_min != null ? `${Math.round(train.total_eta_min)} min` : "—"} />
        <Row label="Arrival"  value={formatTime(train.expected_arrival)} />
        {train.anomaly_event && train.anomaly_event !== "none" && (
          <Row label="Event"  value={train.anomaly_event.replace(/_/g, " ")} valueStyle={{ color: "#F43F5E" }} />
        )}
        {train.congestion_count > 1 && (
          <Row label="Congestion" value={`${train.congestion_count} trains in cell`} valueStyle={{ color: "#F59E0B" }} />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueStyle }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200 text-right" style={valueStyle}>{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ControllerMap({ trains, connected, lastUpdate, refreshNow }) {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});            // trainId → { marker, el }
  const [congestion, setCongestion]     = useState([]);
  const [selectedTrain, setSelected]   = useState(null);
  const [showHexLayer, setShowHex]     = useState(true);
  const [viewState, setViewState]      = useState(INITIAL_VIEW);

  // ── Boot MapLibre ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:     MAP_STYLE,
      center:    [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
      zoom:      INITIAL_VIEW.zoom,
      pitch:     INITIAL_VIEW.pitch,
      bearing:   INITIAL_VIEW.bearing,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Sync Deck.gl viewState when user pans/zooms MapLibre
    map.on("move", () => {
      const c = map.getCenter();
      setViewState({
        longitude: c.lng,
        latitude:  c.lat,
        zoom:      map.getZoom(),
        pitch:     map.getPitch(),
        bearing:   map.getBearing(),
      });
    });

    return () => {
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Update train markers whenever live data arrives ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || trains.length === 0) return;

    const activeIds = new Set(trains.map(t => t.train_id));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(Number(id))) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
      }
    });

    trains.forEach(train => {
      if (!train.current_lat || !train.current_lng) return;
      const color = statusHexColor(train.status);
      const id    = train.train_id;

      if (markersRef.current[id]) {
        // Move existing marker smoothly
        markersRef.current[id].marker.setLngLat([train.current_lng, train.current_lat]);
        // Update colour if status changed
        const dot = markersRef.current[id].el.querySelector("div:last-child");
        const ring = markersRef.current[id].el.querySelector("div:first-child");
        if (dot)  { dot.style.background  = color; dot.style.boxShadow = `0 0 8px 2px ${color}80`; }
        if (ring) { ring.style.background = color; }
      } else {
        // Create new marker
        const el = makeMarkerEl(color);
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([train.current_lng, train.current_lat])
          .addTo(map);

        el.addEventListener("click", () => setSelected(train));
        markersRef.current[id] = { marker, el };
      }
    });
  }, [trains]);

  // Update selected train popup data when new train_updates arrive
  useEffect(() => {
    if (!selectedTrain) return;
    const updated = trains.find(t => t.train_id === selectedTrain.train_id);
    if (updated) setSelected(updated);
  }, [trains]);

  // ── Fetch congestion for Deck.gl ─────────────────────────────────────────
  useEffect(() => {
    async function fetchCongestion() {
      try {
        const { data } = await axios.get(`${NODE_URL}/api/congestion`);
        setCongestion(data.cells || []);
      } catch (_) { /* silently degrade */ }
    }
    fetchCongestion();
    const id = setInterval(fetchCongestion, 6000);
    return () => clearInterval(id);
  }, []);

  // ── Deck.gl H3HexagonLayer ────────────────────────────────────────────────
  const deckLayers = showHexLayer && congestion.length > 0
    ? [new H3HexagonLayer({
        id:            "congestion-h3",
        data:          congestion,
        getHexagon:    d => d.h3_index,
        getFillColor:  d => congestionRGBA(d.severity),
        getElevation:  d => d.train_count * 3000,
        extruded:      true,
        elevationScale: 1,
        opacity:       0.55,
        pickable:      true,
        updateTriggers: { data: congestion },
      })]
    : [];

  return (
    <div className="relative w-full h-full bg-slate-950">
      {/* MapLibre container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Deck.gl overlay — controller is false so MapLibre owns the camera */}
      <DeckGL
        viewState={viewState}
        layers={deckLayers}
        controller={false}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Top-left controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        {/* Header card */}
        <div className="glass-panel px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-white">Controller Map</p>
              <p className="text-[10px] text-slate-400">
                {connected
                  ? `${trains.length} trains live · updated ${lastUpdate ? formatTime(lastUpdate) : "—"}`
                  : "⚠ WebSocket offline"}
              </p>
            </div>
            <button
              onClick={refreshNow}
              title="Force refresh"
              className="ml-2 p-1.5 rounded-lg bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* H3 layer toggle */}
        <button
          onClick={() => setShowHex(v => !v)}
          className={`glass-panel px-3 py-2 flex items-center gap-2 text-xs font-medium transition-colors ${
            showHexLayer ? "text-amber-400 border-amber-500/40" : "text-slate-400"
          }`}
        >
          <Layers size={13} />
          H3 Heatmap {showHexLayer ? "ON" : "OFF"}
        </button>

        {/* Train popup */}
        {selectedTrain && (
          <TrainPopup train={selectedTrain} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* Bottom-right legend */}
      <div className="absolute bottom-6 right-4 z-10">
        <MapLegend trainCount={trains.length} congestionCount={congestion.length} />
      </div>

      {/* Offline warning banner */}
      {!connected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-rose-900/80 border border-rose-500/50 text-rose-300 px-4 py-2 rounded-full text-xs backdrop-blur-sm">
          <AlertTriangle size={13} />
          WebSocket disconnected — showing last known positions
        </div>
      )}
    </div>
  );
}
