import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || (command === "build" ? "/infini/ops/" : "/"),
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    port: 3202
  }
}));
