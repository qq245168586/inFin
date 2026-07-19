import type { VideoGroup, VideoGroupScreen, VideoRowLayout } from "../../src/models/course/types.ts";
import type { CourseDraft } from "../../src/viewmodels/courses/types.ts";
import type { ActionRecord, TypeOption } from "../../src/services/api/meta.ts";
import type { CoursePackageRecord } from "../../src/pages/venues/types.ts";
import type { TemplateCollections } from "../../src/models/templates.ts";
import type { CourseRecord } from "../../src/models/course/types.ts";

export const coursePackages = {
  default: {
    id: 1,
    name: "默认课程包",
    description: "",
    courseIds: [101],
    courseCount: 1,
    isDefault: true,
    createTime: "2026-01-01T00:00:00+08:00",
    updateTime: "2026-01-01T00:00:00+08:00"
  } as CoursePackageRecord,
  strength: {
    id: 2,
    name: "力量课程包",
    description: "",
    courseIds: [102],
    courseCount: 1,
    createTime: "2026-01-01T00:00:00+08:00",
    updateTime: "2026-01-01T00:00:00+08:00"
  } as CoursePackageRecord,
  testGlobal: {
    id: 3,
    name: "测试课程包",
    description: "",
    courseIds: [],
    courseCount: 0,
    accessScope: "GLOBAL",
    createTime: "2026-01-01T00:00:00+08:00",
    updateTime: "2026-01-01T00:00:00+08:00"
  } as CoursePackageRecord
};

export const packageScopedCourses = [
  {
    id: 101,
    name: "Baseline",
    version: "1.0.0",
    coursePackageId: 99
  },
  {
    id: 102,
    name: "Strength",
    version: "1.0.0",
    coursePackageId: 2
  },
  {
    id: 103,
    name: "Mobility",
    version: "1.0.0",
    coursePackageId: 3
  }
] as CourseRecord[];

export const packageScopedActions = [
  {
    id: 1,
    name: "Air Squat",
    typeIds: [10],
    courseTags: [],
    coursePackageIds: [],
    media: null,
    createTime: "2026-01-01T00:00:00+08:00",
    updateTime: "2026-01-01T00:00:00+08:00"
  },
  {
    id: 2,
    name: "Kettlebell Swing",
    typeIds: [11],
    courseTags: [],
    coursePackageIds: [2],
    media: null,
    createTime: "2026-01-01T00:00:00+08:00",
    updateTime: "2026-01-01T00:00:00+08:00"
  }
] as ActionRecord[];

export const packageScopedActionTypes = [
  { id: 10, name: "Bodyweight", coursePackageIds: [] },
  { id: 11, name: "Strength", coursePackageIds: [2] }
] as TypeOption[];

export const packageScopedTemplates = {
  warmup: [
    {
      id: 1,
      kind: "warmup",
      name: "Default Warmup",
      coursePackageId: 1,
      section: {
        id: "warmup-section",
        title: "热身",
        layout: "WATERFALL",
        items: []
      },
      updateTime: "2026-01-01T00:00:00+08:00"
    },
    {
      id: 2,
      kind: "warmup",
      name: "Strength Warmup",
      coursePackageIds: [2],
      section: {
        id: "strength-warmup-section",
        title: "热身",
        layout: "WATERFALL",
        items: []
      },
      updateTime: "2026-01-01T00:00:00+08:00"
    }
  ],
  cooldown: [],
  training: [],
  course: []
} as TemplateCollections;

export function createVideoCard(id: string, stationNumber: string, actionId = "action-1") {
  return {
    id,
    actionId,
    actionName: actionId ? `Action ${actionId}` : "",
    stationNumber,
    target: ""
  };
}

export function createScreen(
  screenIndex: number,
  videoCards = [createVideoCard(`card-${screenIndex}-1`, String(screenIndex))],
  rowLayouts: VideoRowLayout[] = [1]
): VideoGroupScreen {
  return {
    id: `screen-${screenIndex}`,
    screenIndex,
    stationLabel: `屏幕 ${screenIndex}`,
    layout: "STATIONS",
    rowLayouts,
    videoCards
  };
}

export function createThreeScreenGroup(overrides: Partial<VideoGroup> = {}): VideoGroup {
  return {
    id: "group-1",
    name: "三屏视频组",
    screenCount: 3,
    screens: [createScreen(1), createScreen(2), createScreen(3)],
    ...overrides
  };
}

export function createCourseDraft(overrides: Partial<CourseDraft["script"]> = {}): CourseDraft {
  const group = createThreeScreenGroup(overrides.training?.videoGroups?.[0] ? overrides.training.videoGroups[0] : {});
  const script = {
    metadata: {
      id: "course-1",
      name: "Strength 45",
      version: "1.0.0",
      creator: "Coach",
      description: "",
      topic: "",
      rotationType: "REGION",
      stationRules: {
        set: "",
        work: "",
        rest: "",
        switch: "",
        port: "",
        leader: ""
      },
      tags: [],
      defaultHydrateSeconds: 0,
      trainingPanel: {
        setCount: 1,
        breakCount: 0,
        workSeconds: 0,
        restSeconds: 0
      },
      readyDurations: {
        warmupSeconds: 15,
        workoutSeconds: 15,
        cooldownSeconds: 10
      },
      ...overrides.metadata
    },
    sections: {
      warmup: {
        id: "warmup",
        title: "热身",
        layout: "WATERFALL",
        items: [
          {
            id: "warmup-item-1",
            actionId: "warmup-action",
            actionName: "Warmup Action",
            seconds: 30,
            cue: ""
          }
        ]
      },
      cooldown: {
        id: "cooldown",
        title: "冷身",
        layout: "WATERFALL",
        items: []
      },
      ...overrides.sections
    },
    plan: overrides.plan || {
      sections: []
    },
    training: {
      videoGroups: [group],
      pods: [
        {
          id: "pod-1",
          name: "Pod 1",
          videoGroupId: group.id,
          stationFlow: "NORMAL",
          ending: "FINISH",
          endingSeconds: 0,
          screens: group.screens.map((screen) => ({
            id: `pod-screen-${screen.screenIndex}`,
            screenIndex: screen.screenIndex,
            loopCount: 1,
            stationRestSeconds: 0,
            setConfigs: [
              {
                id: `set-${screen.screenIndex}-1`,
                workSeconds: 30,
                restSeconds: 0
              }
            ]
          }))
        }
      ],
      ...overrides.training
    }
  } as CourseDraft["script"];

  return {
    id: null,
    typeIds: [],
    logoMedia: null,
    logoFile: null,
    logoPreview: "",
    script
  };
}
