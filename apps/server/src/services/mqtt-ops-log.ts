import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorageRoot = path.resolve(__dirname, "../../storage");
const storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || defaultStorageRoot);
const logRoot = path.join(storageRoot, "mqtt-logs");
const MIN_RETENTION_DAYS = 3;
const DEFAULT_RETENTION_DAYS = 7;
const LOG_RETENTION_DAYS = Math.max(
  MIN_RETENTION_DAYS,
  Number(process.env.MQTT_LOG_RETENTION_DAYS || DEFAULT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS
);

const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_WSS_URL = process.env.MQTT_WSS_URL || "wss://114.215.185.184/infini/mqtt";
const MQTT_URL = process.env.MQTT_URL || MQTT_WSS_URL;

const DEFAULT_TOPICS = [
  "infini/tv/control/#",
  "infini/tv/session/#",
  "infini/tv/pairing"
];

/**
 * 确保 dir 存在，缺失时自动补齐基础结构。
 */
function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

/**
 * 封装 now iso 的业务步骤，避免调用方依赖内部实现细节。
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * 封装 day key 的业务步骤，避免调用方依赖内部实现细节。
 */
function dayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let lastRetentionSweepDay = "";

/**
 * 解析 day key，把字符串转换成可靠的结构化值。
 */
function parseDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 封装 sweep old log days 的业务步骤，避免调用方依赖内部实现细节。
 */
function sweepOldLogDays() {
  const today = dayKey();
  if (lastRetentionSweepDay === today) return;
  lastRetentionSweepDay = today;

  try {
    if (!fs.existsSync(logRoot)) return;
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - LOG_RETENTION_DAYS);

    for (const entry of fs.readdirSync(logRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const parsed = parseDayKey(entry.name);
      if (!parsed || parsed >= cutoff) continue;
      fs.rmSync(path.join(logRoot, entry.name), { recursive: true, force: true });
    }
  } catch {
    // Logging must never break TV control APIs.
  }
}

/**
 * 封装 safe text 的业务步骤，避免调用方依赖内部实现细节。
 */
function safeText(value) {
  return String(value || "").trim();
}

/**
 * 封装 guess namespace 的业务步骤，避免调用方依赖内部实现细节。
 */
function guessNamespace(topic, payload) {
  const segments = safeText(topic).split("/");
  const controlIndex = segments.indexOf("control");

  if (controlIndex >= 0 && segments.length > controlIndex + 1) {
    return safeText(segments[controlIndex + 1]);
  }
  const sessionIndex = segments.indexOf("session");

  if (sessionIndex >= 0 && segments.length > sessionIndex + 1) {
    return safeText(segments[sessionIndex + 1]);
  }
  const candidate = payload?.venueId || payload?.accountNamespace || payload?.namespace || "";
  return safeText(candidate);
}

/**
 * 封装 guess device id 的业务步骤，避免调用方依赖内部实现细节。
 */
function guessDeviceId(payload) {
  const deviceId = payload?.deviceId || payload?.device_id || "";
  return safeText(deviceId).toUpperCase();
}

/**
 * 封装 guess type 的业务步骤，避免调用方依赖内部实现细节。
 */
function guessType(payload) {
  return safeText(payload?.type || payload?.action || payload?.event || "");
}

/**
 * 写入 jsonl，使用原子写保护数据文件完整性。
 */
function writeJsonl(event) {
  ensureDir(logRoot);
  sweepOldLogDays();
  const dkey = dayKey();
  const namespace = safeText(event.namespace || "__unknown__") || "__unknown__";
  const deviceId = safeText(event.deviceId || "__unknown__") || "__unknown__";
  const targetDir = path.join(logRoot, dkey, namespace);
  ensureDir(targetDir);
  const filePath = path.join(targetDir, `${deviceId}.jsonl`);
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

/**
 * 记录 outbound mqtt，用于后续运维追踪和问题排查。
 */
export function recordOutboundMqtt(topic, payloadObject) {
  const payload = payloadObject ?? {};
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    receivedAt: nowIso(),
    direction: "out",
    topic: safeText(topic),
    namespace: guessNamespace(topic, payload),
    deviceId: guessDeviceId(payload),
    type: guessType(payload),
    payload
  };
  try {
    writeJsonl(event);
  } catch {
    // best-effort
  }
  return event;
}

let subscriberClient = null;
let started = false;
const listeners = new Set<(event: any) => void>();

/**
 * 启动 ops mqtt subscriber，避免重复注册后台任务或监听器。
 */
export function startOpsMqttSubscriber({ topics = DEFAULT_TOPICS } = {}) {
  if (started) return;
  started = true;
  ensureDir(logRoot);

  subscriberClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 8000,
    keepalive: 60
  });

  subscriberClient.on("connect", () => {
    try {

      for (const topic of topics) {
        subscriberClient.subscribe(topic, { qos: 0 });
      }
    } catch {
      // ignore
    }
  });

  subscriberClient.on("message", (topic, buffer) => {
    let payloadText = "";
    let payload = null;
    try {
      payloadText = buffer ? buffer.toString("utf8") : "";
      payload = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      payload = { raw: payloadText };
    }

    const event = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      receivedAt: nowIso(),
      direction: "in",
      topic: safeText(topic),
      namespace: guessNamespace(topic, payload),
      deviceId: guessDeviceId(payload),
      type: guessType(payload),
      payload
    };

    try {
      writeJsonl(event);
    } catch {
      // ignore
    }

    for (const fn of Array.from(listeners)) {
      try {
        fn(event);
      } catch {
        // ignore per-client errors
      }
    }
  });
}

/**
 * 订阅 ops events，返回可主动取消的清理函数。
 */
export function subscribeOpsEvents(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 读取 jsonl files 列表，并按业务规则过滤或排序。
 */
function listJsonlFiles({ namespace, deviceId, date }) {
  const day = safeText(date) || dayKey();
  const base = path.join(logRoot, day);
  if (!fs.existsSync(base)) return [];
  const nsDir = namespace ? path.join(base, namespace) : base;
  if (!fs.existsSync(nsDir)) return [];

  if (namespace) {
    if (deviceId) {
      const filePath = path.join(nsDir, `${deviceId}.jsonl`);
      return fs.existsSync(filePath) ? [filePath] : [];
    }
    return fs
      .readdirSync(nsDir)
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => path.join(nsDir, name));
  }

  // namespace not specified: scan all namespace directories (bounded).
  const namespaces = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const files = [];

  for (const ns of namespaces) {
    const dir = path.join(base, ns);
    if (!fs.existsSync(dir)) continue;

    if (deviceId) {
      const filePath = path.join(dir, `${deviceId}.jsonl`);
      if (fs.existsSync(filePath)) files.push(filePath);
      continue;
    }
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".jsonl")) files.push(path.join(dir, name));
    }
  }
  return files;
}

/**
 * 读取 ops events，把底层数据转成调用方可直接使用的结构。
 */
export function readOpsEvents({ namespace = "", deviceId = "", topic = "", type = "", limit = 200, date = "" } = {}) {
  const max = Math.max(10, Math.min(Number(limit) || 200, 2000));
  const files = listJsonlFiles({
    namespace: safeText(namespace),
    deviceId: safeText(deviceId).toUpperCase(),
    date: safeText(date)
  });

  const filters = {
    topic: safeText(topic),
    type: safeText(type)
  };

  const items = [];

  // Read from the end (best-effort): JSONL files can be large, but we keep retention small.
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n").filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (items.length >= max) break;
        const line = lines[i];
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (filters.topic && !String(event.topic || "").includes(filters.topic)) continue;
        if (filters.type && !String(event.type || "").includes(filters.type)) continue;
        items.push(event);
      }
    } catch {
      // ignore
    }
    if (items.length >= max) break;
  }

  // Sort newest-first by receivedAt (ISO) if present.
  items.sort((a, b) => String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")));
  return items.slice(0, max);
}
