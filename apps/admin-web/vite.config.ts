import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        admin: resolve(__dirname, "index.html"),
        coach: resolve(__dirname, "coach/index.html")
      }
    }
  }
});
