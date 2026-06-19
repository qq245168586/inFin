import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const MQTT_ENV_KEYS = [
  "MQTT_CLIENT_HTTP_URL",
  "MQTT_CLIENT_HTTP_TOKEN",
  "MQTT_CLIENT_FALLBACK_DIRECT",
  "MQTT_TOPIC_CONTROL",
  "MQTT_TOPIC_SESSION"
];

const originalEnv = Object.fromEntries(MQTT_ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of MQTT_ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  globalThis.fetch = originalFetch;
});

test("getTvControlConfig normalizes account namespaces and topic suffixes", async () => {
  const tvControl = await importTvControl();

  assert.deepEqual(tvControl.getTvControlConfig(" Venue-A "), {
    url: "wss://api.infintraining.work/mqtt",
    accountNamespace: "venue-a",
    topic: "infini/tv/control/venue-a",
    sessionTopic: "infini/tv/session/venue-a",
    mqttClientHttpUrl: "",
    fallbackDirect: true
  });
  assert.equal(tvControl.getTvControlConfig("").topic, "infini/tv/control/__unbound__");
});

test("publishTvControl injects normalized namespace when using MQTT HTTP gateway", async () => {
  process.env.MQTT_CLIENT_HTTP_URL = "https://mqtt-gateway.example.test/api/";
  process.env.MQTT_CLIENT_HTTP_TOKEN = "gateway-token";
  const calls: any[] = [];
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, init });
    const body = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          topic: "gateway/topic",
          payload: body.payload
        })
    } as Response;
  }) as any;
  const tvControl = await importTvControl();

  const result = await tvControl.publishTvControl({ type: "preview_course", source: "test" }, " Venue-A ");

  assert.equal(calls.length, 1);
  assert.equal(String(calls[0].url), "https://mqtt-gateway.example.test/tv/control");
  assert.equal(calls[0].init.headers.authorization, "Bearer gateway-token");
  assert.equal(JSON.parse(calls[0].init.body).accountNamespace, " Venue-A ");
  assert.deepEqual(result.payload, {
    type: "preview_course",
    source: "test",
    accountNamespace: "venue-a",
    venueId: "venue-a"
  });
  assert.equal(result.transport, "mqtt-client");
});

async function importTvControl() {
  const cacheBust = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return import(`../src/services/tv-control.ts?test=${cacheBust}`);
}
