import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { authHeaders, requestJson } from "../../src/services/apiClient.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (originalCustomEvent === undefined) {
    delete globalThis.CustomEvent;
  } else {
    globalThis.CustomEvent = originalCustomEvent;
  }
});

test("authHeaders builds the bearer-style Authorization header", () => {
  assert.deepEqual(authHeaders("Bearer", "access-token"), {
    Authorization: "Bearer access-token"
  });
});

test("requestJson adds JSON content type only when a request body is present", async () => {
  const calls: Array<{ path: string; init: RequestInit }> = [];
  globalThis.fetch = async (path: string, init: RequestInit = {}) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const payload = await requestJson<{ ok: boolean }>("/api/tv/control", {
    method: "POST",
    headers: {
      Authorization: "Bearer access-token",
      "X-Trace": "trace-1"
    },
    body: JSON.stringify({ action: "refresh" })
  });

  assert.deepEqual(payload, { ok: true });
  assert.equal(calls[0].path, "/api/tv/control");
  assert.deepEqual(calls[0].init.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer access-token",
    "X-Trace": "trace-1"
  });
});

test("requestJson surfaces API error messages with status and payload", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ msg: "设备离线" }), {
      status: 409
    });

  await assert.rejects(
    () => requestJson("/api/tv/screens/install-package"),
    (error: Error & { status?: number; payload?: unknown }) => {
      assert.equal(error.message, "设备离线");
      assert.equal(error.status, 409);
      assert.deepEqual(error.payload, { msg: "设备离线" });
      return true;
    }
  );
});

test("requestJson dispatches auth-expired events for expired token responses", async () => {
  let expiredDetail: unknown = null;
  const target = new EventTarget();
  target.addEventListener("infini-auth-expired", (event) => {
    expiredDetail = (event as CustomEvent).detail;
  });
  globalThis.window = target as Window & typeof globalThis;
  if (typeof globalThis.CustomEvent === "undefined") {
    globalThis.CustomEvent = class CustomEvent<T = unknown> extends Event {
      detail: T;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    } as typeof CustomEvent;
  }
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "refresh token 已失效" }), {
      status: 401
    });

  await assert.rejects(() => requestJson("/api/user/info"), /refresh token 已失效/);
  assert.deepEqual(expiredDetail, { message: "refresh token 已失效" });
});
