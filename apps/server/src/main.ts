import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { createLegacyRequestHandler } from "./legacy/server-runtime.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3100);
const mqttAuthPassword = process.env.MQTT_AUTH_PASSWORD || process.env.MQTT_PASSWORD || "REDACTED_CONFIGURE_LOCALLY";

function readRequestText(request: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendMqttAuth(response: any, statusCode: number, body: Record<string, unknown>) {
  const text = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(text));
  response.end(text);
}

async function handleMqttHttpAuth(request: any, response: any) {
  const rawText = await readRequestText(request);
  let payload: Record<string, any> = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = {};
  }

  const password = String(payload.password || "").trim();
  const username = String(payload.username || "").trim();
  const clientId = String(payload.clientid || payload.clientId || "").trim();
  const allowed = Boolean(password) && password === mqttAuthPassword;

  if (!allowed) {
    console.warn(
      `[mqtt-auth] denied username=${username || "-"} clientid=${clientId || "-"} hasPassword=${password ? "yes" : "no"}`
    );
    sendMqttAuth(response, 200, { result: "deny", is_superuser: false });
    return;
  }

  sendMqttAuth(response, 200, {
    result: "allow",
    is_superuser: false,
    client_attrs: {
      username,
      clientid: clientId
    }
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const legacyRequestHandler = await createLegacyRequestHandler();

  app.use((request, response) => {
    if (request.method === "POST" && request.url?.split("?")[0] === "/api/mqtt/auth") {
      void handleMqttHttpAuth(request, response);
      return;
    }
    void legacyRequestHandler(request, response);
  });

  await app.listen(port, host);
  console.log(`Infini server listening on http://${host}:${port}`);
}

void bootstrap();
