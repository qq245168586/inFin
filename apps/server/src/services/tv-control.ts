import mqtt from "mqtt";
import { recordOutboundMqtt } from "./mqtt-ops-log.js";
import { createJsonHttpClient } from "../utils/http-client.js";

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
const mqttGatewayClient = createJsonHttpClient({
  baseUrl: MQTT_CLIENT_HTTP_URL,
  timeoutMs: MQTT_CLIENT_HTTP_TIMEOUT_MS,
  defaultHeaders: MQTT_CLIENT_HTTP_TOKEN ? { authorization: `Bearer ${MQTT_CLIENT_HTTP_TOKEN}` } : {}
});

let clientPromise = null;

/**
 * 创建 client promise，并补齐运行时需要的默认配置。
 */
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

/**
 * 组装 topic，把分散的输入合成稳定输出。
 */
function buildTopic(accountNamespace = "") {
  const normalized = String(accountNamespace || "").trim().toLowerCase();

  if (!normalized) {
    return `${MQTT_CONTROL_TOPIC}/__unbound__`;
  }
  return `${MQTT_CONTROL_TOPIC}/${normalized}`;
}

/**
 * 组装 session topic，把分散的输入合成稳定输出。
 */
function buildSessionTopic(accountNamespace = "") {
  const normalized = String(accountNamespace || "").trim().toLowerCase();
  return `${MQTT_SESSION_TOPIC}/${normalized || "__unbound__"}`;
}

/**
 * 读取 client，并保持返回结构稳定。
 */
async function getClient() {
  if (!clientPromise) {
    clientPromise = createClientPromise();
  }

  return clientPromise;
}

/**
 * 发布 direct，优先走网关并在允许时回退直连。
 */
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

/**
 * 发布 via gateway，优先走网关并在允许时回退直连。
 */
async function publishViaGateway(pathname, body) {
  if (!mqttGatewayClient) {
    return null;
  }

  return mqttGatewayClient.post(pathname, body);
}

/**
 * 发布 with gateway fallback，优先走网关并在允许时回退直连。
 */
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

/**
 * 发布 tv control，优先走网关并在允许时回退直连。
 */
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

/**
 * 发布 tv session event，优先走网关并在允许时回退直连。
 */
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
    commandId: String(session?.lastCommandId || "").trim(),
    lastCommandId: String(session?.lastCommandId || "").trim(),
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

/**
 * 读取 tv control config，并保持返回结构稳定。
 */
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
