import type { MediaRecord } from "../media.ts";

export type CourseEditorTitle = "添加课程" | "编辑课程";
export type CourseSectionKey = "warmup" | "cooldown";
export type CourseLayout = "WATERFALL" | "STATIONS";
export type PodEnding = "HYDRATE" | "MOVE_ZONE" | "FINISH";
export type VideoGroupScreenCount = 1 | 3;

export interface TrainingPanel {
  setCount: number;
  breakCount: number;
  workSeconds: number;
  restSeconds: number;
}

export interface WaterfallItem {
  id: string;
  actionId: string;
  actionName: string;
  seconds: number;
  cue: string;
}

export interface WaterfallSection {
  id: string;
  title: string;
  layout: "WATERFALL";
  items: WaterfallItem[];
}

export interface VideoCard {
  id: string;
  actionId: string;
  actionName: string;
  stationNumber: string;
}

export interface VideoGroupScreen {
  id: string;
  screenIndex: number;
  stationLabel: string;
  layout: CourseLayout;
  videoCards: VideoCard[];
}

export interface VideoGroup {
  id: string;
  name: string;
  screenCount: VideoGroupScreenCount;
  screens: VideoGroupScreen[];
}

export interface PodSetConfig {
  id: string;
  workSeconds: number;
  restSeconds: number;
}

export interface PodScreen {
  id: string;
  screenIndex: number;
  loopCount: number;
  stationRestSeconds: number;
  setConfigs: PodSetConfig[];
  isCustomized?: boolean;
}

export interface Pod {
  id: string;
  name: string;
  videoGroupId: string;
  ending: PodEnding;
  screens: PodScreen[];
}

export interface CourseScript {
  metadata: {
    id: string;
    name: string;
    version: string;
    creator: string;
    tags: string[];
    defaultHydrateSeconds: number;
    trainingPanel: TrainingPanel;
  };
  sections: {
    warmup: WaterfallSection;
    cooldown: WaterfallSection;
  };
  training: {
    videoGroups: VideoGroup[];
    pods: Pod[];
  };
}

export interface CourseSummary {
  warmupSeconds: number;
  trainingSeconds: number;
  hydrateSeconds: number;
  cooldownSeconds: number;
  totalSeconds: number;
  podCount: number;
  videoGroupCount: number;
  warmupActionCount: number;
  cooldownActionCount: number;
  trainingCardCount: number;
}

export interface CourseRecord {
  id: number;
  name: string;
  creator: string;
  version: string;
  typeIds: number[];
  logoMedia: MediaRecord | null;
  summary: CourseSummary;
  script: CourseScript;
  updateTime: string;
}
