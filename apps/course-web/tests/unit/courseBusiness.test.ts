import assert from "node:assert/strict";
import { describe, test } from "vitest";

import {
  filterActionsByCoursePackage,
  filterActionTypesByCoursePackage,
  filterCoursesByCoursePackage,
  filterTemplateCollectionsByCoursePackage
} from "../../src/utils/coursePackageScope.ts";
import { matchesTypeFilter } from "../../src/viewmodels/courses/courseEditorGuards.ts";
import { getCourseDraftIssues } from "../../src/viewmodels/courses/courseValidation.ts";
import { normalizeCourseScriptLocal } from "../../src/viewmodels/courses/courseScriptNormalize.ts";
import { rebalancePodEndings } from "../../src/viewmodels/courses/podGraph.ts";
import { getPodScreenTotal, getSwitchPodScreenTotal } from "../../src/viewmodels/courses/podTiming.ts";
import { buildVideoRows, normalizeVideoRowLayouts } from "../../src/models/course/videoRows.ts";
import {
  buildCopyWeekSchedulesPayload,
  createCopyWeekSchedulesDraft
} from "../../src/viewmodels/home/copyWeekSchedules.ts";
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
});

describe("action type helpers", () => {
  test("matches an empty type filter and any selected overlapping type", () => {
    assert.equal(matchesTypeFilter([10, 20], []), true);
    assert.equal(matchesTypeFilter([10, 20], [30, 20]), true);
    assert.equal(matchesTypeFilter([10, 20], [30, 40]), false);
  });
});

describe("three-screen video rules", () => {
  test("normalizes legacy all-two-column rows to five rows and caps oversized layouts", () => {
    assert.deepEqual(normalizeVideoRowLayouts([2, 2, 2], 3), [2, 2, 2, 2, 2]);
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
