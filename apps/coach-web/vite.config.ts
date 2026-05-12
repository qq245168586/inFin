import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
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
});
