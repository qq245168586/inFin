import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { test } from "vitest";
import { readJsonBody, sendFile } from "../src/utils/http.ts";

test("readJsonBody returns null for an empty request and parses JSON buffers", async () => {
  assert.equal(await readJsonBody(Readable.from([])), null);
  assert.deepEqual(await readJsonBody(Readable.from([Buffer.from('{"ok":true}')])), { ok: true });
});

test("sendFile returns 416 for invalid byte ranges", () => {
  const { filePath, cleanup } = writeTempFile("abcdef");
  const response = createResponse();

  try {
    sendFile({ method: "GET", headers: { range: "bytes=99-120" } }, response, filePath, "text/plain");
    assert.equal(response.statusCode, 416);
    assert.equal(response.headers["Content-Range"], "bytes */6");
    assert.equal(response.ended, true);
  } finally {
    cleanup();
  }
});

test("sendFile honors HEAD requests for valid ranges without writing a body", () => {
  const { filePath, cleanup } = writeTempFile("abcdef");
  const response = createResponse();

  try {
    sendFile({ method: "HEAD", headers: { range: "bytes=1-3" } }, response, filePath, "text/plain");
    assert.equal(response.statusCode, 206);
    assert.equal(response.headers["Content-Length"], 3);
    assert.equal(response.headers["Content-Range"], "bytes 1-3/6");
    assert.equal(response.body, "");
    assert.equal(response.ended, true);
  } finally {
    cleanup();
  }
});

function writeTempFile(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "infini-http-"));
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
    ended: false,
    writeHead(statusCode: number, headers: Record<string, any>) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.ended = true;
      this.body += chunk ? String(chunk) : "";
    }
  };
}
