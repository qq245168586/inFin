import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyStorageRoot = path.resolve(__dirname, "../../server/storage");
const storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || legacyStorageRoot);
const logRoot = path.resolve(process.env.MQTT_CLIENT_LOG_ROOT || path.join(storageRoot, "mqtt-logs"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || process.env.MQTT_CLIENT_PORT || 3205);
const HTTP_TOKEN = String(process.env.MQTT_CLIENT_HTTP_TOKEN || "").trim();

const MQTT_HOST = process.env.MQTT_HOST || "8.130.65.113";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_URL = process.env.MQTT_URL || `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const MQTT_CONTROL_TOPIC = process.env.MQTT_TOPIC_CONTROL || "infini/tv/control";
const MQTT_SESSION_TOPIC = process.env.MQTT_TOPIC_SESSION || "infini/tv/session";

let mqttClient = null;
let connected = false;
let connectingPromise = null;
let lastConnectAt = "";
let lastError = "";
const recentEvents = [];

function nowIso() {
  return new Date().toISOString();
}

function dayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeNamespace(value = "") {
  return String(value || "").trim().toLowerCase();
}

function safeDeviceId(value = "") {
  return String(value || "").trim().toUpperCase();
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function buildControlTopic(accountNamespace = "") {
  const normalized = normalizeNamespace(accountNamespace);
  return `${MQTT_CONTROL_TOPIC}/${normalized || "__unbound__"}`;
}

function buildSessionTopic(accountNamespace = "") {
  const normalized = normalizeNamespace(accountNamespace);
  return `${MQTT_SESSION_TOPIC}/${normalized || "__unbound__"}`;
}

function guessNamespace(topic, payload) {
  const segments = String(topic || "").split("/");
  const controlIndex = segments.indexOf("control");
  if (controlIndex >= 0 && segments.length > controlIndex + 1) {
    return normalizeNamespace(segments[controlIndex + 1]);
  }
  const sessionIndex = segments.indexOf("session");
  if (sessionIndex >= 0 && segments.length > sessionIndex + 1) {
    return normalizeNamespace(segments[sessionIndex + 1]);
  }
  return normalizeNamespace(payload?.venueId || payload?.accountNamespace || payload?.namespace || "");
}

function guessDeviceId(payload) {
  return safeDeviceId(payload?.deviceId || payload?.device_id || "");
}

function appendLog(event) {
  recentEvents.unshift(event);
  recentEvents.splice(300);

  try {
    const namespace = normalizeNamespace(event.namespace) || "__unknown__";
    const deviceId = safeDeviceId(event.deviceId) || "__unknown__";
    const targetDir = path.join(logRoot, dayKey(), namespace);
    ensureDir(targetDir);
    fs.appendFileSync(path.join(targetDir, `${deviceId}.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
  } catch (error) {
    console.warn("Failed to write MQTT client log:", error instanceof Error ? error.message : String(error));
  }
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  });
  response.end(body);
}

function unauthorized(response) {
  sendJson(response, 401, { ok: false, message: "Unauthorized." });
}

function requireAuth(request, response) {
  if (!HTTP_TOKEN) {
    return true;
  }
  const authorization = String(request.headers.authorization || "");
  if (authorization === `Bearer ${HTTP_TOKEN}`) {
    return true;
  }
  unauthorized(response);
  return false;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("请求体不是有效 JSON。"));
      }
    });
    request.on("error", reject);
  });
}

function createMqttClient() {
  const client = mqtt.connect(MQTT_URL, {
    clientId: `infini-mqtt-client-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 8000,
    keepalive: 60
  });

  client.on("connect", () => {
    connected = true;
    lastConnectAt = nowIso();
    lastError = "";
    console.log(`MQTT client connected: ${MQTT_URL}`);
  });

  client.on("reconnect", () => {
    connected = false;
  });

  client.on("close", () => {
    connected = false;
  });

  client.on("error", (error) => {
    connected = false;
    lastError = error instanceof Error ? error.message : String(error);
    console.warn("MQTT client error:", lastError);
  });

  return client;
}

function ensureMqttClient() {
  if (mqttClient) {
    if (connected) {
      return Promise.resolve(mqttClient);
    }
    if (connectingPromise) {
      return connectingPromise;
    }
  } else {
    mqttClient = createMqttClient();
  }

  connectingPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("MQTT 连接超时。"));
    }, 9000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      mqttClient?.off("connect", handleConnect);
      mqttClient?.off("error", handleError);
      connectingPromise = null;
    };

    const handleConnect = () => {
      cleanup();
      resolve(mqttClient);
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    mqttClient.once("connect", handleConnect);
    mqttClient.once("error", handleError);
  });

  return connectingPromise;
}

async function publishMqtt({ topic, payload, qos = 0, retain = false, source = "http" }) {
  const normalizedTopic = String(topic || "").trim();
  if (!normalizedTopic) {
    throw new Error("topic 不能为空。");
  }

  const client = await ensureMqttClient();
  const nextPayload = payload && typeof payload === "object" ? payload : {};
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    receivedAt: nowIso(),
    direction: "out",
    source: String(source || "http"),
    topic: normalizedTopic,
    namespace: guessNamespace(normalizedTopic, nextPayload),
    deviceId: guessDeviceId(nextPayload),
    type: String(nextPayload?.type || ""),
    qos: Number(qos) || 0,
    retain: Boolean(retain),
    payload: nextPayload
  };

  await new Promise((resolve, reject) => {
    client.publish(normalizedTopic, JSON.stringify(nextPayload), { qos: event.qos, retain: event.retain }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  appendLog(event);

  return {
    ok: true,
    topic: normalizedTopic,
    payload: nextPayload,
    qos: event.qos,
    retain: event.retain,
    eventId: event.id,
    transport: "mqtt-client"
  };
}

async function routePublish(request, response, pathname) {
  const body = await readJsonBody(request);
  if (pathname === "/publish") {
    const result = await publishMqtt({
      topic: body.topic,
      payload: body.payload,
      qos: body.qos,
      retain: body.retain,
      source: body.source || "http-publish"
    });
    sendJson(response, 200, result);
    return;
  }

  if (pathname === "/tv/control") {
    const accountNamespace = normalizeNamespace(body.accountNamespace || body.payload?.accountNamespace || body.payload?.venueId || "");
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const shouldInjectNamespace = accountNamespace && accountNamespace !== "__unbound__";
    const nextPayload = shouldInjectNamespace
      ? {
          ...payload,
          accountNamespace: payload.accountNamespace || accountNamespace,
          venueId: payload.venueId || payload.accountNamespace || accountNamespace
        }
      : payload;
    const result = await publishMqtt({
      topic: buildControlTopic(accountNamespace),
      payload: nextPayload,
      qos: body.qos ?? 0,
      retain: body.retain ?? false,
      source: body.source || "tv-control"
    });
    sendJson(response, 200, result);
    return;
  }

  if (pathname === "/tv/session") {
    const accountNamespace = normalizeNamespace(body.accountNamespace || body.payload?.accountNamespace || "");
    const result = await publishMqtt({
      topic: buildSessionTopic(accountNamespace),
      payload: body.payload || {},
      qos: body.qos ?? 1,
      retain: body.retain ?? false,
      source: body.source || "tv-session"
    });
    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { ok: false, message: "Route not found." });
}

function healthPayload() {
  return {
    ok: true,
    service: "infini-mqtt-client",
    mqtt: {
      url: MQTT_URL,
      connected,
      lastConnectAt,
      lastError
    },
    logRoot,
    now: nowIso()
  };
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, healthPayload());
      return;
    }

    if (request.method === "GET" && url.pathname === "/events") {
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 100, 300));
      sendJson(response, 200, {
        ok: true,
        data: recentEvents.slice(0, limit)
      });
      return;
    }

    if (request.method === "POST" && ["/publish", "/tv/control", "/tv/session"].includes(url.pathname)) {
      if (!requireAuth(request, response)) {
        return;
      }
      await routePublish(request, response, url.pathname);
      return;
    }

    sendJson(response, 404, { ok: false, message: "Route not found." });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Internal Server Error"
    });
  }
});

ensureDir(logRoot);
ensureMqttClient().catch((error) => {
  lastError = error instanceof Error ? error.message : String(error);
  console.warn("Initial MQTT connection failed:", lastError);
});

server.listen(PORT, HOST, () => {
  console.log(`Infini MQTT client service listening on http://${HOST}:${PORT}`);
});
