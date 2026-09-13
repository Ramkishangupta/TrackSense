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
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono text-white">{value}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ON_TIME:        "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    MINOR_DELAY:    "bg-amber-500/15   text-amber-400   border-amber-500/30",
    MODERATE_DELAY: "bg-orange-500/15  text-orange-400  border-orange-500/30",
    MAJOR_DELAY:    "bg-rose-500/15    text-rose-400    border-rose-500/30",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
      {statusLabel(status)}
    </span>
  );
}

// ── Anomaly badge ─────────────────────────────────────────────────────────────
function AnomalyBadge({ event }) {
  if (!event || event === "none") return <span className="text-slate-600">—</span>;
  const icons = {
    weather_fog:      "🌫",
    unscheduled_halt: "🛑",
    signal_halt:      "🚦",
    chain_pulling:    "⛓",
  };
  return (
    <span className="text-xs text-rose-400 flex items-center gap-1">
      <span>{icons[event] ?? "⚠"}</span>
      <span>{event.replace(/_/g, " ")}</span>
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
  const delayed  = trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN").length;
  const halted   = trains.filter(t => t.anomaly_event && !["none", null].includes(t.anomaly_event)).length;
  const maxDelay = Math.max(0, ...trains.map(t => t.delay_minutes || 0));

  function SortTh({ field, children }) {
    const active = sortField === field;
    return (
      <th
        className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-slate-100 transition-colors ${
          active ? "text-blue-400" : "text-slate-500"
        }`}
        onClick={() => toggleSort(field)}
      >
        <span className="flex items-center gap-1.5">
          {children}
          <ArrowUpDown size={11} className={active ? "text-blue-400" : "text-slate-600"} />
        </span>
      </th>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 gap-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Station Master Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Kanpur Central (CNB) — Live ETA Board
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock size={11} />
              {formatTime(lastUpdate)}
            </span>
          )}
          <button
            onClick={refreshNow}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="On Time"    value={onTime}   icon={CheckCircle}   color="bg-emerald-600" />
        <SummaryCard label="Delayed"    value={delayed}  icon={AlertTriangle} color="bg-rose-600"    />
        <SummaryCard label="w/ Events"  value={halted}   icon={AlertTriangle} color="bg-amber-600"   />
        <SummaryCard label="Max Delay"  value={`${maxDelay}m`} icon={TrendingUp} color="bg-blue-600" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-700/60">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
            <tr>
              <SortTh field="train_no">Train No</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
              <SortTh field="current_speed">Speed</SortTh>
              <SortTh field="delay_minutes">Delay</SortTh>
              <SortTh field="total_eta_min">ETA (min)</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Arrival</th>
              <SortTh field="status">Status</SortTh>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Event</th>
              <SortTh field="congestion_count">Congestion</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-500">
                  {connected ? "Waiting for data…" : "⚠ WebSocket offline — showing last known data"}
                </td>
              </tr>
            ) : (
              sorted.map((t, idx) => (
                <tr
                  key={t.train_id}
                  className={`border-b border-slate-800/80 hover:bg-slate-800/60 transition-colors ${
                    idx % 2 === 0 ? "bg-slate-900/60" : "bg-slate-800/30"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-blue-400 font-semibold whitespace-nowrap">
                    {t.train_no}
                  </td>
                  <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate" title={t.train_name}>
                    {t.train_name}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{t.train_type}</td>
                  <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                    {(t.current_speed ?? 0).toFixed(0)} km/h
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold whitespace-nowrap ${statusColorClass(t.status)}`}>
                    {formatDelay(t.delay_minutes)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                    {t.total_eta_min != null ? `${Math.round(t.total_eta_min)} min` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
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
                      <span className="text-amber-400 font-semibold">{t.congestion_count}</span>
                    ) : (
                      <span className="text-slate-600">1</span>
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
