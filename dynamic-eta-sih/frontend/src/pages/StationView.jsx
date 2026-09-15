// frontend/src/pages/StationView.jsx
// =====================================
// Phase 5 — Station Master Dashboard
// Tabular view of all 12 trains with live ETA updates.
// Sticky header, zebra striping, status badges, sort by delay.

import { useState, useMemo } from "react";
import { ArrowUpDown, RefreshCw, Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import {
  statusColorClass, statusLabel, formatDelay, formatTime,
} from "../utils/statusHelpers";

// ── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ON_TIME:        "bg-emerald-50 text-emerald-700 border-emerald-200",
    MINOR_DELAY:    "bg-amber-50 text-amber-700 border-amber-200",
    MODERATE_DELAY: "bg-orange-50 text-orange-700 border-orange-200",
    MAJOR_DELAY:    "bg-rose-50 text-rose-700 border-rose-200",
    Arrived:        "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wide uppercase ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {statusLabel(status)}
    </span>
  );
}

// ── Anomaly badge ─────────────────────────────────────────────────────────────
function AnomalyBadge({ event }) {
  if (!event || event === "none" || event === "normal") return <span className="text-slate-400">—</span>;
  const icons = {
    weather_fog:      "🌫",
    unscheduled_halt: "🛑",
    signal_halt:      "🚦",
    chain_pulling:    "⛓",
  };
  return (
    <span className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
      <span>{icons[event] ?? "⚠"}</span>
      <span className="capitalize">{String(event).replace(/_/g, " ")}</span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StationView({ trains, connected, lastUpdate, refreshNow }) {
  const [sortField, setSortField] = useState("delay_minutes");
  const [sortAsc,   setSortAsc]   = useState(false);

  function toggleSort(field) {
    if (sortField === field) { setSortAsc(v => !v); }
    else { setSortField(field); setSortAsc(false); }
  }

  const sorted = useMemo(() => {
    return [...trains].sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [trains, sortField, sortAsc]);

  // Summary stats
  const onTime   = trains.filter(t => t.status === "ON_TIME").length;
  const delayed  = trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN" && t.status !== "Arrived").length;
  const halted   = trains.filter(t => t.anomaly_event && !["none", "normal", null].includes(t.anomaly_event)).length;
  const maxDelay = Math.max(0, ...trains.map(t => t.status !== "Arrived" ? (t.delay_minutes || 0) : 0));

  function SortTh({ field, children }) {
    const active = sortField === field;
    return (
      <th
        className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-slate-800 transition-colors ${
          active ? "text-blue-600 bg-blue-50/50" : "text-slate-500"
        }`}
        onClick={() => toggleSort(field)}
      >
        <span className="flex items-center gap-1.5">
          {children}
          <ArrowUpDown size={12} className={active ? "text-blue-600" : "text-slate-400"} />
        </span>
      </th>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 gap-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Station Master Dashboard</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-2">
            Kanpur Central <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">CNB</span> — Live ETA Board
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
              <Clock size={14} className="text-slate-400"/>
              {formatTime(lastUpdate)}
            </span>
          )}
          <button
            onClick={refreshNow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="On Time"    value={onTime}   icon={CheckCircle}   color="bg-emerald-500" />
        <SummaryCard label="Delayed"    value={delayed}  icon={AlertTriangle} color="bg-rose-500"    />
        <SummaryCard label="w/ Events"  value={halted}   icon={AlertTriangle} color="bg-amber-500"   />
        <SummaryCard label="Max Delay"  value={`${maxDelay}m`} icon={TrendingUp} color="bg-blue-500" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <SortTh field="train_no">Train No</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Type</th>
              <SortTh field="current_speed">Speed</SortTh>
              <SortTh field="delay_minutes">Delay</SortTh>
              <SortTh field="total_eta_min">ETA (min)</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Arrival</th>
              <SortTh field="status">Status</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Event</th>
              <SortTh field="congestion_count">Congestion</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-500 font-medium">
                  {connected ? "Waiting for data…" : "⚠ WebSocket offline — showing last known data"}
                </td>
              </tr>
            ) : (
              sorted.map((t, idx) => (
                <tr
                  key={t.train_id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-blue-600 font-bold whitespace-nowrap">
                    {t.train_no}
                  </td>
                  <td className="px-4 py-3 text-slate-800 font-semibold max-w-[180px] truncate" title={t.train_name}>
                    {t.train_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium text-xs whitespace-nowrap">{t.train_type}</td>
                  <td className="px-4 py-3 font-mono text-slate-700 font-medium whitespace-nowrap">
                    {t.status === "Arrived" ? "0" : (t.current_speed ?? 0).toFixed(0)} km/h
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold whitespace-nowrap ${
                    t.status === 'Arrived' ? 'text-blue-600' : 
                    t.delay_minutes > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {formatDelay(t.delay_minutes, t.status)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 font-bold whitespace-nowrap">
                    {t.total_eta_min != null ? `${Math.round(t.total_eta_min)} min` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 font-medium whitespace-nowrap">
                    {formatTime(t.expected_arrival)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AnomalyBadge event={t.anomaly_event} />
                  </td>
                  <td className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    {t.congestion_count > 1 ? (
                      <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{t.congestion_count}</span>
                    ) : (
                      <span className="text-slate-400 font-medium">1</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
