import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildStorageKey, getMediaStorageMode, uploadBufferToOss } from "../src/services/media-storage.ts";

const OSS_ENV_KEYS = [
  "OSS_ACCESS_KEY_ID",
  "OSS_ACCESS_KEY_SECRET",
  "OSS_BUCKET",
  "OSS_ENDPOINT",
  "OSS_OBJECT_PREFIX",
  "OSS_PUBLIC_BASE_URL"
];

const originalEnv = Object.fromEntries(OSS_ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of OSS_ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  globalThis.fetch = originalFetch;
});

test("media storage falls back to local mode when OSS config is incomplete", () => {
  for (const key of OSS_ENV_KEYS) {
    delete process.env[key];
  }

  assert.equal(getMediaStorageMode(), "local");
  assert.equal(buildStorageKey("/uploads/demo.mp4"), "uploads/demo.mp4");
});

test("buildStorageKey trims edge slashes and applies OSS object prefix", () => {
  configureOssEnv();

  assert.equal(getMediaStorageMode(), "oss");
  assert.equal(buildStorageKey("/uploads/demo.mp4"), "tenant-a/media/uploads/demo.mp4");
});

test("uploadBufferToOss encodes path segments and returns public url", async () => {
  configureOssEnv();
  const calls: any[] = [];
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => ""
    } as Response;
  }) as any;

  const result = await uploadBufferToOss({
    buffer: Buffer.from("ok"),
    objectKey: "tenant-a/media/clip 1.mp4",
    mimeType: "video/mp4"
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://infini-test.oss-cn-hangzhou.aliyuncs.com/tenant-a/media/clip%201.mp4");
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(calls[0].init.headers["Content-Type"], "video/mp4");
  assert.match(calls[0].init.headers.Authorization, /^OSS test-key:/);
  assert.deepEqual(result, {
    storage: "oss",
    url: "https://cdn.example.test/assets/tenant-a/media/clip%201.mp4"
  });
});

function configureOssEnv() {
  process.env.OSS_ACCESS_KEY_ID = "test-key";
  process.env.OSS_ACCESS_KEY_SECRET = "test-secret";
  process.env.OSS_BUCKET = "infini-test";
  process.env.OSS_ENDPOINT = "oss-cn-hangzhou.aliyuncs.com";
  process.env.OSS_OBJECT_PREFIX = "/tenant-a/media/";
  process.env.OSS_PUBLIC_BASE_URL = "https://cdn.example.test/assets/";
}
