import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyStorageRoot = path.resolve(__dirname, "../../storage");
const storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || legacyStorageRoot);
const logRoot = path.join(storageRoot, "mqtt-logs");

const MQTT_HOST = process.env.MQTT_HOST || "8.130.65.113";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_URL = process.env.MQTT_URL || `mqtt://${MQTT_HOST}:${MQTT_PORT}`;

const DEFAULT_TOPICS = [
  "infini/tv/control/#",
  "infini/tv/session/#",
  "infini/tv/pairing"
];

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function dayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeText(value) {
  return String(value || "").trim();
}

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

function guessDeviceId(payload) {
  const deviceId = payload?.deviceId || payload?.device_id || "";
  return safeText(deviceId).toUpperCase();
}

function guessType(payload) {
  return safeText(payload?.type || payload?.action || payload?.event || "");
}

function writeJsonl(event) {
  ensureDir(logRoot);
  const dkey = dayKey();
  const namespace = safeText(event.namespace || "__unknown__") || "__unknown__";
  const deviceId = safeText(event.deviceId || "__unknown__") || "__unknown__";
  const targetDir = path.join(logRoot, dkey, namespace);
  ensureDir(targetDir);
  const filePath = path.join(targetDir, `${deviceId}.jsonl`);
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

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
const listeners = new Set();

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

export function subscribeOpsEvents(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

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
