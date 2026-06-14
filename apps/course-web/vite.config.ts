import { resolve } from "node:path";
import { defineConfig } from "vite";

const devApiProxy = process.env.VITE_DEV_API_PROXY || "http://127.0.0.1:3100";

export default defineConfig({
  server: {
    host: process.env.VITE_DEV_HOST || "127.0.0.1",
    proxy: {
      "/api": devApiProxy
    }
  },
  build: {
    rollupOptions: {
      input: {
        admin: resolve(__dirname, "index.html")
      }
    }
  }
});
