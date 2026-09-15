// frontend/src/App.jsx
// ======================
// Root component — sets up routing and the persistent sidebar layout.
// All pages share the same sidebar; only the <main> area changes per route.

import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  Map, TableProperties, User, Activity,
} from "lucide-react";

import ControllerMap  from "./pages/ControllerMap";
import StationView    from "./pages/StationView";
import PassengerApp   from "./pages/PassengerApp";
import AICopilot      from "./components/AICopilot";
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs shadow-sm">
      <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_4px_#10B981]" : "bg-rose-500"}`} />
      <span className={`font-semibold ${connected ? "text-emerald-700" : "text-rose-700"}`}>
        {connected ? "Live" : "Offline"}
      </span>
      {lastUpdate && (
        <span className="text-slate-400 hidden xl:block ml-auto font-mono text-[10px]">
          {new Date(lastUpdate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
        </span>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ connected, lastUpdate, trains }) {
  const delayed = trains.filter(t => t.status !== "ON_TIME" && t.status !== "UNKNOWN" && t.status !== "Arrived").length;

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-slate-200 px-4 py-6 gap-6 shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20">
          <Activity size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">TrackSense</h1>
        </div>
      </div>

      {/* WS status */}
      <WsStatus connected={connected} lastUpdate={lastUpdate} />

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatChip label="Trains" value={trains.length} color="text-blue-600" />
        <StatChip label="Delayed" value={delayed} color="text-rose-600" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2 mt-2">Dashboards</p>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-blue-50 text-blue-700 border border-blue-100 shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <p className="text-[10px] font-semibold text-slate-400 text-center uppercase tracking-wider">
        Dynamic ETA System
      </p>
    </aside>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center shadow-sm">
      <p className={`text-xl font-black font-mono ${color}`}>{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function Shell() {
  // Lift WebSocket state here so all pages can share the same connection
  const socket = useTrainSocket();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Sidebar
        connected={socket.connected}
        lastUpdate={socket.lastUpdate}
        trains={socket.trains}
      />
      <main className="flex-1 overflow-auto relative">
        <Routes>
          <Route path="/"          element={<ControllerMap  {...socket} />} />
          <Route path="/station"   element={<StationView    {...socket} />} />
          <Route path="/passenger" element={<PassengerApp   {...socket} />} />
        </Routes>
      </main>

      {/* Phase 6: Floating AI Copilot — available on every dashboard */}
      <AICopilot />
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
