import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { createBrowserSessionClient } from "../../../packages/shared/src/browser-session.ts";

const map = new Map<string, string>();
const key = "test-course-session";
const profile = (id = "session-a") => ({ access_token: id, token_type: "Session", refresh_token: "cookie", expires_in: 43200, expires_at: Date.now() + 43200_000 });
const json = (value: any, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const make = () => createBrowserSessionClient("course-web", key, path => path);
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  map.clear(); map.set(key, JSON.stringify(profile()));
  const win = Object.assign(new EventTarget(), { localStorage: {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v), removeItem: (k: string) => map.delete(k)
  }, location: { href: "https://app.test/infini/course/", origin: "https://app.test" } });
  vi.stubGlobal("window", win);
  fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

test("cookies carry auth, old bearer headers are removed and metadata identifies the client", async () => {
  fetcher.mockResolvedValue(json({ ok: true }));
  await make().requestJson("/api/meta", { headers: { Authorization: "Bearer obsolete", "X-Course-Package-Id": "2" } });
  const options = fetcher.mock.calls[0][1];
  expect(options.credentials).toBe("same-origin");
  expect(options.headers.get("Authorization")).toBeNull();
  expect(options.headers.get("X-Infini-Client")).toBe("course-web");
  expect(options.headers.get("X-Course-Package-Id")).toBe("2");
});

test("concurrent requests coalesce refresh and retry once with unchanged body", async () => {
  let refreshes = 0, writes = 0;
  fetcher.mockImplementation(async (url, options) => {
    if (url.includes("/refresh")) { refreshes++; await new Promise(r => setTimeout(r, 5)); return json({ data: profile() }); }
    writes++;
    expect(options.body).toBe('{"name":"course"}');
    return writes <= 2 ? json({ code: "ACCESS_EXPIRED" }, 401) : json({ ok: true });
  });
  const client = make();
  await Promise.all([1, 2].map(() => client.requestJson("/api/courses", { method: "POST", body: '{"name":"course"}' })));
  expect(refreshes).toBe(1); expect(writes).toBe(4);
});

test.each([403, 500, 502, 503])("HTTP %i does not refresh, clear session, or retry a write", async status => {
  fetcher.mockResolvedValue(json({ message: "unavailable", code: "FORBIDDEN" }, status));
  const client = make();
  await expect(client.requestJson("/api/save", { method: "POST", body: "{}" })).rejects.toMatchObject({ status });
  expect(fetcher).toHaveBeenCalledTimes(1); expect(client.read()).not.toBeNull();
});

test("temporary refresh failure preserves identity and original edit state", async () => {
  fetcher.mockResolvedValueOnce(json({ code: "ACCESS_EXPIRED" }, 401)).mockResolvedValueOnce(json({ message: "service unavailable" }, 503));
  const client = make();
  await expect(client.requestJson("/api/meta")).rejects.toMatchObject({ status: 503 });
  expect(client.read()?.access_token).toBe("session-a");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("restore while offline keeps cached public session, confirmed expiry clears it", async () => {
  const client = make(); fetcher.mockRejectedValueOnce(new TypeError("network"));
  expect(await client.restore()).toMatchObject({ access_token: "session-a", token_type: "Session" });
  fetcher.mockResolvedValueOnce(json({ code: "SESSION_EXPIRED" }, 401));
  expect(await client.restore()).toBeNull(); expect(client.read()).toBeNull();
});

test("two tabs can refresh concurrently without token rotation or logout", async () => {
  fetcher.mockImplementation(async () => json({ data: profile() }));
  const a = make(), b = make();
  const result = await Promise.all([a.refresh(), b.refresh()]);
  expect(result[0].access_token).toBe(result[1].access_token);
  expect(a.read()).not.toBeNull();
});

test("cross-tab storage notification updates subscribers but does not expose credentials", () => {
  const listener = vi.fn(); const client = make(); const stop = client.subscribe(listener);
  map.set(key, JSON.stringify(profile("session-b")));
  const event = new Event("storage"); Object.assign(event, { key }); window.dispatchEvent(event);
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ access_token: "session-b" }));
  stop();
});

test("delayed refresh cannot resurrect a session after logout", async () => {
  let done: (response: Response) => void;
  fetcher.mockImplementation(url => url.endsWith("/refresh") ? new Promise(r => { done = r; }) : Promise.resolve(json({ ok: true })));
  const client = make(); const pending = client.refresh();
  await client.logout(); done!(json({ data: profile() }));
  await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(client.read()).toBeNull();
});

test("late 401 cannot clear newer login; stale form cannot save under the new account", async () => {
  let done: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise(r => { done = r; })).mockResolvedValue(json({ data: profile("session-b") }));
  const client = make(); const pending = client.requestJson("/api/meta");
  await client.login("another", "password"); done!(json({ code: "SESSION_EXPIRED" }, 401));
  await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(client.read()?.access_token).toBe("session-b");
  await expect(client.requestJson("/api/save", { headers: { Authorization: "Session session-a" }, method: "POST" })).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("a second auth failure does not enter an infinite retry loop", async () => {
  fetcher.mockResolvedValueOnce(json({ code: "ACCESS_EXPIRED" }, 401))
    .mockResolvedValueOnce(json({ data: profile() })).mockResolvedValueOnce(json({ code: "ACCESS_EXPIRED" }, 401));
  await expect(make().requestJson("/api/meta")).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

test("external media receives no session cookies, auth, or client headers", async () => {
  fetcher.mockResolvedValue(json({}));
  await make().fetch("https://oss.test/movie.mp4", { headers: { Authorization: "Bearer old" } });
  expect(fetcher.mock.calls[0][1].credentials).toBe("omit");
  expect([...fetcher.mock.calls[0][1].headers.keys()]).toEqual([]);
});

test("failed logout preserves current session rather than falsely claiming success", async () => {
  fetcher.mockRejectedValue(new TypeError("offline")); const client = make();
  await expect(client.logout()).rejects.toThrow("offline"); expect(client.read()).not.toBeNull();
});

test("logout still clears the same session when an in-flight refresh completes first", async () => {
  let finishLogout: (response: Response) => void;
  fetcher.mockImplementation(url => url.endsWith("/logout") ? new Promise(r => { finishLogout = r; }) : Promise.resolve(json({ data: profile() })));
  const client = make(); const pending = client.logout();
  await client.refresh(); finishLogout!(json({ ok: true })); await pending;
  expect(client.read()).toBeNull();
});

test("malformed refresh responses preserve cached state and never publish invalid tokens", async () => {
  fetcher.mockImplementation(async () => json({ data: null }));
  const client = make();
  await expect(client.refresh()).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  expect(client.read()?.access_token).toBe("session-a");
});

test("legacy tabs clearing old token storage cannot clear the new cookie session metadata", async () => {
  map.set("legacy-auth", JSON.stringify({ access_token: "old-bearer-secret" }));
  fetcher.mockImplementation(async () => json({ data: profile() }));
  const client = createBrowserSessionClient("course-web", key, path => path, "legacy-auth");
  await client.restore();
  expect(map.has("legacy-auth")).toBe(false);
  const listener = vi.fn(); const stop = client.subscribe(listener);
  const event = new Event("storage"); Object.assign(event, { key: "legacy-auth" }); window.dispatchEvent(event);
  expect(listener).not.toHaveBeenCalled(); expect(client.read()?.access_token).toBe("session-a"); stop();
});
