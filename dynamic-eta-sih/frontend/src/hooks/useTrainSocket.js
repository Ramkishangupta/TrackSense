// frontend/src/hooks/useTrainSocket.js
// ======================================
// Custom React hook that manages the Socket.io connection to the Node.js
// gateway on port 5000.
//
// Returns:
//   trains       — array of 12 train objects (location + dynamic ETA)
//   congestion   — array of H3 congestion cells
//   connected    — boolean WebSocket connection status
//   lastUpdate   — ISO timestamp of last successful "train_updates" emission
//   refreshNow   — function to emit "request_refresh" to the server

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const NODE_URL = import.meta.env.VITE_NODE_URL || "http://localhost:5000";

export default function useTrainSocket() {
  const socketRef             = useRef(null);
  const [trains, setTrains]   = useState([]);
  const [connected, setConn]  = useState(false);
  const [lastUpdate, setLast] = useState(null);

  useEffect(() => {
    // socket.io-client handles auto-reconnect internally
    const socket = io(NODE_URL, {
      transports:       ["websocket", "polling"],
      reconnection:     true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect",    () => setConn(true));
    socket.on("disconnect", () => setConn(false));

    socket.on("train_updates", (payload) => {
      setTrains(payload.trains || []);
      setLast(payload.timestamp);
    });

    // Server-side error (e.g. DB down) — don't crash, just log
    socket.on("server_error", (err) => {
      console.warn("[WS] Server error:", err.message);
    });

    return () => socket.disconnect();
  }, []);

  const refreshNow = useCallback(() => {
    socketRef.current?.emit("request_refresh");
  }, []);

  return { trains, connected, lastUpdate, refreshNow };
}
