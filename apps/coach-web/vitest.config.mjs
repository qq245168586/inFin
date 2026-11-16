import { defineConfig } from "vitest/config";

const allureResultsDir = process.env.INFINI_ALLURE_RESULTS_DIR || "allure-results";
const reporters =
  process.env.INFINI_ALLURE === "1"
    ? ["default", ["allure-vitest/reporter", { resultsDir: allureResultsDir }]]
    : ["default"];

export default defineConfig({
  test: {
    include: ["tests/unit/*.test.ts"],
    reporters,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["tests/**"]
    }
  }
});
