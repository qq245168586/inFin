import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable } from "node:stream";
import fs from "node:fs";
import { createIsolatedDataRoot } from "./helpers/store.ts";

let root: string, original: string | undefined;
let core: typeof import("../src/data/json-store/core.ts");
let sessions: typeof import("../src/data/json-store/browser-session-store.ts");
let http: typeof import("../src/interfaces/http/browser-session-auth.ts");
beforeEach(async () => {
  original = process.env.INFINI_DATA_ROOT;
  root = createIsolatedDataRoot("browser-auth");
  process.env.INFINI_DATA_ROOT = root;
  core = await import("../src/data/json-store/core.ts");
  core.reloadStoreState();
  const user = core.state.users.find((u: any) => u.username === "coach");
  user.passwordDigest = core.normalizePassword("test");
  sessions = await import("../src/data/json-store/browser-session-store.ts");
  http = await import("../src/interfaces/http/browser-session-auth.ts");
});
afterEach(() => {
  vi.useRealTimers();
  if (original === undefined) delete process.env.INFINI_DATA_ROOT;
  else process.env.INFINI_DATA_ROOT = original;
  fs.rmSync(root, { recursive: true, force: true });
});
function login(client: any = "course-web", previous = "") {
  const result = sessions.loginBrowserSession(client, "13689547720", "REDACTED_CONFIGURE_LOCALLY", previous);
  if (!result || "denied" in result) throw new Error("fixture login failed");
  return result;
}
async function request(path: string, client = "course-web", token = "", body: any = {}, extra: any = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as any;
  req.method = "POST";
  req.headers = { host: "app.test", origin: "https://app.test", "x-forwarded-proto": "https",
    "x-infini-client": client, cookie: `infini-session-${client}=${token}`, ...extra };
  req.socket = {};
  const headers: Record<string, any> = {};
  const result = { status: 0, payload: null as any, headers, handled: false, req };
  const res = { setHeader: (k: string, v: any) => headers[k.toLowerCase()] = v,
    writeHead: (status: number, h: any) => { result.status = status; Object.assign(headers, h); },
    end: (data: string) => { result.payload = JSON.parse(data); } } as any;
  result.handled = await http.handleBrowserAuthentication(req, res, new URL(path, "https://app.test"));
  return result;
}

test("all four clients and independent browsers have separate sessions", () => {
  const all = sessions.BROWSER_CLIENTS.map(client => ({ client, ...login(client) }));
  const another = login();
  expect(new Set(all.map(s => s.token)).size).toBe(4);
  all.forEach(s => expect(sessions.resolveBrowserSession(s.client, s.token)).toHaveProperty("data"));
  sessions.logoutBrowserSession("course-web", all[0].token);
  expect(sessions.resolveBrowserSession("course-web", another.token)).toHaveProperty("data");
  expect(sessions.resolveBrowserSession("admin-web", all[1].token)).toHaveProperty("data");
  expect(sessions.resolveBrowserSession("admin-web", another.token)).toEqual({ error: "SESSION_EXPIRED" });
});

test("refresh extends only its lease without rotating tokens; concurrent refresh stays valid", () => {
  const a = login(); const b = login("admin-web");
  const before = core.state.authSessions.find((s: any) => s.browserClient === "admin-web").expiresAt;
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 13 * 3600_000);
  expect(sessions.resolveBrowserSession("course-web", a.token)).toEqual({ error: "ACCESS_EXPIRED" });
  const first = sessions.resolveBrowserSession("course-web", a.token, true);
  const second = sessions.resolveBrowserSession("course-web", a.token, true);
  expect(first).toEqual(second);
  expect(core.state.authSessions).toHaveLength(2);
  expect(core.state.authSessions.find((s: any) => s.browserClient === "admin-web").expiresAt).toBe(before);
  expect(sessions.resolveBrowserSession("admin-web", b.token)).toEqual({ error: "ACCESS_EXPIRED" });
});

test("absolute expiry cannot be extended and revoked sessions cannot refresh", () => {
  const a = login();
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 16 * 86400_000);
  expect(sessions.resolveBrowserSession("course-web", a.token, true)).toEqual({ error: "SESSION_EXPIRED" });
  vi.useRealTimers();
  const b = login(); sessions.logoutBrowserSession("course-web", b.token);
  expect(sessions.resolveBrowserSession("course-web", b.token, true)).toEqual({ error: "SESSION_EXPIRED" });
});

test("client name cannot confer admin privilege and deleted users cannot refresh", () => {
  expect(sessions.loginBrowserSession("admin-web", "coach", "test")).toEqual({ denied: true });
  expect(sessions.loginBrowserSession("ops-web", "coach", "test")).toEqual({ denied: true });
  const a = login();
  core.state.users = core.state.users.filter((u: any) => u.username !== "13689547720");
  expect(sessions.resolveBrowserSession("course-web", a.token, true)).toEqual({ error: "SESSION_EXPIRED" });
});

test("only hashes are stored, public payload has no credentials, sessions survive reload", () => {
  const a = login();
  const db = fs.readFileSync(`${root}/db.json`, "utf8");
  expect(db).not.toContain(a.token);
  expect(a.data.token_type).toBe("Session");
  expect(a.data).not.toHaveProperty("password");
  expect(JSON.stringify(a.data)).not.toContain(core.state.authSessions[0].accessToken);
  core.reloadStoreState();
  expect(sessions.resolveBrowserSession("course-web", a.token)).toHaveProperty("data");
});

test("legacy login/refresh cannot remove cookie sessions", async () => {
  const a = login();
  const legacy = await import("../src/data/json-store/admin-store.ts");
  const old = legacy.loginConsoleUser("13689547720", "REDACTED_CONFIGURE_LOCALLY", "editor-web");
  legacy.refreshConsoleUser(old.token.refresh_token);
  expect(sessions.resolveBrowserSession("course-web", a.token)).toHaveProperty("data");
});

test("Cookie attributes and origin protection reject cross-site login and writes", async () => {
  const good = await request("/api/browser-auth/course-web/login", "course-web", "", { username: "13689547720", password: "REDACTED_CONFIGURE_LOCALLY" });
  expect(good.status).toBe(200);
  expect(good.headers["set-cookie"]).toContain("HttpOnly; SameSite=Strict");
  expect(good.headers["set-cookie"]).toContain("; Secure");
  expect(good.headers["set-cookie"]).not.toContain("Domain=");
  for (const extra of [{ origin: "https://evil.test" }, { origin: undefined }, { "sec-fetch-site": "cross-site" }, { origin: "http://app.test" }]) {
    const bad = await request("/api/browser-auth/course-web/login", "course-web", "", {}, extra);
    expect(bad.status).toBe(403); expect(bad.payload.code).toBe("CSRF_REJECTED");
  }
});

test("expired access is rejected before business code and refresh is cookie-only", async () => {
  const a = login();
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 13 * 3600_000);
  const blocked = await request("/api/courses/1", "course-web", a.token);
  expect(blocked.handled).toBe(true); expect(blocked.payload.code).toBe("ACCESS_EXPIRED");
  const renewed = await request("/api/browser-auth/course-web/refresh", "course-web", a.token);
  expect(renewed.status).toBe(200); expect(renewed.headers).not.toHaveProperty("set-cookie");
  const retry = await request("/api/courses/1", "course-web", a.token);
  expect(retry.handled).toBe(false); expect(retry.req.headers.authorization).toMatch(/^Bearer /);
});

test("old tab cannot save, refresh, or logout another session, including expired lease", async () => {
  const a = login(); const b = login("course-web", a.token);
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 13 * 3600_000);
  for (const path of ["/api/courses/1", "/api/browser-auth/course-web/refresh", "/api/browser-auth/course-web/logout"]) {
    const result = await request(path, "course-web", b.token, {}, { "x-infini-session": a.data.access_token });
    expect(result.status).toBe(409); expect(result.payload.code).toBe("SESSION_CHANGED");
  }
  expect(sessions.resolveBrowserSession("course-web", b.token, true)).toHaveProperty("data");
});

test("logout revokes on server and sends no stale cookie deletion header", async () => {
  const a = login();
  const out = await request("/api/browser-auth/course-web/logout", "course-web", a.token);
  expect(out.status).toBe(200); expect(out.headers).not.toHaveProperty("set-cookie");
  expect(sessions.resolveBrowserSession("course-web", a.token, true)).toEqual({ error: "SESSION_EXPIRED" });
});

test("unknown clients fail closed; legacy/TV requests are untouched", async () => {
  expect((await request("/api/courses", "not-a-client")).status).toBe(400);
  expect((await request("/api/tv/screens/heartbeat", "", "", {}, { "x-infini-client": undefined })).handled).toBe(false);
});
