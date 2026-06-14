import { resolve } from "node:path";
import { defineConfig } from "vite";

const devApiProxy = process.env.VITE_DEV_API_PROXY || "http://127.0.0.1:3100";

export default defineConfig({
  server: {
    host: process.env.VITE_DEV_HOST || "127.0.0.1",
    proxy: {
      "/api": {
        target: devApiProxy,
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
