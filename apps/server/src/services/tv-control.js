import mqtt from "mqtt";
import { recordOutboundMqtt } from "./mqtt-ops-log.js";

const MQTT_HOST = process.env.MQTT_HOST || "8.130.65.113";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_URL = process.env.MQTT_URL || `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const MQTT_CONTROL_TOPIC = process.env.MQTT_TOPIC_CONTROL || "infini/tv/control";
const MQTT_SESSION_TOPIC = process.env.MQTT_TOPIC_SESSION || "infini/tv/session";

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

export async function publishTvControl(payload, accountNamespace = "") {
  const client = await getClient();
  const normalizedAccountNamespace = String(accountNamespace || "").trim().toLowerCase();
  const shouldInjectNamespace = normalizedAccountNamespace && normalizedAccountNamespace !== "__unbound__";
  const nextPayload = shouldInjectNamespace
    ? {
        ...payload,
        accountNamespace: payload?.accountNamespace || normalizedAccountNamespace,
        venueId: payload?.venueId || payload?.accountNamespace || normalizedAccountNamespace
      }
    : payload;
  const message = JSON.stringify(nextPayload);
  const topic = buildTopic(accountNamespace);

  // Best-effort outbound audit log (does not affect publish).
  try {
    recordOutboundMqtt(topic, nextPayload);
  } catch {
    // ignore
  }

  await new Promise((resolve, reject) => {
    client.publish(topic, message, { qos: 0, retain: false }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  return {
    topic,
    payload: nextPayload
  };
}

export async function publishTvSessionEvent(session, accountNamespace = "") {
  const client = await getClient();
  const normalizedAccountNamespace =
    String(accountNamespace || session?.accountNamespace || "").trim().toLowerCase() || "__unbound__";
  const serverNowMs = Date.now();
  const payload = {
    type: "session_updated",
    accountNamespace: normalizedAccountNamespace,
    sessionId: String(session?.id || "").trim(),
    version: Number(session?.version) || 0,
    state: String(session?.state || "").trim().toUpperCase(),
    serverNowMs,
    updatedAtMs: Number(session?.updatedAtMs) || serverNowMs
  };
  const topic = buildSessionTopic(normalizedAccountNamespace);

  try {
    recordOutboundMqtt(topic, payload);
  } catch {
    // ignore
  }

  await new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });

  return {
    topic,
    payload
  };
}

export function getTvControlConfig(accountNamespace = "") {
  return {
    host: MQTT_HOST,
    port: MQTT_PORT,
    accountNamespace: String(accountNamespace || "").trim().toLowerCase(),
    topic: buildTopic(accountNamespace),
    sessionTopic: buildSessionTopic(accountNamespace)
  };
}
