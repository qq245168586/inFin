import mqtt from "mqtt";

const MQTT_HOST = process.env.MQTT_HOST || "8.130.65.113";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || "tv1";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";
const MQTT_URL = process.env.MQTT_URL || `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const MQTT_CONTROL_TOPIC = process.env.MQTT_TOPIC_CONTROL || "infini/tv/control";

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

async function getClient() {
  if (!clientPromise) {
    clientPromise = createClientPromise();
  }

  return clientPromise;
}

export async function publishTvControl(payload, accountNamespace = "") {
  const client = await getClient();
  const message = JSON.stringify(payload);
  const topic = buildTopic(accountNamespace);

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
    payload
  };
}

export function getTvControlConfig(accountNamespace = "") {
  return {
    host: MQTT_HOST,
    port: MQTT_PORT,
    accountNamespace: String(accountNamespace || "").trim().toLowerCase(),
    topic: buildTopic(accountNamespace)
  };
}
