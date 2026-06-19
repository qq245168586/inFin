import fs from "node:fs";
import path from "node:path";

const reportDir = process.argv[2];
const mode = process.argv[3] || "test";

if (!reportDir) {
  throw new Error("Usage: node tools/generate-test-report.mjs <report-dir> [mode]");
}

const statusPath = path.join(reportDir, "status.tsv");
const rows = fs.existsSync(statusPath)
  ? fs
      .readFileSync(statusPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, status, logFile] = line.split("\t");
        return { name, status, logFile };
      })
  : [];

const workspaceRoot = path.resolve(reportDir, "../../..");

const coverageHints = rows.map((row) => {
  const log = fs.existsSync(row.logFile) ? fs.readFileSync(row.logFile, "utf8") : "";
  const coverageLine = row.name === "tv-android" ? readJacocoCoverage(workspaceRoot) : readNodeCoverage(log);
  const testLine = row.name === "tv-android" ? readJUnitSummary(workspaceRoot) : readNodeTestSummary(log);
  return { ...row, coverageLine, testLine };
});

const passCount = rows.filter((row) => row.status === "PASS").length;
const completion = rows.length === 0 ? 0 : Math.round((passCount / rows.length) * 100);
const generatedAt = new Date().toISOString();

const lines = [
  "# Infini Test Report",
  "",
  `- Generated at: ${generatedAt}`,
  `- Mode: ${mode}`,
  `- Suites passed: ${passCount}/${rows.length}`,
  `- Test completion: ${completion}%`,
  "",
  "## Suite Results",
  "",
  "| Suite | Status | Coverage signal | Test signal | Log |",
  "| --- | --- | --- | --- | --- |",
  ...coverageHints.map((row) => {
    const logName = path.basename(row.logFile || "");
    const coverage = row.coverageLine || "See log";
    const test = row.testLine || "See log";
    return `| ${row.name} | ${row.status} | ${escapeCell(coverage)} | ${escapeCell(test)} | ${logName} |`;
  }),
  "",
  "## Coverage Scope",
  "",
  "- Unit tests intentionally target business logic, data transforms, validation, scheduling, playback planning, and fallback behavior.",
  "- UI component rendering tests are intentionally out of scope for this pass.",
  "- TV Android JaCoCo reports only business-testable packages; Activity/View/lifecycle/media UI code is excluded from the denominator.",
  "- Reports are generated from each app's native test output; detailed logs live beside this file.",
  "",
];

fs.writeFileSync(path.join(reportDir, "test-report.md"), lines.join("\n"));

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function readNodeCoverage(log) {
  const allFilesLine = log
    .split("\n")
    .find((line) => /all files\s+\|/.test(line));
  if (!allFilesLine) return "See log";

  const match = allFilesLine.match(/all files\s+\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!match) return allFilesLine.trim();

  return `line ${match[1]}%, branch ${match[2]}%, funcs ${match[3]}%`;
}

function readNodeTestSummary(log) {
  const tests = readMetric(log, /ℹ tests\s+(\d+)/);
  const pass = readMetric(log, /ℹ pass\s+(\d+)/);
  const fail = readMetric(log, /ℹ fail\s+(\d+)/);
  if (tests || pass || fail) {
    return `${pass || 0}/${tests || 0} passed, ${fail || 0} failed`;
  }
  return (
    log
      .split("\n")
      .reverse()
      .find((line) => /tests? passed|passing|failed|duration/i.test(line)) || "See log"
  ).trim();
}

function readMetric(log, regex) {
  const match = log.match(regex);
  return match ? Number(match[1]) : 0;
}

function readJUnitSummary(root) {
  const dir = path.join(root, "apps/tv-android/app/build/test-results/testDebugUnitTest");
  if (!fs.existsSync(dir)) return "See log";
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".xml"));
  let tests = 0;
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  for (const file of files) {
    const xml = fs.readFileSync(path.join(dir, file), "utf8");
    tests += Number(xml.match(/tests="(\d+)"/)?.[1] || 0);
    failures += Number(xml.match(/failures="(\d+)"/)?.[1] || 0);
    errors += Number(xml.match(/errors="(\d+)"/)?.[1] || 0);
    skipped += Number(xml.match(/skipped="(\d+)"/)?.[1] || 0);
  }
  return `${tests - failures - errors}/${tests} passed, ${failures + errors} failed, ${skipped} skipped`;
}

function readJacocoCoverage(root) {
  const xmlPath = path.join(
    root,
    "apps/tv-android/app/build/reports/jacoco/jacocoDebugUnitTestReport/jacocoDebugUnitTestReport.xml"
  );
  if (!fs.existsSync(xmlPath)) return "See JaCoCo report";
  const xml = fs.readFileSync(xmlPath, "utf8");
  const counters = [...xml.matchAll(/<counter type="(LINE|BRANCH|METHOD)" missed="(\d+)" covered="(\d+)"\/>/g)];
  const lastByType = new Map();
  for (const match of counters) {
    lastByType.set(match[1], { missed: Number(match[2]), covered: Number(match[3]) });
  }
  const line = percent(lastByType.get("LINE"));
  const branch = percent(lastByType.get("BRANCH"));
  const method = percent(lastByType.get("METHOD"));
  return `line ${line}%, branch ${branch}%, methods ${method}%`;
}

function percent(counter) {
  if (!counter) return "0.00";
  const total = counter.missed + counter.covered;
  return total > 0 ? ((counter.covered / total) * 100).toFixed(2) : "100.00";
}
