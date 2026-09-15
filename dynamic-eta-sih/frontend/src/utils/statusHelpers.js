// frontend/src/utils/statusHelpers.js
// ======================================
// Shared utility functions for formatting and colour-coding train status.
// Used by ControllerMap, StationView, and PassengerApp.

/** Map a status string to a Tailwind text-colour class. */
export function statusColorClass(status) {
  switch (status) {
    case "ON_TIME":        return "text-emerald-400";
    case "MINOR_DELAY":    return "text-amber-400";
    case "MODERATE_DELAY": return "text-orange-400";
    case "MAJOR_DELAY":    return "text-rose-400";
    case "Arrived":        return "text-blue-400";
    default:               return "text-slate-400";
  }
}

/** Map a status string to a CSS hex colour (used in non-Tailwind contexts like MapLibre markers). */
export function statusHexColor(status) {
  switch (status) {
    case "ON_TIME":        return "#10B981";  // emerald-500
    case "MINOR_DELAY":    return "#F59E0B";  // amber-500
    case "MODERATE_DELAY": return "#F97316";  // orange-500
    case "MAJOR_DELAY":    return "#F43F5E";  // rose-500
    case "Arrived":        return "#3B82F6";  // blue-500
    default:               return "#94A3B8";  // slate-400
  }
}

/** Return a friendly human-readable label for a status code. */
export function statusLabel(status) {
  switch (status) {
    case "ON_TIME":        return "On Time";
    case "MINOR_DELAY":    return "Minor Delay";
    case "MODERATE_DELAY": return "Moderate Delay";
    case "MAJOR_DELAY":    return "Major Delay";
    case "Arrived":        return "Arrived ✓";
    default:               return "Unknown";
  }
}

/** Format a delay_minutes number to "X min late" or "On time". */
export function formatDelay(delayMin, status) {
  if (status === "Arrived") return "Arrived ✓";
  if (!delayMin || delayMin <= 0) return "On time";
  return `${delayMin} min late`;
}

/** Format an ISO timestamp to a short HH:MM string in local time. */
export function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Return H3 congestion Deck.gl RGBA colour based on severity. */
export function congestionRGBA(severity) {
  return severity === "HIGH"
    ? [244, 63, 94, 180]    // rose-500 — 3+ trains
    : [245, 158, 11, 150];  // amber-500 — 2 trains
}
