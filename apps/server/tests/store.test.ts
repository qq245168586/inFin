import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { createMockCourseScript, createMockDatabaseState } from "./fixtures/mock-db.ts";
import { addDays, importStore, nextMonday, shanghaiNoon } from "./helpers/store.ts";
import { podScreenTotal, summarizeCourseScript } from "../../../packages/shared/src/course-script.js";

function createGlobalCoursePackageState() {
  const state = createMockDatabaseState();
  const globalPackageCourseScript = createMockCourseScript({
    metadata: {
      id: "global-package-course",
      name: "Global Package Course",
      version: "2026.06"
    }
  });
  state.coursePackages = state.coursePackages.map((coursePackage: any) =>
    Number(coursePackage.id) === 2
      ? { ...coursePackage, accessScope: "GLOBAL", courseIds: [202] }
      : coursePackage
  );
  state.users = state.users.map((user: any) =>
    user.username === "coach"
      ? { ...user, coursePackageIds: [1, 2] }
      : user
  );
  state.actionTypes.push({ id: 3, name: "Global Package Type", coursePackageIds: [2] });
  state.lessonTypes = state.lessonTypes.map((type: any) => ({ ...type, coursePackageIds: [1] }));
  state.lessonTypes.push({ id: 3, name: "Global Package Lesson", coursePackageIds: [2] });
  state.actions.push({
    id: 4,
    name: "Global Package Action",
    description: "",
    typeIds: [3],
    media: null,
    courseTags: [],
    coursePackageIds: [2],
    author: "coach",
    ownerUsername: "coach",
    createTime: "2026-06-01T00:00:00.000Z",
    updateTime: "2026-06-01T00:00:00.000Z"
  });
  state.courses.push({
    ...state.courses[0],
    id: 202,
    name: "Global Package Course",
    version: "2026.06",
    coursePackageId: 2,
    typeIds: [3],
    metadata: globalPackageCourseScript.metadata,
    script: globalPackageCourseScript
  });
  state.templates = [
    {
      id: 1,
      kind: "warmup",
      name: "Default Warmup",
      coursePackageIds: [1],
      section: {
        id: "warmup-section",
        title: "热身",
        layout: "WATERFALL",
        items: [
          {
            id: "warmup-action",
            actionId: "1",
            actionName: "Air Squat",
            seconds: 20,
            cue: ""
          }
        ]
      },
      createTime: "2026-06-01T00:00:00.000Z",
      updateTime: "2026-06-01T00:00:00.000Z"
    },
    {
      id: 2,
      kind: "warmup",
      name: "Global Package Warmup",
      coursePackageIds: [2],
      section: {
        id: "global-warmup-section",
        title: "热身",
        layout: "WATERFALL",
        items: [
          {
            id: "global-warmup-action",
            actionId: "4",
            actionName: "Global Package Action",
            seconds: 20,
            cue: ""
          }
        ]
      },
      createTime: "2026-06-01T00:00:00.000Z",
      updateTime: "2026-06-01T00:00:00.000Z"
    }
  ];
  return state;
}

test("GLOBAL course package reads actions, types, courses and templates across packages", async (t) => {
  const store = await importStore(t, createGlobalCoursePackageState());
  const user = store.getUserByUsername("coach");

  assert.equal(store.getCoursePackageById(2).accessScope, "GLOBAL");
  assert.deepEqual(
    store.listActions(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(),
    [1, 2, 3, 4]
  );
  assert.deepEqual(
    store.listActions(user, { coursePackageId: 1 }).map((item: any) => item.id).sort(),
    [1, 2, 3]
  );
  assert.deepEqual(
    store.listActionTypes(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(),
    [1, 2, 3]
  );
  assert.deepEqual(
    store.listLessonTypes(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(),
    [1, 2, 3]
  );
  assert.deepEqual(store.listCourses(user, { coursePackageId: 1 }).map((item: any) => item.id), [101]);
  assert.deepEqual(store.listCourses(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(), [101, 202]);
  assert.deepEqual(store.listCourseOptions(2, user).map((item: any) => item.id).sort(), [101, 202]);
  assert.deepEqual(store.listTemplates(user, { coursePackageId: 1 }).warmup.map((item: any) => item.id), [1]);
  assert.deepEqual(store.listTemplates(user, { coursePackageId: 2 }).warmup.map((item: any) => item.id).sort(), [1, 2]);
});

test("explicit PACKAGE_ONLY scope also isolates super administrators", async (t) => {
  const store = await importStore(t, createGlobalCoursePackageState());
  const user = store.getUserByUsername("13689547720");

  assert.ok(user);
  assert.deepEqual(
    store.listActions(user, { coursePackageId: 1 }).map((item: any) => item.id).sort(),
    [1, 2, 3]
  );
  assert.deepEqual(
    store.listActions(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(),
    [1, 2, 3, 4]
  );
});

test("GLOBAL cross-package edits preserve the existing resource ownership", async (t) => {
  const store = await importStore(t, createGlobalCoursePackageState());
  const user = store.getUserByUsername("coach");
  const action = store.getActionById(2);
  const course = store.getCourseById(101);
  const template = store.getTemplateById(1, user, { coursePackageId: 2 });

  const savedAction = store.saveAction(
    { ...action, name: "Stretch Updated", coursePackageIds: [2] },
    user,
    { coursePackageId: 2 }
  );
  const savedCourse = store.saveCourse(
    { ...course, description: "Updated from global package", coursePackageId: 2 },
    user,
    { coursePackageId: 2 }
  );
  const savedTemplate = store.saveTemplate(
    { ...template, name: "Default Warmup Updated", coursePackageIds: [2] },
    user,
    { coursePackageId: 2 }
  );

  assert.deepEqual(savedAction.coursePackageIds, [1]);
  assert.equal(savedCourse.coursePackageId, 1);
  assert.deepEqual(savedTemplate.coursePackageIds, [1]);
  assert.equal(store.getCoursePackageById(1).courseIds.includes(101), true);
  assert.equal(store.getCoursePackageById(2).courseIds.includes(101), false);
});

test("GLOBAL new records belong to the requested test package", async (t) => {
  const store = await importStore(t, createGlobalCoursePackageState());
  const user = store.getUserByUsername("coach");
  const script = createMockCourseScript({
    metadata: {
      id: "global-test-course",
      name: "Global Test Course",
      version: "2026.07"
    }
  });

  const scopeOptions = { coursePackageId: 2 };
  const actionType = store.addActionType({ name: "Global Test Action Type", coursePackageIds: [2] }, user, scopeOptions);
  const lessonType = store.addLessonType({ name: "Global Test Lesson Type", coursePackageIds: [2] }, user, scopeOptions);
  const action = store.saveAction(
    { name: "Global Test Action", typeIds: [actionType.id], coursePackageIds: [2] },
    user,
    scopeOptions
  );
  const course = store.saveCourse(
    {
      name: "Global Test Course",
      creator: "Coach",
      version: "2026.07",
      coursePackageId: 2,
      typeIds: [lessonType.id],
      script
    },
    user,
    scopeOptions
  );
  const template = store.saveTemplate(
    {
      kind: "warmup",
      name: "Global Test Warmup",
      coursePackageIds: [2],
      section: {
        items: [{ actionId: String(action.id), actionName: action.name, seconds: 15 }]
      }
    },
    user,
    scopeOptions
  );

  assert.deepEqual(actionType.coursePackageIds, [2]);
  assert.deepEqual(lessonType.coursePackageIds, [2]);
  assert.deepEqual(action.coursePackageIds, [2]);
  assert.equal(course.coursePackageId, 2);
  assert.deepEqual(template.coursePackageIds, [2]);
});

test("GLOBAL schedule may reference another package course but keeps requested ownership", async (t) => {
  const store = await importStore(t, createGlobalCoursePackageState());
  const user = store.getUserByUsername("coach");
  const schedule = store.saveSchedule(
    {
      courseId: 101,
      coursePackageId: 2,
      beginTime: shanghaiNoon(nextMonday(1)),
      duration: 45
    },
    user,
    { coursePackageId: 2 }
  );

  assert.equal(schedule.courseId, 101);
  assert.equal(schedule.coursePackageId, 2);
  assert.deepEqual(
    store.listSchedulesByScope("HISTORY", { user, coursePackageId: 2 }).map((item: any) => item.id),
    [schedule.id]
  );
});

test("PACKAGE_ONLY keeps resource and schedule isolation", async (t) => {
  const state = createGlobalCoursePackageState();
  state.coursePackages = state.coursePackages.map((coursePackage: any) =>
    Number(coursePackage.id) === 2
      ? { ...coursePackage, accessScope: "not-valid" }
      : coursePackage
  );
  const store = await importStore(t, state);
  const user = store.getUserByUsername("coach");

  assert.equal(store.getCoursePackageById(2).accessScope, "PACKAGE_ONLY");
  assert.deepEqual(
    store.listActions(user, { coursePackageId: 2 }).map((item: any) => item.id).sort(),
    [1, 4]
  );
  assert.deepEqual(store.listCourses(user, { coursePackageId: 1 }).map((item: any) => item.id), [101]);
  assert.deepEqual(store.listCourses(user, { coursePackageId: 2 }).map((item: any) => item.id), [202]);
  assert.throws(
    () => store.saveAction(
      { ...store.getActionById(2), name: "Forbidden edit" },
      user,
      { coursePackageId: 2 }
    ),
    /不能修改其它课程包/
  );
  assert.throws(
    () =>
      store.saveSchedule(
        {
          courseId: 101,
          coursePackageId: 2,
          beginTime: shanghaiNoon(nextMonday(1)),
          duration: 45
        },
        user,
        { coursePackageId: 2 }
      ),
    /不属于当前课程包/
  );
});

test("course save preserves independent pod ending durations and ignores display station rules", async (t) => {
  const store = await importStore(t);
  const script = createMockCourseScript();
  script.metadata.name = "Independent Pod Breaks";
  script.metadata.version = "2026.07";
  const basePod = script.training.pods[0];
  script.training.pods = [
    { ...basePod, id: "pod-1", name: "Pod 1", ending: "HYDRATE", endingSeconds: 30 },
    { ...basePod, id: "pod-2", name: "Pod 2", ending: "MOVE_ZONE", endingSeconds: 90 },
    { ...basePod, id: "pod-3", name: "Pod 3", ending: "FINISH", endingSeconds: 0 }
  ];

  const before = summarizeCourseScript(script);
  script.metadata.stationRules = {
    set: "999",
    work: "display only",
    rest: "display only",
    switch: "follow the leader"
  };
  const after = summarizeCourseScript(script);
  const saved = store.saveCourse({
    name: script.metadata.name,
    creator: script.metadata.creator,
    version: script.metadata.version,
    coursePackageId: 1,
    typeIds: [1],
    script
  });

  assert.equal(before.hydrateSeconds, 120);
  assert.deepEqual(after, before);
  assert.deepEqual(saved.script.training.pods.map((pod: any) => pod.endingSeconds), [30, 90, 0]);
  assert.equal(saved.summary.hydrateSeconds, 120);
});

test("SWITCH duration treats loopCount as AB rounds independent of video count", () => {
  const duration = podScreenTotal(
    {
      loopCount: 2,
      stationRestSeconds: 5,
      setConfigs: [{ workSeconds: 5, restSeconds: 0 }]
    },
    [
      { actionId: "a1", actionName: "A1" },
      { actionId: "b1", actionName: "B1" },
      { actionId: "a2", actionName: "A2" },
      { actionId: "b2", actionName: "B2" }
    ],
    "STATIONS",
    "SWITCH"
  );

  // A1 work -> switch -> B1 work -> move station -> A2 work -> switch -> B2 work.
  assert.equal(duration, 35);
});

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

test("store barrel exposes super admin checker for admin routes", async (t) => {
  const state = createMockDatabaseState({
    users: [
      ...createMockDatabaseState().users,
      {
        id: 99,
        username: "admin",
        nickname: "Admin",
        avatar: "",
        gender: "UNKNOWN",
        userType: "CONSOLE",
        passwordDigest: "test",
        passwordPlain: "test",
        accountNamespace: "",
        environmentLabel: "",
        role: "superadmin",
        venueId: "",
        coursePackageIds: [],
        allowedClients: ["admin-web"],
        createTime: "2026-06-01T00:00:00.000Z",
        lastLoginTime: null
      }
    ]
  });
  const store = await importStore(t, state);

  assert.equal(typeof store.isSuperAdminUser, "function");
  assert.equal(store.isSuperAdminUser(store.getUserByUsername("admin")), true);
  assert.equal(store.isSuperAdminUser(store.getUserByUsername("coach")), false);
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

test("coach course package switch persists venue active package and filters TV bundle", async (t) => {
  const store = await importStore(t);
  const scheduleDate = nextMonday(1);
  const advancedScript = createMockCourseScript({
    metadata: {
      id: "course-advanced-view",
      name: "Advanced View",
      version: "2026.03"
    }
  });
  const advancedCourse = store.saveCourse({
    name: "Advanced View",
    creator: "Coach Kai",
    version: "2026.03",
    coursePackageId: 2,
    typeIds: [1],
    script: advancedScript
  });
  store.bindCoursePackageToVenue("venue-a", 2);
  store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(scheduleDate),
    duration: 45
  });
  store.saveSchedule({
    courseId: advancedCourse.id,
    coursePackageId: 2,
    beginTime: shanghaiNoon(scheduleDate),
    duration: 45
  });

  assert.deepEqual(
    store.getTvDailyBundle(scheduleDate, "Asia/Shanghai", "venue-a").schedules.map((item: any) => item.coursePackageId),
    [1]
  );

  const view = store.setVenueActiveCoursePackage("venue-a", 2);

  assert.equal(view.activeCoursePackageId, 2);
  assert.equal(store.getVenueById("venue-a").activeCoursePackageId, 2);
  assert.deepEqual(
    store.getTvDailyBundle(scheduleDate, "Asia/Shanghai", "venue-a").schedules.map((item: any) => item.coursePackageId),
    [2]
  );
});

test("TV current session returns a new active preview before recent terminal fallback", async (t) => {
  const store = await importStore(t);
  const scheduleDate = nextMonday(1);
  const schedule = store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(scheduleDate),
    duration: 45
  });

  const firstPreview = store.createPreviewPlaybackSession(
    { scheduleId: String(schedule.id), commandId: "preview-first" },
    "venue-a"
  );
  store.updatePlaybackSessionState(
    firstPreview.id,
    "terminate",
    { commandId: "terminate-first" },
    "venue-a"
  );
  const secondPreview = store.createPreviewPlaybackSession(
    { scheduleId: String(schedule.id), commandId: "preview-second" },
    "venue-a"
  );

  const current = store.getCurrentPlaybackSessionForTv({
    accountNamespace: "venue-a",
    screenNumber: 1
  });

  assert.equal(current.id, secondPreview.id);
  assert.equal(current.state, "PREVIEW");
});

test("preview session remains active after normal 10 minute setup window", async (t) => {
  vi.useFakeTimers();
  const baseTime = new Date("2026-07-04T01:10:00.000Z");
  vi.setSystemTime(baseTime);
  try {
    const store = await importStore(t);
    const scheduleDate = nextMonday(1);
    const schedule = store.saveSchedule({
      courseId: 101,
      coursePackageId: 1,
      beginTime: shanghaiNoon(scheduleDate),
      duration: 45
    });

    const preview = store.createPreviewPlaybackSession(
      { scheduleId: String(schedule.id), commandId: "preview-long-setup" },
      "venue-a"
    );
    vi.setSystemTime(new Date(baseTime.getTime() + 11 * 60 * 1000));

    const current = store.getActivePlaybackSession("venue-a");

    assert.equal(current.id, preview.id);
    assert.equal(current.state, "PREVIEW");
  } finally {
    vi.useRealTimers();
  }
});

test("repeated preview command advances session revision for TV resync", async (t) => {
  const store = await importStore(t);
  const scheduleDate = nextMonday(1);
  const schedule = store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(scheduleDate),
    duration: 45
  });

  const first = store.createPreviewPlaybackSession(
    { scheduleId: String(schedule.id), commandId: "preview-repeat-1" },
    "venue-a"
  );
  const second = store.createPreviewPlaybackSession(
    { scheduleId: String(schedule.id), commandId: "preview-repeat-2" },
    "venue-a"
  );

  assert.equal(second.id, first.id);
  assert.equal(second.state, "PREVIEW");
  assert.equal(second.version, first.version + 1);
  assert.equal(second.lastCommandId, "preview-repeat-2");
});

test("TV heartbeat marks preview screens outdated when local state fell back to idle", async (t) => {
  const store = await importStore(t);
  const scheduleDate = nextMonday(1);
  const schedule = store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(scheduleDate),
    duration: 45
  });
  const preview = store.createPreviewPlaybackSession(
    { scheduleId: String(schedule.id), commandId: "preview-heartbeat" },
    "venue-a"
  );

  const heartbeat = store.heartbeatTvScreen(
    {
      deviceId: "TV-001",
      screenNumber: 1,
      playbackState: "IDLE",
      previewMode: false,
      playbackSessionId: preview.id,
      sessionVersion: preview.version
    },
    "venue-a"
  );

  assert.equal(heartbeat.sessionOutdated, true);
  assert.equal(heartbeat.session.id, preview.id);
  assert.equal(heartbeat.session.state, "PREVIEW");
});

test("lesson types are scoped to course packages and reused within the same package", async (t) => {
  const store = await importStore(t);

  assert.deepEqual(
    store.listLessonTypes(null, { coursePackageId: 2 }).map((item: any) => item.id),
    []
  );

  const first = store.addLessonType({ name: "Strength", coursePackageIds: [2] });
  const duplicate = store.addLessonType({ name: " strength ", coursePackageIds: [2] });

  assert.equal(first.id, duplicate.id);
  assert.deepEqual(first.coursePackageIds, [2]);
  assert.deepEqual(
    store.listLessonTypes(null, { coursePackageId: 2 }).map((item: any) => item.id),
    [first.id]
  );
  assert.ok(store.listLessonTypes(null, { coursePackageId: 1 }).every((item: any) => item.id !== first.id));
});

test("meta payload can be built with full course details", async (t) => {
  const store = await importStore(t);
  const user = store.getUserByUsername("coach");

  const payload = store.getMetaPayload(user, { includeFullCourses: true });

  assert.ok(Array.isArray(payload.actionTypes));
  assert.ok(Array.isArray(payload.coursePackages));
  assert.ok(Array.isArray(payload.courses));
  assert.equal(payload.coursesMode, "full");
  assert.ok(payload.schedules?.currentWeek);
});

test("meta payload can omit schedules and return summary courses", async (t) => {
  const store = await importStore(t);
  const user = store.getUserByUsername("coach");

  const payload = store.getMetaPayload(user, { includeSchedules: false });

  assert.equal(payload.coursesMode, "summary");
  assert.equal("script" in payload.courses[0], false);
  assert.deepEqual(payload.schedules, { currentWeek: [], lastWeek: [], history: [] });
});

test("meta payload can omit heavy editor collections", async (t) => {
  const store = await importStore(t);
  const user = store.getUserByUsername("coach");

  const payload = store.getMetaPayload(user, {
    includeActions: false,
    includeTemplates: false,
    includeSchedules: false
  });

  assert.deepEqual(payload.actions, []);
  assert.deepEqual(payload.templates, { warmup: [], cooldown: [], training: [], course: [] });
  assert.equal("script" in payload.courses[0], false);
});

test("meta payload can include full detail for one course only", async (t) => {
  const store = await importStore(t);
  const user = store.getUserByUsername("coach");

  const payload = store.getMetaPayload(user, { includeFullCourses: true, courseId: 101, includeSchedules: false });

  assert.equal(payload.coursesMode, "mixed");
  assert.ok(payload.courses.find((course: any) => Number(course.id) === 101)?.script?.training);
  assert.deepEqual(payload.schedules.currentWeek, []);
});

test("listSchedulesByWeekDate reads only the requested package week", async (t) => {
  const store = await importStore(t);
  const weekStart = nextMonday(1);
  const laterWeekStart = nextMonday(2);
  store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(addDays(weekStart, 2)),
    duration: 45
  });
  store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(addDays(laterWeekStart, 2)),
    duration: 45
  });

  const payload = store.listSchedulesByWeekDate(addDays(weekStart, 3), { coursePackageId: 1 });

  assert.equal(payload.weekStart, weekStart);
  assert.equal(payload.weekEnd, addDays(weekStart, 6));
  assert.deepEqual(
    payload.schedules.map((schedule: any) => schedule.date),
    [addDays(weekStart, 2)]
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

test("copyWeekSchedules allows copying the current week into a future week", async (t) => {
  const store = await importStore(t);
  const sourceWeek = nextMonday(0);
  const targetWeek = nextMonday(1);
  store.saveSchedule({
    courseId: 101,
    coursePackageId: 1,
    beginTime: shanghaiNoon(addDays(sourceWeek, 1)),
    duration: 45
  });

  const copied = store.copyWeekSchedules({
    coursePackageId: 1,
    sourceWeekStart: sourceWeek,
    targetWeekStart: targetWeek
  });

  assert.equal(copied.length, 1);
  assert.equal(copied[0].date, addDays(targetWeek, 1));
  assert.equal(copied[0].coursePackageId, 1);
});

test("copyWeekSchedules skips source items whose courses were deleted", async (t) => {
  const sourceWeek = nextMonday(-1);
  const targetWeek = nextMonday(1);
  const state = createMockDatabaseState({
    schedules: [
      {
        id: 1,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(addDays(sourceWeek, 1)),
        duration: 45
      },
      {
        id: 2,
        courseId: 999,
        coursePackageId: 1,
        courseName: "Deleted Course",
        version: "1.0",
        beginTime: shanghaiNoon(addDays(sourceWeek, 2)),
        duration: 45
      }
    ]
  });
  const store = await importStore(t, state);

  const copied = store.copyWeekSchedules({
    coursePackageId: 1,
    sourceWeekStart: sourceWeek,
    targetWeekStart: targetWeek
  });

  assert.equal(copied.length, 1);
  assert.equal(copied[0].courseId, 101);
  assert.equal(copied[0].date, addDays(targetWeek, 1));
  assert.equal(
    store
      .listSchedulesByScope("HISTORY")
      .some((item: any) => Number(item.courseId) === 999 && item.date >= targetWeek),
    false
  );
});

test("copyWeekSchedules copies into the current week and skips elapsed target days", async (t) => {
  const sourceWeek = nextMonday(-1);
  const targetWeek = nextMonday(0);
  const today = addDays(targetWeek, 1);
  const state = createMockDatabaseState({
    schedules: [
      {
        id: 1,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(sourceWeek),
        duration: 45
      },
      {
        id: 2,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(addDays(sourceWeek, 1)),
        duration: 45
      },
      {
        id: 3,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(addDays(sourceWeek, 3)),
        duration: 45
      },
      {
        id: 4,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Existing elapsed target",
        version: "old",
        beginTime: shanghaiNoon(targetWeek),
        duration: 99
      }
    ]
  });
  const store = await importStore(t, state);

  const copied = store.copyWeekSchedules(
    {
      coursePackageId: 1,
      sourceWeekStart: sourceWeek,
      targetWeekStart: targetWeek
    },
    null,
    { today }
  );

  assert.deepEqual(
    copied.map((item: any) => item.date),
    [today, addDays(targetWeek, 3)]
  );
  assert.equal(copied.some((item: any) => item.date === targetWeek), false);
  assert.equal(
    store
      .listSchedulesByScope("HISTORY", { coursePackageId: 1 })
      .some((item: any) => item.date === targetWeek && item.duration === 99),
    true
  );
});

test("copyWeekSchedules detects and replaces current-week conflicts only from today onward", async (t) => {
  const sourceWeek = nextMonday(-1);
  const targetWeek = nextMonday(0);
  const today = addDays(targetWeek, 1);
  const state = createMockDatabaseState({
    schedules: [
      {
        id: 1,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(addDays(sourceWeek, 1)),
        duration: 45
      },
      {
        id: 2,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Existing future target",
        version: "old",
        beginTime: shanghaiNoon(today),
        duration: 99
      }
    ]
  });
  const store = await importStore(t, state);

  assert.throws(
    () =>
      store.copyWeekSchedules(
        {
          coursePackageId: 1,
          sourceWeekStart: sourceWeek,
          targetWeekStart: targetWeek
        },
        null,
        { today }
      ),
    (error: any) => error?.statusCode === 409 && /目标周已有排课/.test(error.message)
  );

  const copied = store.copyWeekSchedules(
    {
      coursePackageId: 1,
      sourceWeekStart: sourceWeek,
      targetWeekStart: targetWeek,
      replaceExisting: true
    },
    null,
    { today }
  );

  assert.equal(copied.length, 1);
  assert.equal(copied[0].date, today);
  assert.equal(copied[0].duration, 45);
  assert.equal(
    store
      .listSchedulesByScope("HISTORY", { coursePackageId: 1 })
      .some((item: any) => item.date === today && item.duration === 99),
    false
  );
});

test("pruneFutureDeletedCourseSchedules keeps past deleted records and removes future ones", async (t) => {
  const today = nextMonday(0);
  const state = createMockDatabaseState({
    schedules: [
      {
        id: 1,
        courseId: 999,
        coursePackageId: 1,
        courseName: "Past Deleted Course",
        version: "1.0",
        beginTime: shanghaiNoon(addDays(today, -1)),
        duration: 45
      },
      {
        id: 2,
        courseId: 998,
        coursePackageId: 1,
        courseName: "Today Deleted Course",
        version: "1.0",
        beginTime: shanghaiNoon(today),
        duration: 45
      },
      {
        id: 3,
        courseId: 997,
        coursePackageId: 1,
        courseName: "Future Deleted Course",
        version: "1.0",
        beginTime: shanghaiNoon(addDays(today, 7)),
        duration: 45
      },
      {
        id: 4,
        courseId: 101,
        coursePackageId: 1,
        courseName: "Mock Strength",
        version: "2026.01",
        beginTime: shanghaiNoon(addDays(today, 7)),
        duration: 45
      }
    ]
  });
  const store = await importStore(t, state);

  const result = store.pruneFutureDeletedCourseSchedules({ today });
  const remaining = store.listSchedulesByScope("HISTORY");

  assert.equal(result.removedCount, 2);
  assert.deepEqual(
    remaining.map((item: any) => Number(item.id)).sort((left: number, right: number) => left - right),
    [1, 4]
  );
  assert.equal(remaining.find((item: any) => Number(item.id) === 1)?.courseDeleted, true);
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
