import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test("migration API resolver adds the prefix once and rewrites historical resources", async () => {
  vi.stubEnv("VITE_API_BASE_PATH", "/infini/");
  vi.resetModules();
  const { resolvePublicUrl } = await import("../../src/config/runtime.ts");
  assert.equal(resolvePublicUrl("/api/meta?courseId=1"), "/infini/api/meta?courseId=1");
  assert.equal(resolvePublicUrl("/infini/api/meta"), "/infini/api/meta");
  assert.equal(resolvePublicUrl("https://api.infintraining.work/api/media/a.mp4?v=3"), "/infini/api/media/a.mp4?v=3");
  assert.equal(resolvePublicUrl("https://114.215.185.184/infini/api/media/a.mp4"), "https://114.215.185.184/infini/api/media/a.mp4");
  assert.equal(resolvePublicUrl("https://cdn.example.test/a.mp4?Signature=abc"), "https://cdn.example.test/a.mp4?Signature=abc");
  assert.equal(resolvePublicUrl("blob:preview"), "blob:preview");
});

test("local API resolver keeps the local proxy route", async () => {
  vi.stubEnv("VITE_API_BASE_PATH", "");
  vi.resetModules();
  const { resolvePublicUrl } = await import("../../src/config/runtime.ts");
  assert.equal(resolvePublicUrl("/api/meta"), "/api/meta");
});
