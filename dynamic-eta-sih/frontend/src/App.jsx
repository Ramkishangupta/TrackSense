// frontend/src/App.jsx
// ======================
// Root component — sets up routing and the persistent sidebar layout.
// All pages share the same sidebar; only the <main> area changes per route.

import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import {
  Map, TableProperties, User, Radio, Activity,
} from "lucide-react";

import ControllerMap  from "./pages/ControllerMap";
import StationView    from "./pages/StationView";
import PassengerApp   from "./pages/PassengerApp";
import useTrainSocket from "./hooks/useTrainSocket";

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { to: "/",          label: "Controller Map",  Icon: Map            },
  { to: "/station",   label: "Station View",    Icon: TableProperties },
  { to: "/passenger", label: "Passenger App",   Icon: User           },
];

// ── Connection status badge ───────────────────────────────────────────────────
function WsStatus({ connected, lastUpdate }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs">
      <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_6px_#10B981]" : "bg-rose-500"}`} />
      <span className={connected ? "text-emerald-400" : "text-rose-400"}>
        {connected ? "Live" : "Offline"}
      </span>
      {lastUpdate && (
        <span className="text-slate-500 hidden xl:block">
          {new Date(lastUpdate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
        </span>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ connected, lastUpdate, trains }) {
  const delayed = trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN").length;

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-700/60 px-4 py-6 gap-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <Activity size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">TrackSense</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">SIH 2026</p>
        </div>
      </div>

      {/* WS status */}
      <WsStatus connected={connected} lastUpdate={lastUpdate} />

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatChip label="Trains" value={trains.length} color="text-blue-400" />
        <StatChip label="Delayed" value={delayed} color="text-rose-400" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-2 mb-1">Dashboards</p>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <p className="text-[10px] text-slate-700 text-center">
        Dynamic ETA Prediction System
      </p>
    </aside>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700/60 text-center">
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function Shell() {
  // Lift WebSocket state here so all pages can share the same connection
  const socket = useTrainSocket();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar
        connected={socket.connected}
        lastUpdate={socket.lastUpdate}
        trains={socket.trains}
      />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"          element={<ControllerMap  {...socket} />} />
          <Route path="/station"   element={<StationView    {...socket} />} />
          <Route path="/passenger" element={<PassengerApp   {...socket} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
