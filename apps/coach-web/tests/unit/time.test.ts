import assert from "node:assert/strict";
import test from "node:test";
import { mockSchedule, weekSchedules } from "../fixtures/coachData.ts";
import { buildScheduleRange, formatDateLabel, formatDateTime, formatTime, getWeekDays, scheduleStartAtMs } from "../../src/utils/time.ts";

test("getWeekDays treats Sunday as the end of the current coach week", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-06-21T10:15:00+08:00")
  });

  const days = getWeekDays(weekSchedules);

  assert.deepEqual(
    days.map((day) => day.key),
    ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"]
  );
  assert.equal(days[0].label, "周一");
  assert.equal(days[0].scheduleCount, 2);
  assert.equal(days[6].label, "周日");
  assert.equal(days[6].scheduleCount, 1);
});

test("format helpers render Shanghai clock time and null fallbacks", () => {
  assert.equal(formatTime("2026-06-18T23:30:00.000Z"), "07:30");
  assert.match(formatDateLabel("2026-06-18T23:30:00.000Z"), /6(?:月|\/)19(?:日)?.*星期五/);
  assert.match(formatDateTime("2026-06-18T23:30:15.000Z"), /6(?:月|\/)19(?:日)?.*07:30:15/);
  assert.equal(formatTime(null), "--");
  assert.equal(formatDateLabel(undefined), "--");
  assert.equal(formatDateTime(), "--");
});

test("buildScheduleRange handles classes that cross midnight", () => {
  assert.equal(
    buildScheduleRange({
      ...mockSchedule,
      beginTime: "2026-06-19T23:30:00+08:00",
      duration: 90
    }),
    "23:30 - 01:00"
  );
});

test("scheduleStartAtMs uses the schedule beginTime instant", () => {
  assert.equal(scheduleStartAtMs(mockSchedule), new Date(mockSchedule.beginTime).getTime());
});
