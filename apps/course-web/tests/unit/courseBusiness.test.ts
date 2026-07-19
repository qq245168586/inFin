import assert from "node:assert/strict";
import { afterEach, describe, test, vi } from "vitest";

import {
  filterActionsByCoursePackage,
  filterActionTypesByCoursePackage,
  filterCoursesByCoursePackage,
  filterTemplateCollectionsByCoursePackage,
  getCrossPackageSourceLabel,
  resolveActionWriteCoursePackageIds,
  resolveExistingCoursePackageId
} from "../../src/utils/coursePackageScope.ts";
import { matchesTypeFilter } from "../../src/viewmodels/courses/courseEditorGuards.ts";
import { getCourseDraftIssues } from "../../src/viewmodels/courses/courseValidation.ts";
import { normalizeCourseScriptLocal } from "../../src/viewmodels/courses/courseScriptNormalize.ts";
import { rebalancePodEndings } from "../../src/viewmodels/courses/podGraph.ts";
import { getPodScreenTotal, getSwitchPodScreenTotal } from "../../src/viewmodels/courses/podTiming.ts";
import { buildVideoRows, normalizeVideoRowLayouts } from "../../src/models/course/videoRows.ts";
import { groupCoursesByName } from "../../src/models/course/groupCoursesByName.ts";
import {
  buildCopyWeekSchedulesPayload,
  createCopyWeekSchedulesDraft
} from "../../src/viewmodels/home/copyWeekSchedules.ts";
import { fetchMeta } from "../../src/services/api/meta.ts";
import { fetchWeekSchedules } from "../../src/services/api/schedules.ts";
import { buildCoursePackageRequestHeaders } from "../../src/services/api/coursePackageContext.ts";
import {
  buildVideoThumbnailCacheKey,
  selectVideoThumbnailKeysToDelete
} from "../../src/utils/videoThumbnailCache.ts";
import {
  coursePackages,
  createCourseDraft,
  createScreen,
  createThreeScreenGroup,
  createVideoCard,
  packageScopedActions,
  packageScopedActionTypes,
  packageScopedCourses,
  packageScopedTemplates
} from "../fixtures/courseData.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("course package request context", () => {
  test("keeps resource ownership separate from the selected workspace header", () => {
    assert.deepEqual(buildCoursePackageRequestHeaders("Bearer token", 3), {
      Authorization: "Bearer token",
      "X-Course-Package-Id": "3"
    });
    assert.deepEqual(buildCoursePackageRequestHeaders("", null), {});
  });
});

describe("course package filtering", () => {
  test("keeps courses assigned directly or listed by package courseIds", () => {
    const result = filterCoursesByCoursePackage(packageScopedCourses, coursePackages.strength);

    assert.deepEqual(
      result.map((course) => course.id),
      [102]
    );
  });

  test("treats unscoped actions and action types as default-package records only", () => {
    assert.deepEqual(
      filterActionsByCoursePackage(packageScopedActions, coursePackages.default).map((action) => action.id),
      [1]
    );
    assert.deepEqual(
      filterActionsByCoursePackage(packageScopedActions, coursePackages.strength).map((action) => action.id),
      [2]
    );
    assert.deepEqual(
      filterActionTypesByCoursePackage(packageScopedActionTypes, coursePackages.strength).map((type) => type.id),
      [11]
    );
  });

  test("keeps lesson type options inside the active course package", () => {
    const lessonTypes = [
      { id: 20, name: "Global legacy" },
      { id: 21, name: "12ROUNDS", coursePackageIds: [2] }
    ];

    assert.deepEqual(
      filterActionTypesByCoursePackage(lessonTypes, coursePackages.strength).map((type) => type.id),
      [21]
    );
    assert.deepEqual(
      filterActionTypesByCoursePackage(lessonTypes, coursePackages.default).map((type) => type.id),
      [20]
    );
  });

  test("filters template collections by legacy and multi-package fields", () => {
    const result = filterTemplateCollectionsByCoursePackage(packageScopedTemplates, coursePackages.strength);

    assert.deepEqual(
      result.warmup.map((template) => template.id),
      [2]
    );
    assert.deepEqual(result.cooldown, []);
  });

  test("trusts server results when the selected course package has GLOBAL access", () => {
    assert.deepEqual(
      filterCoursesByCoursePackage(packageScopedCourses, coursePackages.testGlobal).map((course) => course.id),
      [101, 102, 103]
    );
    assert.deepEqual(
      filterActionsByCoursePackage(packageScopedActions, coursePackages.testGlobal).map((action) => action.id),
      [1, 2]
    );
    assert.deepEqual(
      filterActionTypesByCoursePackage(packageScopedActionTypes, coursePackages.testGlobal).map((type) => type.id),
      [10, 11]
    );
    assert.equal(filterTemplateCollectionsByCoursePackage(packageScopedTemplates, coursePackages.testGlobal).warmup.length, 2);
  });

  test("labels cross-package resources only inside a GLOBAL package", () => {
    const packages = [coursePackages.default, coursePackages.strength, coursePackages.testGlobal];

    assert.equal(
      getCrossPackageSourceLabel(packageScopedActions[1], coursePackages.testGlobal, packages),
      "力量课程包"
    );
    assert.equal(
      getCrossPackageSourceLabel(packageScopedActions[1], coursePackages.strength, packages),
      ""
    );
  });

  test("keeps existing ownership while assigning new resources to the selected package", () => {
    assert.equal(resolveExistingCoursePackageId(2, 3), 2);
    assert.equal(resolveExistingCoursePackageId(null, 3), 3);
    assert.deepEqual(resolveActionWriteCoursePackageIds([2], true, 3), [2]);
    assert.deepEqual(resolveActionWriteCoursePackageIds([], false, 3), [3]);
  });

  test("does not collapse same-name courses from different source packages", () => {
    const courses = [
      { ...packageScopedCourses[0], id: 201, name: "Shared Name" },
      { ...packageScopedCourses[1], id: 202, name: "Shared Name" }
    ];
    const groups = groupCoursesByName(courses, new Map([[201, "默认课程包"], [202, "力量课程包"]]));

    assert.equal(Object.keys(groups).length, 2);
  });
});

describe("pod ending duration", () => {
  test("normalizes legacy pod duration from the course fallback without linking pods", () => {
    const draft = createCourseDraft();
    draft.script.metadata.defaultHydrateSeconds = 60;
    draft.script.training.pods = [
      {
        ...draft.script.training.pods[0],
        id: "pod-hydrate",
        name: "Hydrate Pod",
        ending: "HYDRATE",
        endingSeconds: undefined as unknown as number
      },
      {
        ...draft.script.training.pods[0],
        id: "pod-finish",
        name: "Finish Pod",
        ending: "FINISH",
        endingSeconds: 0
      }
    ];

    const normalized = normalizeCourseScriptLocal(draft.script);
    normalized.training.pods[0].endingSeconds = 30;

    assert.equal(normalized.training.pods[0].endingSeconds, 30);
    assert.equal(normalized.training.pods[1].endingSeconds, 0);
    assert.equal(draft.script.metadata.defaultHydrateSeconds, 60);
  });

  test("validates each non-finish pod duration independently", () => {
    const draft = createCourseDraft();
    draft.script.training.pods = [
      {
        ...draft.script.training.pods[0],
        id: "pod-invalid",
        name: "Pod A",
        ending: "HYDRATE",
        endingSeconds: 0
      },
      {
        ...draft.script.training.pods[0],
        id: "pod-finish",
        name: "Pod B",
        ending: "FINISH",
        endingSeconds: 0
      }
    ];

    assert.ok(getCourseDraftIssues(draft).some((issue) => issue.includes("Pod A") && issue.includes("时长")));
  });
});

describe("week schedules api", () => {
  test("fetches lightweight meta without schedules by default for course home", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        actionTypes: [],
        lessonTypes: [],
        actions: [],
        courses: [],
        coursePackages: [],
        templates: { warmup: [], cooldown: [], training: [], course: [] },
        schedules: { currentWeek: [], lastWeek: [], history: [] }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchMeta("Bearer test", {
      coursePackageId: 2,
      includeSchedules: false,
      includeActions: false,
      includeTemplates: false
    });

    assert.equal(
      fetchMock.mock.calls[0][0],
      "/api/meta?coursePackageId=2&includeSchedules=0&includeActions=0&includeTemplates=0"
    );
  });

  test("fetches one full course through meta when a course id is requested", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        actionTypes: [],
        lessonTypes: [],
        actions: [],
        courses: [],
        coursePackages: [],
        templates: { warmup: [], cooldown: [], training: [], course: [] },
        schedules: { currentWeek: [], lastWeek: [], history: [] }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchMeta("", { courseId: 101, includeSchedules: false });

    assert.equal(fetchMock.mock.calls[0][0], "/api/meta?courseId=101&courseDetail=full&includeSchedules=0");
  });

  test("fetches a package-scoped week and accepts data-wrapped responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          date: "2026-06-24",
          weekStart: "2026-06-22",
          weekEnd: "2026-06-28",
          schedules: [{ id: 1, courseId: 10, courseName: "Strength", version: "v1", date: "2026-06-24" }]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWeekSchedules({ date: "2026-06-24", coursePackageId: 2 }, "Bearer test");

    assert.equal(fetchMock.mock.calls[0][0], "/api/schedules/week?date=2026-06-24&coursePackageId=2");
    assert.deepEqual(result.schedules.map((schedule) => schedule.id), [1]);
  });

  test("accepts direct week schedule responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          date: "2026-06-24",
          weekStart: "2026-06-22",
          weekEnd: "2026-06-28",
          schedules: []
        })
      }))
    );

    const result = await fetchWeekSchedules({ date: "2026-06-24" });

    assert.equal(result.weekStart, "2026-06-22");
    assert.deepEqual(result.schedules, []);
  });
});

describe("action type helpers", () => {
  test("matches an empty type filter and any selected overlapping type", () => {
    assert.equal(matchesTypeFilter([10, 20], []), true);
    assert.equal(matchesTypeFilter([10, 20], [30, 20]), true);
    assert.equal(matchesTypeFilter([10, 20], [30, 40]), false);
  });
});

describe("three-screen video rules", () => {
  test("keeps explicit row layouts and caps oversized layouts", () => {
    assert.deepEqual(normalizeVideoRowLayouts([2, 2, 2], 3), [2, 2, 2]);
    assert.deepEqual(normalizeVideoRowLayouts([1, 2, 2, 1, 2, 1], 3), [1, 2, 2, 1, 2]);
    assert.deepEqual(normalizeVideoRowLayouts([1, 2, 1], 1), []);
  });

  test("builds video rows from normalized layout without dropping card order", () => {
    const screen = createScreen(
      1,
      [createVideoCard("card-1", "1"), createVideoCard("card-2", "2"), createVideoCard("card-3", "3")],
      [2, 1]
    );
    const rows = buildVideoRows(screen, 3);

    assert.deepEqual(
      rows.map((row) => row.cards.map((card) => card.id)),
      [["card-1", "card-2"], ["card-3"]]
    );
  });

  test("flags duplicate station labels on an active three-screen group", () => {
    const draft = createCourseDraft({
      training: {
        videoGroups: [
          createThreeScreenGroup({
            screens: [
              createScreen(1, [createVideoCard("card-1", "A"), createVideoCard("card-2", "A")]),
              createScreen(2),
              createScreen(3)
            ]
          })
        ]
      }
    });
    const issues = getCourseDraftIssues(draft);

    assert.ok(issues.some((issue) => issue.includes("站点标签不能重复")));
  });

  test("normalizes single-screen groups to waterfall layout and removes station labels", () => {
    const draft = createCourseDraft({
      training: {
        videoGroups: [
          {
            id: "single-group",
            name: "Single",
            screenCount: 1,
            screens: [
              {
                id: "single-screen",
                screenIndex: 1,
                stationLabel: "",
                layout: "STATIONS",
                rowLayouts: [2, 2],
                videoCards: [createVideoCard("single-card", "9")]
              }
            ]
          }
        ],
        pods: [
          {
            id: "pod-1",
            name: "Pod 1",
            videoGroupId: "single-group",
            stationFlow: "NORMAL",
            ending: "FINISH",
            screens: [
              {
                id: "pod-screen-1",
                screenIndex: 1,
                loopCount: 1,
                stationRestSeconds: 5,
                setConfigs: [
                  {
                    id: "set-1",
                    workSeconds: 30,
                    restSeconds: 10
                  },
                  {
                    id: "set-2",
                    workSeconds: 20,
                    restSeconds: 0
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    const normalized = normalizeCourseScriptLocal(draft.script);
    const screen = normalized.training.videoGroups[0].screens[0];

    assert.equal(screen.layout, "WATERFALL");
    assert.deepEqual(screen.rowLayouts, []);
    assert.equal(screen.videoCards[0].stationNumber, "");
    assert.equal(normalized.training.pods[0].screens[0].setConfigs.length, 1);
  });
});

describe("pod timing and endings", () => {
  test("calculates single-screen timing across repeated action cards and station rests", () => {
    const linkedScreen = {
      ...createScreen(1, [createVideoCard("card-1", "1"), createVideoCard("card-2", "2")]),
      layout: "WATERFALL"
    };
    const total = getPodScreenTotal(
      {
        id: "pod-screen-1",
        screenIndex: 1,
        loopCount: 2,
        stationRestSeconds: 5,
        setConfigs: [
          {
            id: "set-1",
            workSeconds: 30,
            restSeconds: 10
          }
        ]
      },
      linkedScreen
    );

    assert.equal(total, 135);
  });

  test("calculates switch-flow timing by action pairs and ignores unpaired cards", () => {
    const linkedScreen = createScreen(1, [
      createVideoCard("card-1", "1"),
      createVideoCard("card-2", "2"),
      createVideoCard("card-3", "3")
    ]);
    const total = getSwitchPodScreenTotal(
      {
        id: "pod-screen-1",
        screenIndex: 1,
        loopCount: 2,
        stationRestSeconds: 5,
        setConfigs: [
          {
            id: "set-1",
            workSeconds: 20,
            restSeconds: 10
          },
          {
            id: "set-2",
            workSeconds: 15,
            restSeconds: 0
          }
        ]
      },
      linkedScreen
    );

    assert.equal(total, 185);
  });

  test("calculates one action pair per switch round and rotates through available pairs", () => {
    const linkedScreen = createScreen(1, [
      createVideoCard("card-1", "1A"),
      createVideoCard("card-2", "1B"),
      createVideoCard("card-3", "2A"),
      createVideoCard("card-4", "2B")
    ]);
    const total = getSwitchPodScreenTotal(
      {
        id: "pod-screen-1",
        screenIndex: 1,
        loopCount: 2,
        stationRestSeconds: 20,
        setConfigs: [
          {
            id: "set-1",
            workSeconds: 40,
            restSeconds: 15
          },
          {
            id: "set-2",
            workSeconds: 40,
            restSeconds: 15
          },
          {
            id: "set-3",
            workSeconds: 40,
            restSeconds: 15
          },
          {
            id: "set-4",
            workSeconds: 40,
            restSeconds: 0
          }
        ]
      },
      linkedScreen
    );

    assert.equal(total, 910);
  });

  test("rebalancePodEndings reserves FINISH for the final pod", () => {
    const draft = createCourseDraft();
    const firstPod = {
      ...draft.script.training.pods[0],
      id: "pod-1",
      ending: "FINISH"
    };
    const secondPod = {
      ...draft.script.training.pods[0],
      id: "pod-2",
      ending: "HYDRATE"
    };

    assert.deepEqual(
      rebalancePodEndings([firstPod, secondPod]).map((pod) => pod.ending),
      ["HYDRATE", "FINISH"]
    );
  });
});

describe("copy-week schedules", () => {
  test("creates default source and target weeks around the current week", () => {
    assert.deepEqual(createCopyWeekSchedulesDraft("2026-06-19"), {
      sourceWeekStart: "2026-06-15",
      targetWeekStart: "2026-06-22"
    });
  });

  test("normalizes arbitrary selected dates to week starts in the copy payload", () => {
    const result = buildCopyWeekSchedulesPayload({
      coursePackageId: "2",
      currentDate: "2026-06-19",
      draft: {
        sourceWeekStart: "2026-06-10",
        targetWeekStart: "2026-06-24"
      }
    });

    assert.deepEqual(result, {
      ok: true,
      payload: {
        coursePackageId: 2,
        sourceWeekStart: "2026-06-08",
        targetWeekStart: "2026-06-22",
        replaceExisting: false
      }
    });
  });

  test("allows copying from the current week into a future week", () => {
    assert.deepEqual(
      buildCopyWeekSchedulesPayload({
        coursePackageId: 2,
        currentDate: "2026-06-19",
        draft: {
          sourceWeekStart: "2026-06-19",
          targetWeekStart: "2026-06-22"
        }
      }),
      {
        ok: true,
        payload: {
          coursePackageId: 2,
          sourceWeekStart: "2026-06-15",
          targetWeekStart: "2026-06-22",
          replaceExisting: false
        }
      }
    );
  });

  test("allows copying from a past week into the current week", () => {
    assert.deepEqual(
      buildCopyWeekSchedulesPayload({
        coursePackageId: 2,
        currentDate: "2026-06-19",
        draft: {
          sourceWeekStart: "2026-06-08",
          targetWeekStart: "2026-06-19"
        }
      }),
      {
        ok: true,
        payload: {
          coursePackageId: 2,
          sourceWeekStart: "2026-06-08",
          targetWeekStart: "2026-06-15",
          replaceExisting: false
        }
      }
    );
  });

  test("rejects copying from future weeks, into past weeks, or into the same week", () => {
    assert.deepEqual(
      buildCopyWeekSchedulesPayload({
        coursePackageId: 2,
        currentDate: "2026-06-19",
        draft: {
          sourceWeekStart: "2026-06-22",
          targetWeekStart: "2026-06-29"
        }
      }),
      {
        ok: false,
        message: "来源周只能选择过去周或本周。"
      }
    );

    assert.deepEqual(
      buildCopyWeekSchedulesPayload({
        coursePackageId: 2,
        currentDate: "2026-06-19",
        draft: {
          sourceWeekStart: "2026-06-08",
          targetWeekStart: "2026-06-08"
        }
      }),
      {
        ok: false,
        message: "目标周只能选择本周或未来周。"
      }
    );

    assert.deepEqual(
      buildCopyWeekSchedulesPayload({
        coursePackageId: 2,
        currentDate: "2026-06-19",
        draft: {
          sourceWeekStart: "2026-06-19",
          targetWeekStart: "2026-06-19"
        }
      }),
      {
        ok: false,
        message: "来源周和目标周不能相同。"
      }
    );
  });
});

describe("video thumbnail cache", () => {
  test("builds stable action thumbnail keys and invalidates on video updates", () => {
    const base = buildVideoThumbnailCacheKey({
      actionId: 18,
      mediaUrl: "https://cdn.example.com/actions/row.mp4",
      updateTime: "2026-06-24T08:00:00.000Z"
    });

    assert.equal(
      base,
      buildVideoThumbnailCacheKey({
        actionId: 18,
        mediaUrl: "https://cdn.example.com/actions/row.mp4",
        updateTime: "2026-06-24T08:00:00.000Z"
      })
    );
    assert.notEqual(
      base,
      buildVideoThumbnailCacheKey({
        actionId: 18,
        mediaUrl: "https://cdn.example.com/actions/row-v2.mp4",
        updateTime: "2026-06-24T08:00:00.000Z"
      })
    );
    assert.notEqual(
      base,
      buildVideoThumbnailCacheKey({
        actionId: 18,
        mediaUrl: "https://cdn.example.com/actions/row.mp4",
        updateTime: "2026-06-24T09:00:00.000Z"
      })
    );
  });

  test("selects oldest thumbnails for deletion until cache is under the limit", () => {
    assert.deepEqual(
      selectVideoThumbnailKeysToDelete(
        [
          { key: "newest", bytes: 40, updatedAt: 300 },
          { key: "oldest", bytes: 70, updatedAt: 100 },
          { key: "middle", bytes: 50, updatedAt: 200 }
        ],
        90
      ),
      ["oldest"]
    );

    assert.deepEqual(
      selectVideoThumbnailKeysToDelete(
        [
          { key: "a", bytes: 60, updatedAt: 100 },
          { key: "b", bytes: 60, updatedAt: 200 },
          { key: "c", bytes: 60, updatedAt: 300 }
        ],
        80
      ),
      ["a", "b"]
    );
  });
});
