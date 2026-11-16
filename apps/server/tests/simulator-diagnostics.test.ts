import { test, expect, vi, afterEach } from "vitest";
import { simulatorDiagnosticIdentity, parseDiagnosticEvents } from "../src/services/tv-diagnostic-schema.ts";
import { reportDiagnostic, flushDiagnostics, redact } from "../../websimulator/src/diagnostics.ts";
import { cacheCourseMedia } from "../../websimulator/src/mediaCache.ts";
import { requestJson } from "../../websimulator/src/api.ts";

const key = "infini-simulator-diagnostics-v1";
const storage = new Map<string, string>();
function browser() {
  storage.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v) });
  vi.stubGlobal("location", { search: "?courseId=41", pathname: "/infini/course/simulator/", href: "https://example.test/infini/course/simulator/", origin: "https://example.test" });
  vi.stubGlobal("window", { location, localStorage, __infiniSimulatorMediaLog: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

test("browser identity comes from the authenticated numeric account only", () => {
  expect(simulatorDiagnosticIdentity({ id: 2 })).toMatchObject({ source: "websimulator", deviceId: "websimulator-user-2", screenNumber: 0 });
  expect(() => simulatorDiagnosticIdentity({ id: NaN })).toThrow();
  expect(() => simulatorDiagnosticIdentity({ id: "../db" as any })).toThrow();
});

test("download log includes actionable context and is compatible with server schema", () => {
  browser();
  reportDiagnostic("DOWNLOAD_ERROR", "HTTP_404", new Error("Missing Bearer abc"), {
    actionId: "491", actionName: "上下犬", endpoint: "/simulator-media/oss-shanghai/file.mp4",
    sourceUrl: "https://user:pass@oss.test/file.mp4?Signature=hidden", httpStatus: 404, stage: "download"
  });
  const raw = storage.get(key)!;
  expect(raw).not.toContain("hidden");
  expect(raw).not.toContain("user:pass");
  expect(raw).not.toContain("Bearer abc");
  const records = JSON.parse(raw);
  const parsed = parseDiagnosticEvents(Buffer.from(JSON.stringify(records[0])))[0];
  expect(parsed.context).toMatchObject({ courseId: "41", actionId: "491", httpStatus: 404, stage: "download" });
});

test("repeated errors are deduplicated, cancellation ignored and outbox bounded", () => {
  browser();
  reportDiagnostic("API_ERROR", "HTTP_500", new Error("repeat"));
  reportDiagnostic("API_ERROR", "HTTP_500", new Error("repeat"));
  reportDiagnostic("API_ERROR", "CANCEL", new DOMException("cancel", "AbortError"));
  expect(JSON.parse(storage.get(key)!)).toHaveLength(1);
  for (let i = 0; i < 30; i++) reportDiagnostic("API_ERROR", "HTTP_500", new Error(`bounded-${i}`));
  expect(JSON.parse(storage.get(key)!)).toHaveLength(20);
});

test("failed upload keeps stable single-event ID, later success drains it without recursion", async () => {
  browser(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T15:00:00Z"));
  reportDiagnostic("API_ERROR", "HTTP_503", new Error("upload-case"));
  storage.set("infini-course-web-session-v2", JSON.stringify({ access_token: "public-session-id", token_type: "Session" }));
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  await flushDiagnostics();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(storage.get(key)!)).toHaveLength(1);
  vi.setSystemTime(new Date("2026-11-08T15:02:00Z"));
  await flushDiagnostics();
  expect(fetcher.mock.calls[0][1].headers.get("x-infini-log-id")).toBeTruthy();
  expect(fetcher.mock.calls[0][1].headers.get("x-infini-log-id")).toBe(fetcher.mock.calls[1][1].headers.get("x-infini-log-id"));
  expect(JSON.parse(storage.get(key)!)).toHaveLength(0);
  expect(storage.get(key)).not.toContain("private-token");
});

test("404 from simulator proxy records the final download failure", async () => {
  browser();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404, headers: { "content-type": "text/html" } })));
  const course = { id: 39, script: { sections: { warmup: { items: [
    { actionId: "244", actionName: "上下犬", mediaUrl: "https://console-background.oss-cn-shanghai.aliyuncs.com/sample.mp4" }
  ] } } } } as any;
  await expect(cacheCourseMedia(course)).rejects.toThrow();
  expect(JSON.parse(storage.get(key)!)[0]).toMatchObject({ type: "DOWNLOAD_ERROR", code: "HTTP_404",
    context: { courseId: 39, actionId: "244", httpStatus: 404, contentType: "text/html", stage: "download", endpoint: "/simulator-media/oss-shanghai/sample.mp4" } });
});

test("redaction removes signed URLs and quoted secrets", () => {
  expect(redact('https://user:pw@a.test/a?token=x#z password="hidden"')).toBe('https://a.test/a password=[redacted]');
  expect(redact('/simulator-media/oss/a.mp4?Signature=private&OSSAccessKeyId=hidden')).toBe('/simulator-media/oss/a.mp4');
});

test("HTML 200 is recorded as invalid video with response metadata", async () => {
  browser();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>".repeat(300), { headers: { "content-type": "text/html" } })));
  await expect(cacheCourseMedia({ id: 40, script: { sections: { warmup: { items: [
    { actionId: "999", actionName: "invalid html", mediaUrl: "/api/media/html.mp4" }
  ] } } } } as any)).rejects.toThrow();
  expect(JSON.parse(storage.get(key)!)[0]).toMatchObject({ code: "INVALID_VIDEO", context: { httpStatus: 200, contentType: "text/html", stage: "validate_video" } });
});

test("cancelled downloads do not generate error files", async () => {
  browser();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")));
  await expect(cacheCourseMedia({ id: 41, script: { sections: { warmup: { items: [
    { actionId: "998", mediaUrl: "/api/media/cancel.mp4" }
  ] } } } } as any)).rejects.toThrow();
  expect(storage.has(key)).toBe(false);
});

test("terminal API HTTP failure is logged with sanitized endpoint", async () => {
  browser();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"message":"unavailable"}', { status: 503 })));
  await expect(requestJson("/api/meta?courseId=41&token=private")).rejects.toThrow("unavailable");
  expect(JSON.parse(storage.get(key)!)[0]).toMatchObject({ type: "API_ERROR", code: "HTTP_503", context: { endpoint: "/api/meta", httpStatus: 503 } });
  expect(storage.get(key)).not.toContain("private");
});

test("production simulator proxy URL uses the isolated prefix exactly once", async () => {
  vi.stubEnv("VITE_API_BASE_PATH", "/infini");
  vi.resetModules();
  const { resolvePublicUrl } = await import("../../websimulator/src/runtime.ts");
  expect(resolvePublicUrl("/simulator-media/oss-shanghai/a.mp4?Signature=signed")).toBe("/infini/simulator-media/oss-shanghai/a.mp4?Signature=signed");
  expect(resolvePublicUrl("/infini/simulator-media/oss-shanghai/a.mp4")).toBe("/infini/simulator-media/oss-shanghai/a.mp4");
  vi.unstubAllEnvs();
});
