import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One id per build. Baked into the app (__APP_BUILD__) and written to
// /version.json, so an open tab can tell when a newer build has gone live
// (components/UpdateBanner.jsx).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: "write-version-json",
      apply: "build",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 3000,
  },
});
