import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { DomainEventBus } from "../src/events/domain-event-bus.ts";
import { StoreGateway } from "../src/data/store-gateway.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

test("StoreGateway delegates calls and marks state-changing store operations", () => {
  const gateway = new StoreGateway({
    listCourses: () => ["course-a"],
    saveCourse: (payload) => ({ ok: true, payload })
  });

  assert.deepEqual(gateway.functionNames(), ["listCourses", "saveCourse"]);
  assert.deepEqual(gateway.call("listCourses"), ["course-a"]);
  assert.deepEqual(gateway.call("saveCourse", { id: 1 }), { ok: true, payload: { id: 1 } });
  assert.equal(gateway.isWriteOperation("listCourses"), false);
  assert.equal(gateway.isWriteOperation("saveCourse"), true);
  assert.throws(() => gateway.call("missingFunction"), /Store function not found/);
});

test("DomainEventBus emits typed events to named and wildcard subscribers", () => {
  const bus = new DomainEventBus();
  const received: string[] = [];
  const streamTypes: string[] = [];
  const streamSubscription = bus.events().subscribe((event) => {
    streamTypes.push(event.type);
  });
  const unsubscribeNamed = bus.on("schedule.changed", (event) => {
    received.push(`named:${event.payload.scheduleId}`);
  });
  const unsubscribeWildcard = bus.on("*", (event) => {
    received.push(`wildcard:${event.type}`);
  });

  const event = bus.emit("schedule.changed", { scheduleId: "sch-1" });

  assert.equal(event.type, "schedule.changed");
  assert.equal(event.payload.scheduleId, "sch-1");
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(received, ["named:sch-1", "wildcard:schedule.changed"]);

  unsubscribeNamed();
  unsubscribeWildcard();
  streamSubscription.unsubscribe();
  bus.emit("schedule.changed", { scheduleId: "sch-2" });
  assert.deepEqual(received, ["named:sch-1", "wildcard:schedule.changed"]);
  assert.deepEqual(streamTypes, ["schedule.changed"]);
});

test("server architecture uses named modules instead of legacy text chunks", () => {
  const legacyDir = path.join(serverRoot, "src", "legacy");
  assert.equal(fs.existsSync(legacyDir), false, "server source should not keep a legacy directory");

  const runtimeSource = [
    fs.readFileSync(path.join(serverRoot, "src", "runtime", "http-request-runtime.ts"), "utf8"),
    fs.readFileSync(path.join(serverRoot, "src", "runtime", "store-runtime.ts"), "utf8"),
    fs.readFileSync(path.join(serverRoot, "src", "interfaces", "http", "compat-request-handler.ts"), "utf8")
  ].join("\n");
  assert.equal(runtimeSource.includes("new Function"), false, "compat runtime should not evaluate text chunks");
  assert.equal(runtimeSource.includes("server-chunks"), false, "runtime should not depend on server chunk files");
});
