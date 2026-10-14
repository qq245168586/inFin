import assert from "node:assert/strict";
import { test } from "vitest";
import { publicResourceUrl, publicResourceReplacer } from "../src/utils/public-resource-url.ts";

const base = "https://114.215.185.184/infini";

test("public resource URLs map old and relative API paths exactly once", () => {
  for (const value of ["/api/media/a.mp4?v=1", "https://api.infintraining.work/api/media/a.mp4?v=1", "http://8.130.65.113/api/media/a.mp4?v=1", "https://114.215.185.184/api/media/a.mp4?v=1"]) {
    assert.equal(publicResourceUrl(value, base), `${base}/api/media/a.mp4?v=1`);
  }
  assert.equal(publicResourceUrl(`${base}/api/media/a.mp4`, base), `${base}/api/media/a.mp4`);
  assert.equal(publicResourceUrl("https://cdn.example.test/a.mp4?Signature=abc", base), "https://cdn.example.test/a.mp4?Signature=abc");
  assert.equal(publicResourceUrl("/api/media/a.mp4", ""), "/api/media/a.mp4");
});

test("resource mapping does not mutate payload or rewrite free text", () => {
  const previous = process.env.INFINI_PUBLIC_BASE_URL;
  process.env.INFINI_PUBLIC_BASE_URL = base;
  try {
    const payload = { media: { url: "/api/media/a.mp4" }, description: "/api/media/a.mp4", downloadPath: "/api/app-packages/files/a.apk" };
    const result = JSON.parse(JSON.stringify(payload, publicResourceReplacer));
    assert.equal(result.media.url, `${base}/api/media/a.mp4`);
    assert.equal(result.downloadPath, `${base}/api/app-packages/files/a.apk`);
    assert.equal(result.description, payload.description);
    assert.equal(payload.media.url, "/api/media/a.mp4");
  } finally {
    if (previous === undefined) delete process.env.INFINI_PUBLIC_BASE_URL;
    else process.env.INFINI_PUBLIC_BASE_URL = previous;
  }
});
