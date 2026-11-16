import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === "build" ? "/infini/coach/" : "/"),
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3100",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        coach: resolve(__dirname, "index.html")
      }
    }
  }
}));
