import assert from "node:assert/strict";
import { beforeEach, afterEach, test, vi } from "vitest";
import { authHeaders, requestJson } from "../../src/services/apiClient.ts";
import { browserSession } from "../../src/services/browserSession";
import { browserFixture } from "../../../../packages/shared/tests/browser-fixture";

beforeEach(() => vi.stubGlobal("window", browserFixture()));
afterEach(() => vi.unstubAllGlobals());

test("authHeaders preserves caller identity for request guards", () => {
  assert.deepEqual(authHeaders("Session", "public-id"), { Authorization: "Session public-id" });
});

test("requestJson adds JSON headers and cookie client identity, removing legacy credentials", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetcher);
  const payload = await requestJson("/api/tv/control", {
    method: "POST", headers: { Authorization: "Bearer old", "X-Trace": "trace-1" },
    body: JSON.stringify({ action: "refresh" })
  });
  assert.deepEqual(payload, { ok: true });
  const options = fetcher.mock.calls[0][1] as RequestInit;
  const headers = new Headers(options.headers);
  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get("X-Infini-Client"), "coach-web");
  assert.equal(headers.get("Authorization"), null);
  assert.equal(headers.get("X-Trace"), "trace-1");
  assert.equal(options.credentials, "same-origin");
});

test("requestJson surfaces API errors without losing status or payload", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ msg: "设备离线" }), { status: 409 })));
  await assert.rejects(() => requestJson("/api/tv/screens/install-package"), (error: any) => {
    assert.equal(error.message, "设备离线");
    assert.equal(error.status, 409);
    assert.deepEqual(error.payload, { msg: "设备离线" });
    return true;
  });
});

test("only confirmed SESSION_EXPIRED notifies session subscribers", async () => {
  const listener = vi.fn(); const stop = browserSession.subscribe(listener);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "SESSION_EXPIRED", message: "登录已失效" }), { status: 401 })));
  await assert.rejects(() => requestJson("/api/user/info"), /登录已失效/);
  assert.equal(listener.mock.calls[0][0], null);
  stop();
});
