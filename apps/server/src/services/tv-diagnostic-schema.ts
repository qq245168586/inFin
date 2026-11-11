import { timingSafeEqual } from "node:crypto";

export const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
export const DIAGNOSTIC_RETENTION_MS = 10 * 24 * 60 * 60 * 1000;
export const DIAGNOSTIC_TYPES = new Set([
  "PLAYBACK_ERROR", "NETWORK_ERROR", "API_ERROR", "DOWNLOAD_ERROR", "CRASH", "MQTT_ERROR"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTEXT_FIELDS = new Set([
  "courseId", "scheduleId", "sessionId", "sessionVersion", "playbackState", "component",
  "endpoint", "method", "httpStatus", "mediaFile", "cardId", "station", "what", "extra",
  "exceptionClass", "thread", "androidVersion", "model", "elapsedMs",
  "actionId", "actionName", "stage", "sourceUrl", "contentType", "page", "userId"
]);

export interface DiagnosticIdentity {
  source?: "tv" | "websimulator";
  deviceId: string;
  accountNamespace: string;
  screenNumber: number;
  appVersion: string;
}

/** Uses only the authenticated account, never browser-supplied device or venue identifiers. */
export function simulatorDiagnosticIdentity(user: { id: number }): DiagnosticIdentity {
  if (!Number.isSafeInteger(user.id) || user.id < 1) {
    throw new DiagnosticError(403, "INVALID_LOG_USER", "Authenticated user required.");
  }
  return { source: "websimulator", deviceId: `websimulator-user-${user.id}`,
    accountNamespace: "websimulator", screenNumber: 0, appVersion: "web" };
}

export class DiagnosticError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Redacts credentials and all URL query/fragment data before bounded file storage. */
export function redactDiagnosticText(value: string, limit: number): string {
  return value
    .replace(/\b(?:https?|wss?|tcp):\/\/[^\s"'<>]+/gi, (text) => {
      try {
        const url = new URL(text);
        return `${url.protocol}//${url.host}${url.pathname}`;
      } catch { return "[redacted-url]"; }
    })
    .replace(/\/(?:infini\/|api\/|simulator-media\/)[^\s"'<>]+/g, text => text.split(/[?#]/)[0])
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.:-]+/gi, "[redacted-auth]")
    .replace(/(["']?(?:authorization|cookie|password|pairToken|accessToken|refreshToken|token|secret|signature|accessKeyId|accessKeySecret)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[redacted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, limit);
}

/** Authenticates an existing binding; this endpoint never registers or mutates a device. */
export function authenticateDiagnosticDevice(
  headers: Record<string, string | string[] | undefined>, devices: any[]
): DiagnosticIdentity {
  const header = (name: string) => typeof headers[name] === "string" ? headers[name] as string : "";
  const deviceId = header("x-infini-device-id");
  const accountNamespace = header("x-infini-namespace");
  const screenNumber = Number(header("x-infini-screen-number"));
  const appVersion = header("x-infini-app-version");
  const supplied = header("x-infini-pair-token");
  const device = devices.find((item) => item.deviceId === deviceId);
  const expected = String(device?.pairToken || "");
  const safe = /^[A-Za-z0-9_-]{1,80}$/;
  if (!safe.test(deviceId) || !safe.test(accountNamespace)
      || !/^[A-Za-z0-9._-]{1,40}$/.test(appVersion)
      || !Number.isInteger(screenNumber) || screenNumber < 1 || screenNumber > 5
      || !device || device.accountNamespace !== accountNamespace
      || Number(device.screenNumber) !== screenNumber || !expected || supplied.length > 128
      || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)
      || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    throw new DiagnosticError(403, "DEVICE_IDENTITY_MISMATCH", "Device binding or credential is invalid.");
  }
  return { deviceId, accountNamespace, screenNumber, appVersion };
}

/** Validates a retry-stable identifier without ever trusting a client filename. */
export function validateDiagnosticLogId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new DiagnosticError(400, "INVALID_LOG_ID", "A UUID log id is required.");
  }
  return value.toLowerCase();
}

/** Parses the small JSONL upload into a strict, sanitized event whitelist. */
export function parseDiagnosticEvents(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_DIAGNOSTIC_BYTES) {
    throw new DiagnosticError(buffer.length ? 413 : 400, "INVALID_LOG_SIZE", "Empty or oversized log file.");
  }
  const lines = buffer.toString("utf8").trim().split(/\r?\n/);
  if (lines.length > 50) throw new DiagnosticError(413, "TOO_MANY_EVENTS", "At most 50 events per file.");
  try {
    return lines.map((line) => {
      const event = JSON.parse(line);
      if (!event || typeof event !== "object" || !UUID.test(event.id || "")
          || typeof event.occurredAt !== "string"
          || !/^\d{4}-\d\d-\d\dT.*Z$/.test(event.occurredAt)
          || !Number.isFinite(Date.parse(event.occurredAt))
          || !DIAGNOSTIC_TYPES.has(event.type)
          || typeof event.code !== "string" || !/^[A-Za-z0-9_.:-]{1,80}$/.test(event.code)
          || typeof event.message !== "string" || !event.message.trim()) {
        throw new Error("Invalid diagnostic event");
      }
      const context: Record<string, string | number | boolean> = {};
      if (event.context && typeof event.context === "object" && !Array.isArray(event.context)) {
        for (const [key, value] of Object.entries(event.context)) {
          if (!CONTEXT_FIELDS.has(key)) continue;
          if (typeof value === "string") context[key] = redactDiagnosticText(value, 512);
          else if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) context[key] = value;
        }
      }
      return {
        id: event.id.toLowerCase(), occurredAt: new Date(event.occurredAt).toISOString(),
        type: event.type as string, code: event.code,
        message: redactDiagnosticText(event.message, 2048),
        stackTrace: redactDiagnosticText(typeof event.stackTrace === "string" ? event.stackTrace : "", 8192),
        context
      };
    });
  } catch {
    throw new DiagnosticError(400, "INVALID_LOG_EVENT", "Invalid JSONL event schema.");
  }
}
