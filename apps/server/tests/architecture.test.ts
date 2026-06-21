import assert from "node:assert/strict";
import { test } from "vitest";
import { DomainEventBus } from "../src/events/domain-event-bus.ts";
import { LegacyStoreGateway } from "../src/data/legacy-store-gateway.ts";

test("LegacyStoreGateway delegates calls and marks state-changing store operations", () => {
  const gateway = new LegacyStoreGateway({
    listCourses: () => ["course-a"],
    saveCourse: (payload) => ({ ok: true, payload })
  });

  assert.deepEqual(gateway.functionNames(), ["listCourses", "saveCourse"]);
  assert.deepEqual(gateway.call("listCourses"), ["course-a"]);
  assert.deepEqual(gateway.call("saveCourse", { id: 1 }), { ok: true, payload: { id: 1 } });
  assert.equal(gateway.isWriteOperation("listCourses"), false);
  assert.equal(gateway.isWriteOperation("saveCourse"), true);
  assert.throws(() => gateway.call("missingFunction"), /Legacy store function not found/);
});

test("DomainEventBus emits typed events to named and wildcard subscribers", () => {
  const bus = new DomainEventBus();
  const received: string[] = [];
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
  bus.emit("schedule.changed", { scheduleId: "sch-2" });
  assert.deepEqual(received, ["named:sch-1", "wildcard:schedule.changed"]);
});
