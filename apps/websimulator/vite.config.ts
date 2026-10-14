import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === "build" ? "/infini/course/simulator/" : "/simulator/"),
  server: {
    port: 3206,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3100",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
}));
