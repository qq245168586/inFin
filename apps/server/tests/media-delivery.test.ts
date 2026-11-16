import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";
import { resolveSafeMediaFile, sendMediaFile } from "../src/services/media-delivery.ts";

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  infoSpy.mockRestore();
});

test("resolveSafeMediaFile accepts flat media names and rejects traversal", () => {
  const root = path.join(os.tmpdir(), "infini-media-root");

  assert.equal(resolveSafeMediaFile(root, "video-1.mp4"), path.join(root, "video-1.mp4"));
  assert.equal(resolveSafeMediaFile(root, "../secret.txt"), null);
  assert.equal(resolveSafeMediaFile(root, "nested/video.mp4"), null);
  assert.equal(resolveSafeMediaFile(root, "nested\\video.mp4"), null);
});

test("sendMediaFile returns immutable validators and 304 for a matching ETag", () => {
  const fixture = writeTempFile("abcdef");
  const firstResponse = createResponse();

  try {
    sendMediaFile(
      { method: "HEAD", headers: {} },
      firstResponse,
      {
        filePath: fixture.filePath,
        filename: "fixture.txt",
        contentType: "text/plain",
        checksum: "abc123",
        xAccelPrefix: ""
      }
    );

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.headers.ETag, '"sha256-abc123"');
    assert.equal(firstResponse.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.ok(firstResponse.headers["Last-Modified"]);

    const cachedResponse = createResponse();
    sendMediaFile(
      { method: "GET", headers: { "if-none-match": firstResponse.headers.ETag } },
      cachedResponse,
      {
        filePath: fixture.filePath,
        filename: "fixture.txt",
        contentType: "text/plain",
        checksum: "abc123",
        xAccelPrefix: ""
      }
    );
    assert.equal(cachedResponse.statusCode, 304);
    assert.equal(cachedResponse.body, "");
  } finally {
    fixture.cleanup();
  }
});

test("sendMediaFile emits an internal X-Accel redirect without streaming a body", () => {
  const fixture = writeTempFile("abcdef");
  const response = createResponse();

  try {
    const result = sendMediaFile(
      {
        method: "GET",
        headers: {
          "x-infini-device-id": "TV-1",
          "x-infini-screen-number": "3",
          "x-infini-media-intent": "cache"
        }
      },
      response,
      {
        filePath: fixture.filePath,
        filename: "fixture one.txt",
        contentType: "text/plain",
        checksum: "abc123",
        xAccelPrefix: "/_infini_media/"
      }
    );

    assert.equal(result.deliveryMode, "x-accel");
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["X-Accel-Redirect"], "/_infini_media/fixture%20one.txt");
    assert.equal(response.headers["Content-Length"], 6);
    assert.equal(response.body, "");
    assert.match(String(infoSpy.mock.calls[0]?.[0]), /"deviceId":"TV-1"/);
  } finally {
    fixture.cleanup();
  }
});

function writeTempFile(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "infini-media-delivery-"));
  const filePath = path.join(dir, "fixture.txt");
  fs.writeFileSync(filePath, content, "utf8");
  return {
    filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {} as Record<string, any>,
    body: "",
    writeHead(statusCode: number, headers: Record<string, any>) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += chunk ? String(chunk) : "";
    }
  };
}
