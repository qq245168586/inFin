import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { createRequire } from "node:module";
import { checkServerIdentity } from "node:tls";

const origin = process.env.VERIFY_ORIGIN || "http://127.0.0.1:3100";
const api = origin + (process.env.VERIFY_PREFIX || "") + "/api";
const db = JSON.parse(fs.readFileSync("/var/lib/infini/db.json", "utf8"));
const counts = Object.fromEntries(Object.entries(db).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
console.log("Database counts", JSON.stringify(counts));

async function json(path, options = {}) {
  const response = await fetch(api + path, options);
  const payload = await response.json();
  assert.equal(response.ok, true, `${path} failed with ${response.status}: ${payload.message || ""}`);
  return payload;
}

const user = db.users.find((item) => item.username === "zhiyou" && item.role === "superadmin");
assert.ok(user, "restored super administrator must remain present");
const login = await json("/app/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Basic REDACTED_CONFIGURE_LOCALLY" },
  body: JSON.stringify({ username: user.username, password: user.passwordDigest, grant_type: "password", client: "editor-web" })
});
const headers = { Authorization: `${login.data.token_type} ${login.data.access_token}` };
const profile = await json("/user/info", { headers });
assert.equal(profile.data.username, "zhiyou");
const meta = await json("/meta?includeSchedules=0&includeActions=0&includeTemplates=0", { headers });
assert.ok(Array.isArray(meta.courses));
const course = meta.courses[0];
if (course) {
  await json(`/courses/${course.id}`, { headers });
}
const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
await json(`/schedules/week?date=${dateValues.year}-${dateValues.month}-${dateValues.day}&coursePackageId=${db.coursePackages[0].id}`, { headers });
console.log("API login/profile/meta/course/week checks passed");

if (process.env.VERIFY_MQTT_URL) {
  const require = createRequire("/srv/infini-platform/apps/server/package.json");
  const mqtt = require("mqtt");
  const client = mqtt.connect(process.env.VERIFY_MQTT_URL, {
    username: "migration-check",
    password: "REDACTED_CONFIGURE_LOCALLY",
    clean: true,
    reconnectPeriod: 0,
    ...(process.env.VERIFY_TLS_SERVER_NAME ? { wsOptions: {
      servername: process.env.VERIFY_TLS_SERVER_NAME,
      checkServerIdentity: (_name, certificate) => checkServerIdentity(process.env.VERIFY_TLS_SERVER_NAME, certificate)
    } } : {}),
    connectTimeout: 8000,
  });
  try {
    await once(client, "connect");
    const topic = `infini/migration-check/${Date.now()}`;
    await client.subscribeAsync(topic);
    const received = once(client, "message");
    await client.publishAsync(topic, "migration-ready", { qos: 0 });
    const [name, body] = await Promise.race([received, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("MQTT round trip timed out")), 8000);
      timer.unref();
    })]);
    assert.equal(name, topic);
    assert.equal(body.toString(), "migration-ready");
    console.log("MQTT authenticated publish/subscribe passed");
  } finally {
    await client.endAsync(true);
  }
}
