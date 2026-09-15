// frontend/src/pages/PassengerApp.jsx
// =====================================
// Complete Redesign: Modern Mobile-First Railway App UI
// 
// Features:
// - Ticket/Journey style cards with soft shadows
// - Distinct pill badges for status
// - Prominent ETA and Speed (0 km/h if Arrived)
// - Yellow/Red warning banners for congestion or anomalies

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Search, Train, Clock, MapPin, AlertTriangle, Wifi, WifiOff,
  ChevronRight, ArrowRight, Gauge, CheckCircle2, X
} from "lucide-react";
import { formatTime } from "../utils/statusHelpers";

const NODE_URL = import.meta.env.VITE_NODE_URL || "http://localhost:5000";

// ── Shared UI Utilities ──────────────────────────────────────────────────────

function getStatusTheme(status) {
  switch (status) {
    case "ON_TIME":
      return { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle2 size={14}/>, label: "On Time" };
    case "MINOR_DELAY":
      return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", icon: <AlertTriangle size={14}/>, label: "Minor Delay" };
    case "MODERATE_DELAY":
      return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", icon: <AlertTriangle size={14}/>, label: "Moderate Delay" };
    case "MAJOR_DELAY":
      return { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", icon: <AlertTriangle size={14}/>, label: "Major Delay" };
    case "Arrived":
      return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", icon: <CheckCircle2 size={14}/>, label: "Arrived" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: <Clock size={14}/>, label: "Unknown" };
  }
}

// ── Search Suggestion Pill ────────────────────────────────────────────────────
function SuggestionPill({ train, onClick }) {
  const theme = getStatusTheme(train.status);
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors last:border-b-0"
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-lg tracking-tight">{train.train_no}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${theme.bg} ${theme.text}`}>
            {theme.label}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-500">{train.train_name}</span>
      </div>
      <ChevronRight size={20} className="text-slate-400" />
    </button>
  );
}

// ── Live Journey Card ─────────────────────────────────────────────────────────
function JourneyCard({ train }) {
  const theme = getStatusTheme(train?.status);
  const isArrived = train?.status === "Arrived";
  const speed = isArrived ? 0 : Math.round(train?.current_speed ?? 0);
  
  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden mx-4 fade-in">
      {/* Card Header */}
      <div className="bg-slate-50 px-6 py-5 border-b border-slate-100">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2 bg-slate-200/50 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase">
            <Train size={14} />
            {train?.train_type || "Train"}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${theme.bg} ${theme.text} ${theme.border}`}>
            {theme.icon}
            <span className="text-xs font-bold tracking-wide uppercase">{theme.label}</span>
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{train?.train_no || "---"}</h2>
        <p className="text-base font-semibold text-slate-500 mt-1">{train?.train_name || "Unknown Train"}</p>
      </div>

      {/* Primary Metrics (ETA & Delay) */}
      <div className="px-6 py-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Live ETA</span>
          {train?.total_eta_min != null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-800">{Math.round(train.total_eta_min)}</span>
              <span className="text-sm font-bold text-slate-500">mins</span>
            </div>
          ) : (
            <span className="text-xl font-bold text-slate-300">—</span>
          )}
        </div>
        
        <div className="w-px h-16 bg-slate-100"></div>

        <div className="flex flex-col text-right">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Delay</span>
          {isArrived ? (
            <span className="text-lg font-bold text-slate-800">Completed</span>
          ) : train?.delay_minutes > 0 ? (
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-black text-rose-500">+{train.delay_minutes}</span>
              <span className="text-sm font-bold text-slate-500">mins</span>
            </div>
          ) : (
            <span className="text-lg font-bold text-emerald-500">On Time</span>
          )}
        </div>
      </div>

      {/* Warning Banners */}
      {(train?.anomaly_event && train.anomaly_event !== "normal" && train.anomaly_event !== "none") && (
        <div className="mx-6 mb-4 bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-900">Active Disruption</p>
            <p className="text-xs font-medium text-rose-700 mt-1 leading-snug">
              {String(train.anomaly_event).replace(/_/g, " ")} reported. 
              {train.anomaly_penalty_min > 0 && ` (+${train.anomaly_penalty_min}m applied)`}
            </p>
          </div>
        </div>
      )}

      {train?.congestion_count > 1 && (
        <div className="mx-6 mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Network Congestion</p>
            <p className="text-xs font-medium text-amber-700 mt-1 leading-snug">
              {train.congestion_count} trains in current sector.
              {train.congestion_penalty_min > 0 && ` (+${train.congestion_penalty_min}m applied)`}
            </p>
          </div>
        </div>
      )}

      {/* Secondary Metrics */}
      <div className="bg-slate-50 border-t border-slate-100 p-6 grid grid-cols-2 gap-y-6">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={12}/> Arrival</p>
          <p className="text-sm font-bold text-slate-700">{formatTime(train?.expected_arrival)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Gauge size={12}/> Speed</p>
          <p className="text-sm font-bold text-slate-700">{speed} <span className="text-slate-400 text-xs">km/h</span></p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin size={12}/> Destination</p>
          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">Kanpur Central <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">CNB</span></p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PassengerApp({ trains, connected }) {
  const [query,  setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoad]  = useState(false);
  const [error,  setError]  = useState("");

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return trains.filter(t =>
      t.train_no?.toLowerCase().includes(q) ||
      t.train_name?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query, trains]);

  async function searchTrain(trainNo) {
    const found = trains.find(t => t.train_no === trainNo);
    if (!found) {
      setError(`Train ${trainNo} not found in active network.`);
      setResult(null);
      return;
    }
    setLoad(true);
    setError("");
    try {
      const { data } = await axios.get(`${NODE_URL}/api/trains/${found.train_id}/eta`);
      setResult({ ...found, ...data });
    } catch (_) {
      setResult(found);
      setError("ETA service unreachable. Showing last known telemetry.");
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

  useEffect(() => {
    if (!result) return;
    const updated = trains.find(t => t.train_id === result.train_id);
    if (updated) setResult(prev => ({ ...prev, ...updated }));
  }, [trains]);

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Mobile-constrained container */}
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-50 shadow-2xl relative flex flex-col overflow-hidden border-x border-slate-200">
        
        {/* Header / App Bar */}
        <div className="bg-white px-6 pt-10 pb-6 shadow-sm z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">TrackSense</h1>
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mt-1">Live Tracking</p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase ${connected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? "Live" : "Offline"}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative z-20">
            <div className="flex items-center gap-3 bg-slate-100 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
              <Search size={20} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Enter Train No. or Name"
                value={query}
                onChange={e => { setQuery(e.target.value); setResult(null); setError(""); }}
                className="flex-1 text-base font-medium text-slate-800 placeholder-slate-400 bg-transparent outline-none"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setResult(null); setError(""); }} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Floating Suggestions */}
            {suggestions.length > 0 && !result && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                {suggestions.map(t => (
                  <SuggestionPill key={t.train_id} train={t} onClick={() => handleSelect(t)} />
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-12 pt-6">
          {error && (
            <div className="mx-6 mb-6 flex items-start gap-3 bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-700">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {result ? (
            <JourneyCard train={result} />
          ) : (
            <div className="px-6">
              {!query && (
                <>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Delayed Network Traffic</h3>
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    {trains
                      .filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN" && t.status !== "Arrived")
                      .sort((a, b) => (b.delay_minutes ?? 0) - (a.delay_minutes ?? 0))
                      .slice(0, 5)
                      .map(t => (
                        <SuggestionPill key={t.train_id} train={t} onClick={() => handleSelect(t)} />
                      ))
                    }
                    {trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN" && t.status !== "Arrived").length === 0 && (
                      <div className="p-8 text-center">
                        <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
                        <p className="text-sm font-bold text-slate-600">All Trains on Time</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">No major delays reported.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
