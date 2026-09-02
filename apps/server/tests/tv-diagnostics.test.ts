import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { test, onTestFinished, vi } from "vitest";
import { TvDiagnosticFiles } from "../src/services/tv-diagnostic-files.ts";
import { authenticateDiagnosticDevice, DiagnosticError, DIAGNOSTIC_RETENTION_MS,
  parseDiagnosticEvents, redactDiagnosticText } from "../src/services/tv-diagnostic-schema.ts";
import { handleTvDiagnosticUpload } from "../src/interfaces/http/tv-diagnostic-upload.ts";
import { importStore } from "./helpers/store.ts";
import { createMockDatabaseState } from "./fixtures/mock-db.ts";

const identity = { deviceId: "TV-TEST01", accountNamespace: "venue-test", screenNumber: 1, appVersion: "1.0.72" };
const headers = {
  "x-infini-device-id": identity.deviceId, "x-infini-namespace": identity.accountNamespace,
  "x-infini-screen-number": "1", "x-infini-app-version": identity.appVersion,
  "x-infini-pair-token": "TEST-PAIR-TOKEN", "content-type": "application/x-ndjson"
};
const devices = [{ ...identity, pairToken: headers["x-infini-pair-token"] }];
const event = (overrides = {}) => ({ id: randomUUID(), occurredAt: "2026-08-26T07:35:00.000Z",
  type: "PLAYBACK_ERROR", code: "MEDIA_1_-1004", message: "Local video failed", context: { mediaFile: "340.mp4" }, ...overrides });
const bytes = (value = event()) => Buffer.from(JSON.stringify(value) + "\n");
const status = (expected: number) => (error: unknown) => error instanceof DiagnosticError && error.status === expected;

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "infini-diagnostics-"));
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  let now = Date.parse("2026-08-26T07:35:01Z");
  return { root, files: new TvDiagnosticFiles(root, () => now), advance: (ms: number) => { now += ms; } };
}

async function savedFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await savedFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) result.push(target);
  }
  return result;
}

test("diagnostics requires the bound device, venue, screen and matching credential", () => {
  assert.deepEqual(authenticateDiagnosticDevice(headers, devices), identity);
  for (const change of [
    { "x-infini-pair-token": "wrong" }, { "x-infini-device-id": "../secret" },
    { "x-infini-namespace": "venue-other" }, { "x-infini-screen-number": "5" },
    { "x-infini-screen-number": "1.5" }, { "x-infini-app-version": "../../db.json" }
  ]) assert.throws(() => authenticateDiagnosticDevice({ ...headers, ...change }, devices), status(403));
  assert.throws(() => authenticateDiagnosticDevice(headers, []), status(403));
});

test("store verifies private pair token without exposing it in device APIs or changing DB", async (t) => {
  const store = await importStore(t, createMockDatabaseState({ tvScreens: devices }));
  const dbFile = path.join(process.env.INFINI_DATA_ROOT!, "db.json");
  const before = await fs.readFile(dbFile, "utf8");
  assert.deepEqual(store.authenticateTvDiagnosticUpload(headers), identity);
  assert.equal(store.listTvDevices().devices[0].pairToken, undefined);
  assert.throws(() => store.authenticateTvDiagnosticUpload({ ...headers, "x-infini-pair-token": "wrong" }), status(403));
  assert.equal(await fs.readFile(dbFile, "utf8"), before);
});

test("event schema strips secrets, signed URL parameters and unknown fields", () => {
  const input = event({ message: 'https://user:pw@media.test/a.mp4?token=secret#part Bearer abc password="123"',
    pairToken: "not-persisted", context: { endpoint: "https://test/api?token=secret", authorization: "hidden", screenNumber: 99 } });
  const result = parseDiagnosticEvents(bytes(input))[0];
  assert.equal(result.context.endpoint, "https://test/api");
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!JSON.stringify(result).includes("not-persisted"));
  assert.equal(result.context.authorization, undefined);
  assert.equal(redactDiagnosticText("hello world", 5), "hello");
});

test("invalid JSONL, unknown types, dates, empty files and oversized batches are rejected", () => {
  for (const input of [Buffer.from("oops"), Buffer.alloc(0), bytes(event({ type: "OTHER" })),
    bytes(event({ occurredAt: "yesterday" })), bytes(event({ message: "" })), bytes(event({ code: "a/b" }))]) {
    assert.throws(() => parseDiagnosticEvents(input), status(400));
  }
  assert.throws(() => parseDiagnosticEvents(Buffer.alloc(65537)), status(413));
  assert.throws(() => parseDiagnosticEvents(Buffer.from(Array(51).fill(JSON.stringify(event())).join("\n"))), status(413));
});

test("files have readable Beijing timestamps, private permissions and server-verified metadata", async () => {
  const f = await fixture();
  const id = randomUUID();
  const ack = await f.files.receive(identity, id, bytes(event({ deviceId: "forged", receivedAt: "fake" })));
  assert.equal(ack.duplicate, false);
  const [filename] = await savedFiles(f.root);
  assert.match(filename, /20260826\/venue-test\/TV-TEST01\/20260826T153501000_screen-1_TV-TEST01_v1.0.72_/);
  const record = JSON.parse(await fs.readFile(filename, "utf8"));
  assert.equal(record.deviceId, identity.deviceId);
  assert.equal(record.receivedAt, "2026-08-26T07:35:01.000Z");
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
});

test("ops query classifies and filters diagnostics without exposing storage metadata", async () => {
  const f = await fixture();
  await f.files.receive(identity, randomUUID(), Buffer.from([
    JSON.stringify(event({ type: "PLAYBACK_ERROR", code: "MEDIA_1_-1004", context: { mediaFile: "340.mp4" } })),
    JSON.stringify(event({ id: randomUUID(), type: "NETWORK_ERROR", code: "TIMEOUT", message: "request timed out" }))
  ].join("\n")));
  await f.files.receive({ ...identity, deviceId: "TV-TEST02", screenNumber: 3 }, randomUUID(),
    bytes(event({ type: "CRASH", code: "UNCAUGHT_JAVA_EXCEPTION", message: "boom" })));

  const all = await f.files.query({ date: "2026-08-26", namespace: "venue-test" });
  assert.equal(all.summary.total, 3);
  assert.equal(all.summary.uniqueDevices, 2);
  assert.equal(all.summary.types.PLAYBACK_ERROR, 1);
  assert.equal(all.summary.types.NETWORK_ERROR, 1);
  assert.equal(all.summary.types.CRASH, 1);
  assert.equal((all.items[0] as any).batchChecksum, undefined);
  assert.equal((all.items[0] as any).path, undefined);

  const filtered = await f.files.query({ type: "PLAYBACK_ERROR", screenNumber: 1, code: "media", limit: 10 });
  assert.equal(filtered.summary.total, 1);
  assert.equal(filtered.summary.filteredTotal, 1);
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].code, "MEDIA_1_-1004");
  await assert.rejects(f.files.query({ date: "../../db.json" }), status(400));
  await assert.rejects(f.files.query({ type: "OTHER" }), status(400));
});

test("concurrent retries and next-day retries are idempotent; changed content conflicts", async () => {
  const f = await fixture(); const id = randomUUID(); const body = bytes();
  const acks = await Promise.all(Array.from({ length: 8 }, () => f.files.receive(identity, id, body)));
  assert.equal(acks.filter(ack => !ack.duplicate).length, 1);
  f.advance(24 * 60 * 60 * 1000);
  assert.equal((await f.files.receive(identity, id, body)).duplicate, true);
  await assert.rejects(f.files.receive(identity, id, bytes()), status(409));
  assert.equal((await savedFiles(f.root)).length, 1);
});

test("retention uses server receipt time, survives restart, and leaves foreign files/symlinks untouched", async () => {
  const f = await fixture();
  await f.files.receive(identity, randomUUID(), bytes(event({ occurredAt: "2000-01-01T00:00:00Z" })));
  const [log] = await savedFiles(f.root);
  const abandoned = path.join(path.dirname(log), `.${randomUUID()}.tmp`);
  await fs.writeFile(abandoned, "partial write");
  await fs.writeFile(path.join(f.root, "db.json"), "keep");
  await fs.mkdir(path.join(f.root, "media"));
  await fs.writeFile(path.join(f.root, "media", "video.mp4"), "keep");
  await fs.symlink(path.join(f.root, "media"), path.join(f.root, "20000101"));
  assert.equal(await f.files.cleanup(), 1);
  assert.equal((await savedFiles(f.root)).length, 1);
  f.advance(DIAGNOSTIC_RETENTION_MS);
  assert.equal(await f.files.cleanup(), 1);
  assert.equal(await fs.readFile(path.join(f.root, "db.json"), "utf8"), "keep");
  assert.equal(await fs.readFile(path.join(f.root, "media", "video.mp4"), "utf8"), "keep");
  await f.files.receive(identity, randomUUID(), bytes());
  const restarted = new TvDiagnosticFiles(f.root, () => Date.parse("2026-09-16T00:00:00Z"));
  assert.equal(await restarted.cleanup(), 1);
});

test("rate limit is per device and recovers next minute", async () => {
  const f = await fixture();
  for (let i = 0; i < 12; i++) f.files.admit(identity.deviceId);
  assert.throws(() => f.files.admit(identity.deviceId), status(429));
  f.files.admit("TV-OTHER");
  f.advance(60_000); f.files.admit(identity.deviceId);
});

test("daily byte quota persists across restarts and recovers next day", async () => {
  const f = await fixture();
  const body = () => Buffer.from(Array.from({ length: 5 }, () => JSON.stringify(event({ stackTrace: "x".repeat(8192) }))).join("\n"));
  let successes = 0;
  for (let i = 0; i < 70; i++) {
    try { await f.files.receive(identity, randomUUID(), body()); successes++; }
    catch (error) { assert.ok(status(429)(error)); break; }
  }
  assert.ok(successes > 30 && successes < 60);
  const restarted = new TvDiagnosticFiles(f.root, () => Date.parse("2026-08-26T08:00:00Z"));
  await assert.rejects(restarted.receive(identity, randomUUID(), body()), status(429));
  f.advance(24 * 60 * 60 * 1000);
  assert.equal((await f.files.receive(identity, randomUUID(), body())).duplicate, false);
});

/** Uses streams through the real route reader without opening sockets or touching business storage. */
async function upload(files: TvDiagnosticFiles, body: Buffer, overrides = {}, abort = false) {
  const request = new PassThrough() as any;
  request.headers = { ...headers, "x-infini-log-id": randomUUID(), ...overrides };
  const response = {
    statusCode: 0, body: "", headers: {} as Record<string, any>,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    writeHead(code: number, values: Record<string, any>) { this.statusCode = code; Object.assign(this.headers, values); },
    end(value: string) { this.body = value; }
  };
  const done = handleTvDiagnosticUpload(request, response as any, () => authenticateDiagnosticDevice(request.headers, devices), files);
  if (abort) request.emit("aborted"); else request.end(body);
  await done;
  return { ...response, json: JSON.parse(response.body) };
}

test("upload endpoint acknowledges files and rejects authentication/type/size/encoding before saving", async () => {
  const f = await fixture();
  const id = randomUUID(); const body = bytes();
  assert.equal((await upload(f.files, body, { "x-infini-log-id": id })).statusCode, 201);
  assert.equal((await upload(f.files, body, { "x-infini-log-id": id })).statusCode, 200);
  assert.equal((await upload(f.files, body, { "x-infini-pair-token": "wrong" })).statusCode, 403);
  assert.equal((await upload(f.files, body, { "content-type": "text/plain" })).statusCode, 415);
  assert.equal((await upload(f.files, body, { "content-encoding": "gzip" })).statusCode, 415);
  assert.equal((await upload(f.files, body, { "content-length": "65537" })).statusCode, 413);
  assert.equal((await upload(f.files, Buffer.alloc(65537))).statusCode, 413);
  assert.equal((await upload(f.files, body, { "x-infini-log-id": "../../db.json" })).statusCode, 400);
  assert.equal((await upload(f.files, body, {}, true)).statusCode, 400);
  assert.equal((await savedFiles(f.root)).length, 1);
});

test("storage failure returns 503 and an interrupted write does not poison later uploads", async () => {
  const f = await fixture();
  const spy = vi.spyOn(f.files, "receive").mockRejectedValueOnce(new Error("disk full"));
  assert.equal((await upload(f.files, bytes())).statusCode, 503);
  spy.mockRestore();
  assert.equal((await upload(f.files, bytes())).statusCode, 201);
});

test("server pending writes are bounded during a concurrent upload burst", async () => {
  const f = await fixture();
  const results = await Promise.allSettled(Array.from({ length: 40 }, () => f.files.receive(identity, randomUUID(), bytes())));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 32);
  for (const result of results) if (result.status === "rejected") assert.ok(status(429)(result.reason));
  assert.equal((await f.files.receive(identity, randomUUID(), bytes())).duplicate, false);
});

test("endpoint includes Retry-After when authenticated uploads exceed minute quota", async () => {
  const f = await fixture();
  for (let i = 0; i < 12; i++) f.files.admit(identity.deviceId);
  const result = await upload(f.files, bytes());
  assert.equal(result.statusCode, 429);
  assert.equal(result.headers["Retry-After"], "60");
  assert.equal((await savedFiles(f.root)).length, 0);
});
