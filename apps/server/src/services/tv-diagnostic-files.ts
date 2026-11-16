import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  DiagnosticError, DIAGNOSTIC_RETENTION_MS, DIAGNOSTIC_TYPES, MAX_DIAGNOSTIC_BYTES,
  parseDiagnosticEvents, validateDiagnosticLogId, type DiagnosticIdentity
} from "./tv-diagnostic-schema.js";

const GENERATED_FILE = /^\d{8}T\d{9}_(?:screen-[1-5]|websimulator)_[A-Za-z0-9_-]+_v[A-Za-z0-9._-]+_[a-f0-9-]{36}\.jsonl$/;
const TEMP_FILE = /^\.[a-f0-9-]{36}\.tmp$/;
const MAX_QUERY_FILES = 2048;
const MAX_QUERY_BYTES = 64 * 1024 * 1024;

export interface TvDiagnosticQuery {
  source?: string;
  namespace?: string;
  deviceId?: string;
  date?: string;
  screenNumber?: number | string;
  type?: string;
  code?: string;
  limit?: number | string;
}

export interface TvDiagnosticRecord {
  source?: "tv" | "websimulator";
  id: string;
  occurredAt: string;
  receivedAt: string;
  type: string;
  code: string;
  message: string;
  stackTrace: string;
  context: Record<string, string | number | boolean>;
  deviceId: string;
  accountNamespace: string;
  screenNumber: number;
  appVersion: string;
  logId: string;
}

/** Uses Beijing time in paths while event timestamps stay explicit UTC ISO strings. */
function beijingTimestamp(now: number) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().replace(/[-:.]/g, "").replace("Z", "");
}

/** File-only bounded storage; writes/retention are serialized to make quotas race-safe. */
export class TvDiagnosticFiles {
  private pending: Promise<unknown> = Promise.resolve();
  private pendingOperations = 0;
  private attempts = new Map<string, { minute: number; count: number }>();

  constructor(readonly root: string, private now: () => number = Date.now) {}

  /** Authenticated per-device admission before reading a file body; no unbounded key growth. */
  admit(deviceId: string) {
    const minute = Math.floor(this.now() / 60_000);
    for (const [key, entry] of this.attempts) if (entry.minute !== minute) this.attempts.delete(key);
    const entry = this.attempts.get(deviceId) || { minute, count: 0 };
    if (entry.count >= 12 || (!this.attempts.has(deviceId) && this.attempts.size >= 1000)) {
      throw new DiagnosticError(429, "LOG_RATE_LIMIT", "Log upload rate limit exceeded.");
    }
    entry.count++;
    this.attempts.set(deviceId, entry);
  }

  /** Publishes a complete file atomically and acknowledges retries only after durable storage. */
  receive(identity: DiagnosticIdentity, logId: string, buffer: Buffer) {
    logId = validateDiagnosticLogId(logId);
    const events = parseDiagnosticEvents(buffer);
    const checksum = createHash("sha256").update(JSON.stringify(events)).digest("hex");
    return this.serialize(async () => {
      const now = this.now();
      const receivedAt = new Date(now).toISOString();
      const recent = (await this.files()).filter(file => !TEMP_FILE.test(path.basename(file.path)));
      const existing = recent.find((file) => file.path.endsWith(`_${logId}.jsonl`)
        && path.basename(path.dirname(file.path)) === identity.deviceId
        && path.basename(path.dirname(path.dirname(file.path))) === identity.accountNamespace
        && file.mtimeMs > now - DIAGNOSTIC_RETENTION_MS);
      if (existing) {
        const first = JSON.parse((await fs.readFile(existing.path, "utf8")).split("\n")[0]);
        if (first.batchChecksum !== checksum) throw new DiagnosticError(409, "LOG_ID_CONFLICT", "Log id has different content.");
        return { duplicate: true, logId, receivedAt: first.receivedAt };
      }
      const stamp = beijingTimestamp(now);
      const day = stamp.slice(0, 8);
      const relativeDir = path.join(day, identity.accountNamespace, identity.deviceId);
      const content = events.map((event) => JSON.stringify({
        ...event, ...identity, logId, receivedAt, batchChecksum: checksum
      })).join("\n") + "\n";
      const size = Buffer.byteLength(content);
      if (size > MAX_DIAGNOSTIC_BYTES) throw new DiagnosticError(413, "NORMALIZED_LOG_TOO_LARGE", "Normalized log is too large.");
      const today = recent.filter((file) => path.relative(this.root, file.path).split(path.sep)[0] === day);
      const own = today.filter((file) => path.dirname(file.path) === path.join(this.root, relativeDir));
      if (own.length >= 256 || own.reduce((sum, file) => sum + file.size, 0) + size > 2 * 1024 * 1024
          || today.reduce((sum, file) => sum + file.size, 0) + size > 32 * 1024 * 1024) {
        throw new DiagnosticError(429, "LOG_DAILY_QUOTA", "Daily diagnostic quota exceeded.");
      }
      const directory = path.join(this.root, relativeDir);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const origin = identity.source === "websimulator" ? "websimulator" : `screen-${identity.screenNumber}`;
      const filename = `${stamp}_${origin}_${identity.deviceId}_v${identity.appVersion}_${logId}.jsonl`;
      const target = path.join(directory, filename);
      const temp = path.join(directory, `.${randomUUID()}.tmp`);
      try {
        const handle = await fs.open(temp, "wx", 0o600);
        try { await handle.writeFile(content, "utf8"); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temp, target);
        await fs.utimes(target, new Date(now), new Date(now));
      } finally {
        await fs.rm(temp, { force: true });
      }
      return { duplicate: false, logId, receivedAt };
    });
  }

  /** Reads bounded, sanitized records for the super-admin ops console without exposing file paths. */
  async query(input: TvDiagnosticQuery = {}) {
    const source = String(input.source || "");
    const namespace = String(input.namespace || "").trim();
    const deviceId = String(input.deviceId || "").trim();
    const date = String(input.date || "").trim();
    const screenText = String(input.screenNumber || "").trim();
    const type = String(input.type || "").trim().toUpperCase();
    const code = String(input.code || "").trim().toLowerCase();
    const limit = Math.max(10, Math.min(Number(input.limit) || 200, 1000));
    const safe = /^[A-Za-z0-9_-]{1,80}$/;
    if ((source && !["tv", "websimulator"].includes(source))
        || (namespace && !safe.test(namespace)) || (deviceId && !safe.test(deviceId))
        || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        || (screenText && (!/^[1-5]$/.test(screenText)))
        || (type && !DIAGNOSTIC_TYPES.has(type)) || code.length > 80) {
      throw new DiagnosticError(400, "INVALID_DIAGNOSTIC_QUERY", "Invalid diagnostic query filters.");
    }

    const day = date.replaceAll("-", "");
    const cutoff = this.now() - DIAGNOSTIC_RETENTION_MS;
    const candidates = (await this.files())
      .filter((file) => !TEMP_FILE.test(path.basename(file.path)) && file.mtimeMs > cutoff)
      .filter((file) => {
        const relative = path.relative(this.root, file.path).split(path.sep);
        return (!day || relative[0] === day)
          && (!namespace || relative[1] === namespace)
          && (!deviceId || relative[2] === deviceId);
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    const records: TvDiagnosticRecord[] = [];
    const typeCounts: Record<string, number> = Object.fromEntries(
      Array.from(DIAGNOSTIC_TYPES, (name) => [name, 0])
    );
    const devices = new Set<string>();
    let total = 0;
    let filteredTotal = 0;
    let scannedFiles = 0;
    let scannedBytes = 0;
    let truncated = candidates.length > MAX_QUERY_FILES;

    for (const file of candidates.slice(0, MAX_QUERY_FILES)) {
      if (scannedBytes + file.size > MAX_QUERY_BYTES) {
        truncated = true;
        break;
      }
      scannedFiles++;
      scannedBytes += file.size;
      try {
        const content = await fs.readFile(file.path, "utf8");
        for (const line of content.split(/\r?\n/)) {
          if (!line) continue;
          const event = JSON.parse(line) as TvDiagnosticRecord & { batchChecksum?: string };
          const eventSource = event.source || "tv";
          if (source && source !== eventSource) continue;
          if (screenText && Number(event.screenNumber) !== Number(screenText)) continue;
          if (code && !String(event.code || "").toLowerCase().includes(code)) continue;
          if (!DIAGNOSTIC_TYPES.has(String(event.type || ""))) continue;
          total++;
          typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
          devices.add(event.deviceId);
          if (type && event.type !== type) continue;
          filteredTotal++;
          records.push({
            source: eventSource,
            id: event.id,
            occurredAt: event.occurredAt,
            receivedAt: event.receivedAt,
            type: event.type,
            code: event.code,
            message: event.message,
            stackTrace: event.stackTrace || "",
            context: event.context || {},
            deviceId: event.deviceId,
            accountNamespace: event.accountNamespace,
            screenNumber: Number(event.screenNumber),
            appVersion: event.appVersion,
            logId: event.logId
          });
        }
      } catch {
        // A damaged file must not prevent the remaining diagnostic records from being inspected.
      }
    }

    records.sort((left, right) =>
      String(right.occurredAt || right.receivedAt).localeCompare(String(left.occurredAt || left.receivedAt))
    );
    return {
      items: records.slice(0, limit),
      summary: {
        total,
        filteredTotal,
        uniqueDevices: devices.size,
        latestAt: records[0]?.occurredAt || "",
        types: typeCounts,
        retentionDays: Math.round(DIAGNOSTIC_RETENTION_MS / (24 * 60 * 60 * 1000)),
        scannedFiles,
        scannedBytes,
        truncated
      }
    };
  }

  /** Removes only generated diagnostic files by server receipt age, never other storage data. */
  cleanup() {
    return this.serialize(async () => {
      const cutoff = this.now() - DIAGNOSTIC_RETENTION_MS;
      let removed = 0;
      for (const file of await this.files()) {
        if (file.mtimeMs <= cutoff || TEMP_FILE.test(path.basename(file.path))) {
          await fs.unlink(file.path); removed++;
        }
      }
      await this.removeEmptyDirectories(this.root, 0);
      return removed;
    });
  }

  /** Enumerates only the known three-level layout and refuses to traverse symlinks. */
  private async files(directory = this.root, depth = 0): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const result: Array<{ path: string; size: number; mtimeMs: number }> = [];
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory() && depth < 3
          && (depth === 0 ? /^\d{8}$/ : /^[A-Za-z0-9_-]{1,80}$/).test(entry.name)) {
        result.push(...await this.files(target, depth + 1));
      } else if (depth === 3 && entry.isFile() && (GENERATED_FILE.test(entry.name) || TEMP_FILE.test(entry.name))) {
        const stat = await fs.stat(target);
        result.push({ path: target, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
    return result;
  }

  /** Tidies empty date/device folders without removing the storage root or foreign files. */
  private async removeEmptyDirectories(directory: string, depth: number) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory() && depth < 3
          && (depth === 0 ? /^\d{8}$/ : /^[A-Za-z0-9_-]{1,80}$/).test(entry.name)) {
        await this.removeEmptyDirectories(path.join(directory, entry.name), depth + 1);
      }
    }
    if (depth > 0) await fs.rmdir(directory).catch(() => {});
  }

  /** Keeps a failed operation from poisoning later uploads or the retention timer. */
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pendingOperations >= 32) {
      return Promise.reject(new DiagnosticError(429, "LOG_STORAGE_BUSY", "Diagnostic upload queue is full."));
    }
    this.pendingOperations++;
    const next = this.pending.then(operation).finally(() => { this.pendingOperations--; });
    this.pending = next.catch(() => {});
    return next;
  }
}

const defaultStorage = fileURLToPath(new URL("../../storage/", import.meta.url));
export const tvDiagnosticFiles = new TvDiagnosticFiles(
  path.join(path.resolve(process.env.INFINI_DATA_ROOT || defaultStorage), "tv-diagnostics")
);
let retentionTimer: ReturnType<typeof setInterval> | undefined;

/** Runs even when no TV uploads arrive; cleanup failures never stop the API service. */
export function startTvDiagnosticRetention() {
  if (retentionTimer) return;
  const clean = () => tvDiagnosticFiles.cleanup().catch(() => console.warn("TV diagnostic retention cleanup failed."));
  retentionTimer = setInterval(clean, 60 * 60 * 1000);
  retentionTimer.unref();
  void clean();
}
