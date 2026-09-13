// frontend/src/pages/PassengerApp.jsx
// =====================================
// Phase 5 — Passenger-facing view (light theme).
// Search by train number → show full delay card with live ETA countdown.

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Search, Train, Clock, MapPin, AlertCircle, Wifi, WifiOff, ChevronRight } from "lucide-react";
import { statusColorClass, statusLabel, formatDelay, formatTime } from "../utils/statusHelpers";

const NODE_URL = import.meta.env.VITE_NODE_URL || "http://localhost:5000";

// ── Delay severity colour for the passenger view (uses Tailwind bg classes)
function delayBgClass(status) {
  switch (status) {
    case "ON_TIME":        return "bg-emerald-50  border-emerald-200";
    case "MINOR_DELAY":    return "bg-amber-50    border-amber-200";
    case "MODERATE_DELAY": return "bg-orange-50   border-orange-200";
    case "MAJOR_DELAY":    return "bg-rose-50     border-rose-200";
    default:               return "bg-gray-50     border-gray-200";
  }
}

function delayTextClass(status) {
  switch (status) {
    case "ON_TIME":        return "text-emerald-700";
    case "MINOR_DELAY":    return "text-amber-700";
    case "MODERATE_DELAY": return "text-orange-700";
    case "MAJOR_DELAY":    return "text-rose-700";
    default:               return "text-gray-600";
  }
}

// ── ETA detail card ──────────────────────────────────────────────────────────
function EtaCard({ train }) {
  const bgCls   = delayBgClass(train.status);
  const txtCls  = delayTextClass(train.status);

  return (
    <div className={`rounded-2xl border p-5 fade-in ${bgCls}`}>
      {/* Train identity */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Train size={16} className={txtCls} />
            <span className={`font-mono text-lg font-bold ${txtCls}`}>{train.train_no}</span>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {train.train_type}
            </span>
          </div>
          <p className="text-gray-800 font-semibold text-base leading-tight">{train.train_name}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${bgCls} ${txtCls}`}>
          {statusLabel(train.status)}
        </span>
      </div>

      {/* Big delay number */}
      <div className={`text-center py-4 rounded-xl bg-white/60 border ${bgCls} mb-4`}>
        <p className={`text-5xl font-bold font-mono ${txtCls}`}>
          {train.delay_minutes > 0 ? `+${train.delay_minutes}` : "0"}
        </p>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">minutes delay</p>
      </div>

      {/* Detail rows */}
      <div className="space-y-2.5">
        <DetailRow icon={<Clock size={14} />}   label="Expected Arrival" value={formatTime(train.expected_arrival)} mono />
        <DetailRow icon={<MapPin size={14} />}   label="Destination"      value="Kanpur Central (CNB)" />
        <DetailRow icon={<Train size={14} />}    label="Current Speed"    value={`${Math.round(train.current_speed ?? 0)} km/h`} mono />
        {train.total_eta_min != null && (
          <DetailRow icon={<Clock size={14} />}  label="ETA to Station"   value={`${Math.round(train.total_eta_min)} min`} mono />
        )}
      </div>

      {/* Active anomaly notice */}
      {train.anomaly_event && train.anomaly_event !== "none" && (
        <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-rose-700">Active Disruption</p>
            <p className="text-xs text-rose-600 mt-0.5">
              {train.anomaly_event.replace(/_/g, " ")} — adds additional delay.
              {train.anomaly_penalty_min > 0 && ` (+${train.anomaly_penalty_min} min applied)`}
            </p>
          </div>
        </div>
      )}

      {/* Congestion notice */}
      {train.congestion_count > 1 && (
        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-700">Network Congestion</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {train.congestion_count} trains in same track zone.
              {train.congestion_penalty_min > 0 && ` (+${train.congestion_penalty_min} min applied)`}
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-right mt-4">
        AI-powered ETA · last updated {formatTime(train.recorded_at)}
      </p>
    </div>
  );
}

function DetailRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-gray-500 flex-1">{label}</span>
      <span className={`font-medium text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ── Search suggestion pill ────────────────────────────────────────────────────
function SuggestionPill({ train, onClick }) {
  const cls = {
    ON_TIME:        "border-emerald-200 text-emerald-700 bg-emerald-50",
    MINOR_DELAY:    "border-amber-200   text-amber-700   bg-amber-50",
    MODERATE_DELAY: "border-orange-200  text-orange-700  bg-orange-50",
    MAJOR_DELAY:    "border-rose-200    text-rose-700    bg-rose-50",
  }[train.status] ?? "border-gray-200 text-gray-600 bg-white";

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-3 w-full px-4 py-3 border rounded-xl text-sm font-medium hover:shadow-sm transition-all ${cls}`}
    >
      <span className="flex items-center gap-2">
        <Train size={13} />
        <span className="font-mono font-bold">{train.train_no}</span>
        <span className="text-xs font-normal opacity-70">{train.train_name}</span>
      </span>
      <span className="flex items-center gap-1 text-xs opacity-80">
        {formatDelay(train.delay_minutes)}
        <ChevronRight size={12} />
      </span>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PassengerApp({ trains, connected }) {
  const [query,  setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoad]  = useState(false);
  const [error,  setError]  = useState("");

  // Filter suggestions from already-loaded trains (instant, no extra HTTP)
  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return trains.filter(t =>
      t.train_no?.toLowerCase().includes(q) ||
      t.train_name?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query, trains]);

  async function searchTrain(trainNo) {
    // Find the train_id from the already-received list
    const found = trains.find(t => t.train_no === trainNo);
    if (!found) {
      setError(`Train ${trainNo} not found in active trains.`);
      setResult(null);
      return;
    }
    setLoad(true);
    setError("");
    try {
      const { data } = await axios.get(`${NODE_URL}/api/trains/${found.train_id}/eta`);
      // Merge live location from socket with fresh ETA from REST
      setResult({ ...found, ...data });
    } catch (_) {
      // Fallback to socket data if REST fails
      setResult(found);
      setError("ETA service offline — showing last known data.");
    } finally {
      setLoad(false);
    }
  }

  function handleSelect(train) {
    setQuery(train.train_no);
    searchTrain(train.train_no);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    searchTrain(query.trim());
  }

  // Live-update the displayed result when socket pushes new data
  useEffect(() => {
    if (!result) return;
    const updated = trains.find(t => t.train_id === result.train_id);
    if (updated) setResult(prev => ({ ...prev, ...updated }));
  }, [trains]);

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white px-6 pt-10 pb-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            {connected
              ? <Wifi size={13} className="text-blue-300" />
              : <WifiOff size={13} className="text-rose-300" />}
            <span className="text-xs text-blue-300">
              {connected ? "Live tracking active" : "Offline — last known data"}
            </span>
          </div>
          <h1 className="text-2xl font-bold mt-2">Track Your Train</h1>
          <p className="text-blue-200 text-sm mt-1">
            Real-time ETA powered by AI — enter your train number below.
          </p>
        </div>
      </div>

      {/* Search card (overlaps hero) */}
      <div className="max-w-lg mx-auto w-full px-4 -mt-8 flex flex-col gap-4 pb-10">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex gap-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
            <Search size={18} className="text-gray-400 self-center ml-2 shrink-0" />
            <input
              type="text"
              placeholder="Enter train number (e.g. 12004) or name…"
              value={query}
              onChange={e => { setQuery(e.target.value); setResult(null); setError(""); }}
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent py-2"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? "…" : "Track"}
            </button>
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && !result && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-20 space-y-1">
              {suggestions.map(t => (
                <SuggestionPill key={t.train_id} train={t} onClick={() => handleSelect(t)} />
              ))}
            </div>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && <EtaCard train={result} />}

        {/* All delayed trains quick-access (when no search active) */}
        {!result && !query && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Delayed Trains Right Now
            </p>
            <div className="space-y-2">
              {trains
                .filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN")
                .sort((a, b) => (b.delay_minutes ?? 0) - (a.delay_minutes ?? 0))
                .slice(0, 6)
                .map(t => (
                  <SuggestionPill key={t.train_id} train={t} onClick={() => handleSelect(t)} />
                ))
              }
              {trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN").length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  All trains are running on time 🎉
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
