import { browserSession } from "./browserSession";
import { resolvePublicUrl } from "./runtime.ts";

const STORAGE_KEY = "infini-simulator-diagnostics-v1";
const AUTH_KEY = "infini-course-web-session-v2";
const MAX_EVENTS = 20;
const seen = new Map<string, number>();
let uploading = false;
let retryAfter = 0;
let installed = false;

interface DiagnosticEvent {
  id: string;
  occurredAt: string;
  type: "DOWNLOAD_ERROR" | "API_ERROR" | "CRASH" | "PLAYBACK_ERROR";
  code: string;
  message: string;
  stackTrace: string;
  context: Record<string, string | number>;
}

/** Strip URL credentials, query parameters and common token formats before local storage. */
export function redact(value: unknown, limit = 512): string {
  return String(value || "").replace(/https?:\/\/[^\s"'<>]+/gi, raw => {
    try { const url = new URL(raw); return `${url.protocol}//${url.host}${url.pathname}`; }
    catch { return "[redacted-url]"; }
  }).replace(/\/(?:infini\/|api\/|simulator-media\/)[^\s"'<>]+/g, raw => raw.split(/[?#]/)[0])
    .replace(/\b(Bearer|Basic)\s+[\w+/.=:-]+/gi, "[redacted-auth]")
    .replace(/(["']?(?:token|access_token|refresh_token|password|secret|authorization|cookie|signature)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[redacted]")
    .replace(/([?&](?:token|access_token|refresh_token|signature|secret)=)[^&#\s]*/gi, "$1[redacted]").slice(0, limit);
}

function readQueue(): DiagnosticEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch { return []; }
}

function saveQueue(events: DiagnosticEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS))); }
  catch { /* Diagnostics must not prevent course preparation on storage failure. */ }
}

/** Best effort upload: no business request wrapper, token refresh, recursion or blocking UI. */
export async function flushDiagnostics() {
  if (uploading || Date.now() < retryAfter) return;
  const batch = readQueue().slice(0, 1);
  if (!batch.length) return;
  let auth: { access_token?: string; token_type?: string };
  try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}"); } catch { return; }
  if (!auth?.access_token) return;
  uploading = true;
  retryAfter = Date.now() + 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // Stable IDs make retrying after a lost acknowledgement safe on the server.
    const response = await browserSession.fetch("/api/websimulator/diagnostics", {
      method: "POST", signal: controller.signal, keepalive: true,
      headers: { "Content-Type": "application/x-ndjson", "x-infini-log-id": batch[0].id,
        Authorization: `${auth.token_type || "Bearer"} ${auth.access_token}` },
      body: batch.map(event => JSON.stringify(event)).join("\n")
    });
    if (response.ok) {
      const sent = new Set(batch.map(event => event.id));
      saveQueue(readQueue().filter(event => !sent.has(event.id)));
    }
  } catch { /* Keep the bounded outbox for a later attempt; never log upload failures recursively. */ }
  finally { clearTimeout(timer); uploading = false; }
}

/** Single error entry point shared by downloads, API requests and unhandled runtime errors. */
export function reportDiagnostic(type: DiagnosticEvent["type"], code: string, error: unknown,
  context: Record<string, unknown> = {}) {
  try {
    if ((error as Error)?.name === "AbortError") return;
    const message = redact(error instanceof Error ? error.message : error, 1024) || code;
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
      else if (typeof value === "string") clean[key] = redact(value);
    }
    const courseId = new URLSearchParams(location.search).get("courseId");
    if (courseId && !clean.courseId) clean.courseId = courseId;
    clean.page = location.pathname;
    const key = `${type}:${code}:${clean.courseId}:${clean.actionId}:${clean.endpoint}:${message}`;
    const now = Date.now();
    for (const [k, time] of seen) if (now - time >= 60_000) seen.delete(k);
    if (seen.has(key) || seen.size >= 100) return;
    seen.set(key, now);
    saveQueue([...readQueue(), { id: crypto.randomUUID(), occurredAt: new Date(now).toISOString(),
      type, code, message, stackTrace: redact((error as Error)?.stack, 2048), context: clean }]);
    void flushDiagnostics();
  } catch { /* Logging is deliberately isolated from the original failure. */ }
}

/** Register once even under React StrictMode; browser media errors do not bubble. */
export function installDiagnostics() {
  if (installed) return;
  installed = true;
  window.addEventListener("error", event => {
    if (event.target instanceof HTMLVideoElement) {
      const video = event.target;
      reportDiagnostic("PLAYBACK_ERROR", `MEDIA_${video.error?.code || 0}`, video.error?.message || "Video playback failed",
        { component: "player", endpoint: video.currentSrc });
    } else if (event instanceof ErrorEvent) reportDiagnostic("CRASH", "UNCAUGHT_JS", event.error || event.message);
  }, true);
  window.addEventListener("unhandledrejection", event => reportDiagnostic("CRASH", "UNHANDLED_REJECTION", event.reason));
  window.addEventListener("online", () => { retryAfter = 0; void flushDiagnostics(); });
  window.setInterval(() => void flushDiagnostics(), 60_000);
  void flushDiagnostics();
}
