import mqtt from "mqtt";
import { recordOutboundMqtt } from "./mqtt-ops-log.js";

const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_WSS_URL = process.env.MQTT_WSS_URL || "wss://api.infintraining.work/mqtt";
const MQTT_URL = process.env.MQTT_URL || MQTT_WSS_URL;
const MQTT_CONTROL_TOPIC = process.env.MQTT_TOPIC_CONTROL || "infini/tv/control";
const MQTT_SESSION_TOPIC = process.env.MQTT_TOPIC_SESSION || "infini/tv/session";
const MQTT_CLIENT_HTTP_URL = String(process.env.MQTT_CLIENT_HTTP_URL || process.env.MQTT_GATEWAY_URL || "").trim();
const MQTT_CLIENT_HTTP_TOKEN = String(process.env.MQTT_CLIENT_HTTP_TOKEN || "").trim();
const MQTT_CLIENT_HTTP_TIMEOUT_MS = Number(process.env.MQTT_CLIENT_HTTP_TIMEOUT_MS || 8000);
const MQTT_CLIENT_FALLBACK_DIRECT = String(process.env.MQTT_CLIENT_FALLBACK_DIRECT || "1") !== "0";

let clientPromise = null;

function createClientPromise() {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 8000,
      keepalive: 60
    });

    const handleConnect = () => {
      client.off("error", handleInitialError);
      resolve(client);
    };

    const handleInitialError = (error) => {
      client.off("connect", handleConnect);
      client.end(true);
      clientPromise = null;
      reject(error);
    };

    client.once("connect", handleConnect);
    client.once("error", handleInitialError);
    client.on("close", () => {
      clientPromise = null;
    });
  });
}

function buildTopic(accountNamespace = "") {
  const normalized = String(accountNamespace || "").trim().toLowerCase();
  if (!normalized) {
    return `${MQTT_CONTROL_TOPIC}/__unbound__`;
  }
  return `${MQTT_CONTROL_TOPIC}/${normalized}`;
}

function buildSessionTopic(accountNamespace = "") {
  const normalized = String(accountNamespace || "").trim().toLowerCase();
  return `${MQTT_SESSION_TOPIC}/${normalized || "__unbound__"}`;
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = createClientPromise();
  }

  return clientPromise;
}

async function publishDirect(topic, payloadObject, { qos = 0, retain = false } = {}) {
  const client = await getClient();
  const message = JSON.stringify(payloadObject);

  try {
    recordOutboundMqtt(topic, payloadObject);
  } catch {
    // ignore
  }

  await new Promise((resolve, reject) => {
    client.publish(topic, message, { qos, retain }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  return {
    topic,
    payload: payloadObject,
    transport: "direct"
  };
}

async function publishViaGateway(pathname, body) {
  if (!MQTT_CLIENT_HTTP_URL || typeof fetch !== "function") {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MQTT_CLIENT_HTTP_TIMEOUT_MS);
  try {
    const url = new URL(pathname, MQTT_CLIENT_HTTP_URL.endsWith("/") ? MQTT_CLIENT_HTTP_URL : `${MQTT_CLIENT_HTTP_URL}/`);
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (MQTT_CLIENT_HTTP_TOKEN) {
      headers.authorization = `Bearer ${MQTT_CLIENT_HTTP_TOKEN}`;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const message = payload?.message || payload?.error || `MQTT client HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function publishWithGatewayFallback(pathname, body, topic, payloadObject, directOptions) {
  if (MQTT_CLIENT_HTTP_URL) {
    try {
      const gatewayPayload = await publishViaGateway(pathname, body);
      if (gatewayPayload) {
        return {
          topic: gatewayPayload.topic || topic,
          payload: gatewayPayload.payload || payloadObject,
          transport: "mqtt-client",
          gateway: gatewayPayload
        };
      }
    } catch (error) {
      if (!MQTT_CLIENT_FALLBACK_DIRECT) {
        throw error;
      }
      console.warn(
        "MQTT client gateway failed; falling back to direct publish:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return publishDirect(topic, payloadObject, directOptions);
}

export async function publishTvControl(payload, accountNamespace = "") {
  const normalizedAccountNamespace = String(accountNamespace || "").trim().toLowerCase();
  const shouldInjectNamespace = normalizedAccountNamespace && normalizedAccountNamespace !== "__unbound__";
  const nextPayload = shouldInjectNamespace
    ? {
        ...payload,
        accountNamespace: payload?.accountNamespace || normalizedAccountNamespace,
        venueId: payload?.venueId || payload?.accountNamespace || normalizedAccountNamespace
      }
    : payload;
  const topic = buildTopic(accountNamespace);

  return publishWithGatewayFallback(
    "/tv/control",
    {
      accountNamespace,
      payload: nextPayload,
      qos: 0,
      retain: false,
      source: nextPayload?.source || "server"
    },
    topic,
    nextPayload,
    { qos: 0, retain: false }
  );
}

export async function publishTvSessionEvent(session, accountNamespace = "") {
  const normalizedAccountNamespace =
    String(accountNamespace || session?.accountNamespace || "").trim().toLowerCase() || "__unbound__";
  const serverNowMs = Date.now();
  const payload: Record<string, any> = {
    type: "session_updated",
    accountNamespace: normalizedAccountNamespace,
    sessionId: String(session?.id || "").trim(),
    version: Number(session?.version) || 0,
    state: String(session?.state || "").trim().toUpperCase(),
    scheduleId: String(session?.scheduleId || "").trim(),
    courseId: Number(session?.courseId) || 0,
    bundleChecksum: String(session?.bundleChecksum || "").trim(),
    serverStartAtMs: Number(session?.serverStartAtMs) || 0,
    playbackStartAtMs: Number(session?.serverStartAtMs) || 0,
    startDelayMs: Number(session?.startDelayMs) || 0,
    pausedAccumulatedMs: Number(session?.pausedAccumulatedMs) || 0,
    pausedAtMs: Number(session?.pausedAtMs) || 0,
    endedAtMs: Number(session?.endedAtMs) || 0,
    terminatedAtMs: Number(session?.terminatedAtMs) || 0,
    expectedDurationMs: Number(session?.expectedDurationMs) || 0,
    serverNowMs,
    updatedAtMs: Number(session?.updatedAtMs) || serverNowMs
  };
  const topic = buildSessionTopic(normalizedAccountNamespace);

  return publishWithGatewayFallback(
    "/tv/session",
    {
      accountNamespace: normalizedAccountNamespace,
      payload,
      qos: 1,
      retain: false,
      source: payload?.source || "server"
    },
    topic,
    payload,
    { qos: 1, retain: false }
  );
}

export function getTvControlConfig(accountNamespace = "") {
  return {
    url: MQTT_URL,
    accountNamespace: String(accountNamespace || "").trim().toLowerCase(),
    topic: buildTopic(accountNamespace),
    sessionTopic: buildSessionTopic(accountNamespace),
    mqttClientHttpUrl: MQTT_CLIENT_HTTP_URL || "",
    fallbackDirect: MQTT_CLIENT_FALLBACK_DIRECT
  };
}
