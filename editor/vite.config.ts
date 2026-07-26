import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config Vite pour Tauri : port fixe, pas de clearScreen (logs cargo visibles)
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2021",
  },
});
