import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === "build" ? "/infini/admin/" : "/"),
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3100"
    }
  },
  build: {
    rollupOptions: {
      input: {
        admin: resolve(__dirname, "index.html")
      }
    }
  }
}));
