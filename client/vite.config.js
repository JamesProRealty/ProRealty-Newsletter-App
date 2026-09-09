import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served by the Express app at /builder (see ../src/server.js), and proxies
// /api requests to the backend during local dev so you can run `npm run dev`
// here without needing to also rebuild on every change.
export default defineConfig({
  plugins: [react()],
  base: "/builder/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
});
