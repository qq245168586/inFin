import assert from "node:assert/strict";
import { test } from "vitest";
import { createMockCourseScript } from "./fixtures/mock-db.ts";
import { addDays, importStore, nextMonday, shanghaiNoon } from "./helpers/store.ts";

test("saveCourse rejects duplicate name and version regardless of whitespace and case", async (t) => {
  const store = await importStore(t);
  const duplicateScript = createMockCourseScript({
    metadata: {
      name: "mock strength",
      version: "2026.01"
    }
  });

  assert.throws(
    () =>
      store.saveCourse({
        name: " mock strength ",
        creator: "Coach Kai",
        version: "2026.01",
        coursePackageId: 1,
        typeIds: [1],
        script: duplicateScript
      }),
    /课程已有相同版本/
  );
});

test("saveCourse moves a course into exactly one target course package", async (t) => {
  const store = await importStore(t);
  const script = createMockCourseScript({
    metadata: {
      id: "course-advanced",
      name: "Advanced Engine",
      version: "2026.02"
    }
  });

  const course = store.saveCourse({
    name: "Advanced Engine",
    creator: "Coach Kai",
    version: "2026.02",
    coursePackageId: 2,
    typeIds: [1],
    script
  });

  assert.equal(course.coursePackageId, 2);
  assert.ok(store.getCoursePackageById(2).courseIds.includes(course.id));
  assert.equal(store.getCoursePackageById(1).courseIds.includes(course.id), false);
  assert.deepEqual(
    store.listCourseOptions(2).map((item: any) => item.id),
    [course.id]
  );
});

test("deleteCourse blocks courses scheduled for today or the future", async (t) => {
  const store = await importStore(t);
  const futureMonday = nextMonday(1);
  const schedule = store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(futureMonday),
    duration: 45
  });

  const result = store.deleteCourse(101);

  assert.equal(schedule.courseId, 101);
  assert.equal(result.ok, false);
  assert.match(result.message, /今天或未来日期/);
  assert.equal(store.getCourseById(101).id, 101);
});

test("copyWeekSchedules copies only the selected package and reports target conflicts", async (t) => {
  const store = await importStore(t);
  const sourceWeek = nextMonday(-1);
  const targetWeek = nextMonday(1);
  store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(addDays(sourceWeek, 2)),
    duration: 45
  });

  const copied = store.copyWeekSchedules({
    coursePackageId: 1,
    sourceWeekStart: sourceWeek,
    targetWeekStart: targetWeek
  });

  assert.equal(copied.length, 1);
  assert.equal(copied[0].date, addDays(targetWeek, 2));
  assert.equal(copied[0].coursePackageId, 1);
  assert.throws(
    () =>
      store.copyWeekSchedules({
        coursePackageId: 1,
        sourceWeekStart: sourceWeek,
        targetWeekStart: targetWeek
      }),
    (error: any) => error?.statusCode === 409 && /目标周已有排课/.test(error.message)
  );
});

test("TV binding preserves unbound device history after unbind and heartbeat", async (t) => {
  const store = await importStore(t);

  const bound = store.bindTvScreen(
    {
      deviceId: "TV-001",
      screenNumber: 2,
      appVersion: "1.0.0",
      playbackState: "running"
    },
    " Venue-A "
  );
  const unbound = store.unbindTvScreen({ deviceId: "TV-001" }, "venue-a");
  const heartbeat = store.heartbeatTvScreen(
    {
      deviceId: "TV-001",
      screenNumber: 2,
      playbackState: "RUNNING"
    },
    "venue-a"
  );

  assert.equal(bound.accountNamespace, "venue-a");
  assert.equal(bound.orientation, "HORIZONTAL");
  assert.equal(unbound.accountNamespace, "");
  assert.equal(unbound.previousAccountNamespace, "venue-a");
  assert.equal(heartbeat.accountNamespace, "");
  assert.equal(heartbeat.previousAccountNamespace, "venue-a");
  assert.equal(heartbeat.previousScreenNumber, 2);
  assert.equal(heartbeat.sessionOutdated, false);
  assert.equal(heartbeat.session, null);
  assert.equal(store.bindTvScreen({ deviceId: "TV-999", screenNumber: 6 }, "venue-a"), null);
});
