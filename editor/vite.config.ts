import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

// Vite config for Tauri: fixed port, no clearScreen (cargo logs stay visible)
export default defineConfig({
  plugins: [react()],
  // the single source of truth for the version shown in the app
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // do not watch cargo artefacts (locked during the build)
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2021",
  },
});
