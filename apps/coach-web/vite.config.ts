import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        coach: resolve(__dirname, "index.html")
      }
    }
  }
});
