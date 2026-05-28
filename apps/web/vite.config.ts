import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api to the backend so the browser treats everything as
// same-origin — that keeps the httpOnly auth cookie first-party.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@forwarder/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
