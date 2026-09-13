import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // Tailwind v4 Vite plugin — replaces PostCSS config
  ],
  // maplibre-gl ships as pure ESM; tell Vite not to CJS-transform it.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 5173,
    // Proxy API calls during dev so the React app avoids CORS on REST endpoints.
    // Socket.io (WebSocket) connects directly to localhost:5000.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

