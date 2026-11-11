import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Explicit absolute files include the shared client without measuring unrelated UI modules.
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  test: {
    include: ["tests/browser-sessions.test.ts", "tests/browser-session-client.test.ts"],
    coverage: {
      provider: "v8",
      allowExternal: true,
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "../../outputs/test-results/browser-sessions-20261111/coverage",
      include: [
        "./src/data/json-store/browser-session-store.ts",
        "./src/interfaces/http/browser-session-auth.ts",
        "../../packages/shared/src/browser-session.ts"
      ].map(file => fileURLToPath(new URL(file, import.meta.url)))
    }
  }
});
