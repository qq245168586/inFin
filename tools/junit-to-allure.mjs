import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [junitDir, outputDir, suiteName = "junit"] = process.argv.slice(2);

if (!junitDir || !outputDir) {
  throw new Error("Usage: node tools/junit-to-allure.mjs <junit-dir> <output-dir> [suite-name]");
}

fs.mkdirSync(outputDir, { recursive: true });

if (!fs.existsSync(junitDir)) {
  process.exit(0);
}

for (const file of fs.readdirSync(junitDir).filter((item) => item.endsWith(".xml"))) {
  const xml = fs.readFileSync(path.join(junitDir, file), "utf8");
  for (const testCase of readTestCases(xml)) {
    const uuid = crypto.randomUUID();
    const fullName = `${testCase.classname}.${testCase.name}`;
    const result = {
      uuid,
      historyId: md5(fullName),
      testCaseId: md5(fullName),
      fullName,
      name: testCase.name,
      status: testCase.status,
      stage: "finished",
      start: 0,
      stop: Math.max(Math.round(testCase.time * 1000), 0),
      labels: [
        { name: "framework", value: "junit" },
        { name: "language", value: "java" },
        { name: "suite", value: suiteName },
        { name: "package", value: testCase.classname }
      ]
    };
    if (testCase.message) {
      result.statusDetails = {
        message: testCase.message,
        trace: testCase.trace
      };
    }
    fs.writeFileSync(path.join(outputDir, `${uuid}-result.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
}

function readTestCases(xml) {
  const cases = [];
  const regex = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = parseAttributes(match[1] || match[3] || "");
    const body = match[2] || "";
    const failure = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/);
    const skipped = /<skipped\b/.test(body);
    cases.push({
      classname: attrs.classname || suiteName,
      name: attrs.name || "unnamed",
      time: Number(attrs.time || 0),
      status: failure ? "failed" : skipped ? "skipped" : "passed",
      message: failure ? parseAttributes(failure[2] || "").message || failure[1] : "",
      trace: failure ? unescapeXml(failure[3] || "") : ""
    });
  }
  return cases;
}

function parseAttributes(text) {
  const attrs = {};
  const regex = /([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(text))) {
    attrs[match[1]] = unescapeXml(match[2]);
  }
  return attrs;
}

function unescapeXml(text) {
  return text
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function md5(text) {
  return crypto.createHash("md5").update(text).digest("hex");
}
