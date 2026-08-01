import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for Tauri: fixed port, no clearScreen (cargo logs stay visible)
export default defineConfig({
  plugins: [react()],
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
