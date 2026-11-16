// Local-only browser smoke test. Uses temporary fixture DB, never the production server.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createMockDatabaseState } from "./fixtures/mock-db.ts";

const workspace = path.resolve(import.meta.dirname, "../../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "infini-browser-smoke-"));
fs.writeFileSync(path.join(temporary, "db.json"), JSON.stringify(createMockDatabaseState()));
process.env.INFINI_DATA_ROOT = temporary;
const { handleCompatRequest } = await import("../src/interfaces/http/compat-request-handler.ts");
const core = await import("../src/data/json-store/core.ts");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || "").href);
const checks: string[] = [];
const failures: string[] = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname.startsWith("/infini/api/")) {
      req.url = req.url!.slice("/infini".length);
      await handleCompatRequest(req, res); return;
    }
    const match = url.pathname.match(/^\/infini\/(course|admin|coach|ops)\/(.*)$/);
    if (!match) { res.writeHead(404).end(); return; }
    const app = match[1] === "course" && match[2].startsWith("simulator/") ? "websimulator" : `${match[1]}-web`;
    const relative = app === "websimulator" ? match[2].slice("simulator/".length) : match[2];
    const base = path.join(workspace, "apps", app, "dist");
    const file = path.resolve(base, relative || "index.html");
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const mime = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
    res.writeHead(200, { "Content-Type": mime }); res.end(fs.readFileSync(file));
  } catch (error) { failures.push(String(error)); res.writeHead(500).end(); }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
let browser: any;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  const context = await browser.newContext();
  await context.route("**/*", (route: any) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", (error: Error) => failures.push(error.message));
  await page.goto(`${origin}/infini/course/`);
  await page.locator('input[type="password"]').waitFor();
  await page.locator("input").first().fill("13689547720");
  await page.locator('input[type="password"]').fill("REDACTED_CONFIGURE_LOCALLY");
  await page.locator("button.login-submit").click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("infini-course-web-session-v2") || "null")?.token_type === "Session");
  await page.locator('input[type="password"]').waitFor({ state: "detached" });
  checks.push("course UI login and HttpOnly session restored");

  const admin = await context.newPage();
  admin.on("pageerror", (error: Error) => failures.push(error.message));
  await admin.goto(`${origin}/infini/admin/`);
  await admin.locator('input[type="password"]').waitFor();
  await admin.locator("input").first().fill("13689547720");
  await admin.locator('input[type="password"]').fill("REDACTED_CONFIGURE_LOCALLY");
  await admin.locator("button.login-submit").click();
  await admin.waitForFunction(() => JSON.parse(localStorage.getItem("infini-admin-web-session-v2") || "null")?.token_type === "Session");
  await admin.locator('input[type="password"]').waitFor({ state: "detached" });
  checks.push("admin UI login does not revoke course");

  const second = await context.newPage();
  await second.goto(`${origin}/infini/course/`);
  await second.waitForFunction(() => document.querySelector("input[type=password]") === null && document.body.innerText.includes("课表"));
  await page.reload();
  await page.waitForFunction(() => document.querySelector("input[type=password]") === null && document.body.innerText.includes("课表"));
  checks.push("two course tabs share cookie and refresh without logout");

  for (const app of ["coach", "ops"]) {
    const tab = await context.newPage();
    tab.on("pageerror", (error: Error) => failures.push(error.message));
    await tab.goto(`${origin}/infini/${app}/`);
    await tab.locator('input[type="password"]').waitFor();
    await tab.locator("input").first().fill("13689547720");
    await tab.locator('input[type="password"]').fill("REDACTED_CONFIGURE_LOCALLY");
    await tab.getByRole("button", { name: /登录/ }).click();
    await tab.waitForFunction((app: string) => JSON.parse(localStorage.getItem(`infini-${app}-web-session-v2`) || "null")?.token_type === "Session", app);
    await tab.locator('input[type="password"]').waitFor({ state: "detached" });
    checks.push(`${app} UI login uses independent cookie`);
    if (app === "ops") {
      const opened = await tab.evaluate(() => new Promise<boolean>(resolve => {
        const stream = new EventSource("/infini/api/ops/mqtt/stream?browserClient=ops-web");
        const timer = setTimeout(() => { stream.close(); resolve(false); }, 3000);
        stream.onopen = () => { clearTimeout(timer); stream.close(); resolve(true); };
      }));
      assert(opened); checks.push("ops SSE authenticates by cookie without URL token");
    }
  }

  const simulator = await context.newPage();
  const metaResponse = simulator.waitForResponse((r: any) => r.url().includes("/api/meta?"));
  await simulator.goto(`${origin}/infini/course/simulator/?courseId=101`);
  assert.equal((await metaResponse).status(), 200);
  checks.push("simulator reuses course cookie for course content");
  await simulator.close();

  const cookies = await context.cookies();
  assert.equal(cookies.filter((c: any) => c.name.startsWith("infini-session-")).length, 4);
  assert(cookies.every((c: any) => c.httpOnly && c.sameSite === "Strict"));
  assert.equal(await page.evaluate(() => document.cookie), "");
  checks.push("cookie credentials inaccessible to document.cookie");

  // Expire only access leases in the temporary DB, then exercise automatic request retry.
  core.state.authSessions.filter((s: any) => s.kind === "browser").forEach((s: any) => { s.expiresAt = new Date(Date.now() - 1000).toISOString(); });
  await page.reload(); await admin.reload();
  await page.waitForFunction(() => Number(JSON.parse(localStorage.getItem("infini-course-web-session-v2")!).expires_at) > Date.now());
  await admin.waitForFunction(() => Number(JSON.parse(localStorage.getItem("infini-admin-web-session-v2")!).expires_at) > Date.now());
  checks.push("expired leases renew independently in real browser");

  // Server outage on restore must not clear cached identity or return the UI to login.
  await page.route("**/api/browser-auth/course-web/refresh", (route: any) => route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"test outage"}' }));
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes("课表") && !document.querySelector("input[type=password]"));
  checks.push("503 during restore preserves course UI and identity");
  await page.unroute("**/api/browser-auth/course-web/refresh");

  const reportDir = path.join(workspace, "outputs/test-results/browser-sessions-20261111");
  fs.mkdirSync(reportDir, { recursive: true });
  await page.screenshot({ path: path.join(reportDir, "course.png"), fullPage: true });
  await admin.screenshot({ path: path.join(reportDir, "admin.png"), fullPage: true });

  // Trigger the UI logout so both its local subscribers and the other tab's storage event run.
  await page.getByRole("button", { name: /退出/ }).first().click();
  await page.locator('input[type="password"]').waitFor();
  await second.locator('input[type="password"]').waitFor();
  assert(await admin.evaluate(() => Boolean(localStorage.getItem("infini-admin-web-session-v2"))));
  const status = await admin.evaluate(async () => (await fetch("/infini/api/user/info", { headers: { "X-Infini-Client": "admin-web" } })).status);
  assert.equal(status, 200);
  checks.push("course UI logout reaches second tab but admin remains authorized");
  assert.deepEqual(failures, []);
  fs.writeFileSync(path.join(reportDir, "browser-smoke.json"), JSON.stringify({ checks, failures }, null, 2));
  console.log(JSON.stringify({ checks, failures, reportDir }, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(temporary, { recursive: true, force: true });
}
