export type CourseLayout = "WATERFALL" | "STATIONS";
export type PodEnding = "HYDRATE" | "MOVE_ZONE" | "FINISH";
export type PodStationFlow = "NORMAL" | "SWITCH";
export type SimulatorPlaybackState = "IDLE" | "PREVIEW" | "SCHEDULED" | "RUNNING" | "PAUSED" | "PLAN" | "ENDED";

export interface MediaRecord {
  id?: number | string;
  url?: string;
  filename?: string;
  path?: string;
  sizeBytes?: number;
  checksum?: string;
}

export interface ActionRecord {
  id: number;
  name: string;
  media: MediaRecord | null;
  updateTime?: string;
}

export interface WaterfallItem {
  id?: string;
  actionId?: string;
  actionName?: string;
  mediaUrl?: string;
  seconds?: number;
  cue?: string;
}

export interface WaterfallSection {
  id?: string;
  title?: string;
  items?: WaterfallItem[];
}

export interface VideoCard {
  id?: string;
  actionId?: string;
  actionName?: string;
  mediaUrl?: string;
  stationNumber?: string;
  target?: string;
}

export interface VideoGroupScreen {
  id?: string;
  screenIndex: number;
  stationLabel?: string;
  layout?: CourseLayout;
  rowLayouts?: number[];
  videoCards?: VideoCard[];
}

export interface VideoGroup {
  id: string;
  name?: string;
  screenCount?: number;
  screens?: VideoGroupScreen[];
}

export interface PodSetConfig {
  id?: string;
  workSeconds?: number;
  restSeconds?: number;
}

export interface PodScreen {
  id?: string;
  screenIndex: number;
  loopCount?: number;
  stationRestSeconds?: number;
  setConfigs?: PodSetConfig[];
}

export interface Pod {
  id?: string;
  name?: string;
  videoGroupId?: string;
  ending?: PodEnding;
  endingSeconds?: number;
  stationFlow?: PodStationFlow;
  screens?: PodScreen[];
}

export interface CoursePlanItem {
  id?: string;
  text?: string;
}

export interface CoursePlanSection {
  id?: string;
  title?: string;
  items?: CoursePlanItem[];
}

export interface CoursePlan {
  sections?: CoursePlanSection[];
}

export interface CourseScript {
  metadata?: {
    id?: string;
    name?: string;
    version?: string;
    creator?: string;
    description?: string;
    topic?: string;
    rotationType?: string;
    defaultHydrateSeconds?: number;
    trainingPanel?: {
      setCount?: number;
      breakCount?: number;
      workSeconds?: number;
      restSeconds?: number;
    };
    readyDurations?: {
      warmupSeconds?: number;
      workoutSeconds?: number;
      cooldownSeconds?: number;
    };
  };
  sections?: {
    warmup?: WaterfallSection;
    cooldown?: WaterfallSection;
  };
  plan?: CoursePlan;
  training?: {
    videoGroups?: VideoGroup[];
    pods?: Pod[];
  };
}

export interface CourseSummary {
  warmupSeconds?: number;
  trainingSeconds?: number;
  cooldownSeconds?: number;
  totalSeconds?: number;
}

export interface CourseRecord {
  id: number;
  name: string;
  creator?: string;
  version?: string;
  description?: string;
  topic?: string;
  logoMedia?: MediaRecord | null;
  script?: CourseScript;
  summary?: CourseSummary;
  updateTime?: string;
}

export interface MetaPayload {
  actions?: ActionRecord[];
  courses?: CourseRecord[];
  now?: string;
}

export interface LocalPlaybackSession {
  id: string;
  state: SimulatorPlaybackState;
  previousState: Exclude<SimulatorPlaybackState, "PLAN">;
  courseId: number;
  serverStartAtMs: number;
  pausedAtMs: number;
  pausedAccumulatedMs: number;
  frozenElapsedMs: number;
  plannedStartAtMs: number;
}

export interface EffectivePodScreen {
  displayScreenIndex: number;
  rule: Required<Pick<PodScreen, "screenIndex" | "loopCount" | "stationRestSeconds">> & { setConfigs: PodSetConfig[] };
  sourceScreen: VideoGroupScreen | null;
  videoCards: VideoCard[];
  rowLayouts: number[];
  waterfallLayout: boolean;
}

export interface TrainingScreenState {
  mode: "empty" | "station" | "waterfall" | "transition";
  stageLabel: string;
  stageProgress: string;
  hintText: string;
  remainingSeconds: number;
  displayCards: VideoCard[];
  activeCardIndex: number;
  playActiveCard: boolean;
  rowLayouts: number[];
  transitionType: string;
  stageSecondaryText: string;
  completedDots: number;
  totalDots: number;
  podName: string;
}

export interface WaterfallScreenState {
  sectionTitle: string;
  items: WaterfallItem[];
  activeIndex: number;
  remainingSeconds: number;
  cue: string;
}

export interface HorizontalProgress {
  formalElapsedSeconds: number;
  formalTotalSeconds: number;
  workElapsedSeconds: number;
  workTotalSeconds: number;
  workSegments: Array<{
    workStartSeconds: number;
    durationSeconds: number;
    markerAfter?: boolean;
  }>;
}
