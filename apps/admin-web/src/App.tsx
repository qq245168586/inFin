import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import AppVersionsPage from "./AppVersionsPage.tsx";
import VenueManagementPage from "./VenueManagementPage.tsx";

type NavKey = "home" | "courses" | "actions" | "templates" | "venues" | "appVersions";
type HomeTabKey = "currentWeek" | "lastWeek" | "history";
type TypeDialogKind = "action" | "lesson";
type CourseEditorTitle = "添加课程" | "编辑课程";
type TemplateKind = "warmup" | "cooldown" | "training";

interface TypeOption {
  id: number;
  name: string;
}

interface MediaRecord {
  id: number;
  kind: string;
  filename: string;
  originalName: string;
  type: string;
  url: string;
}

interface ActionRecord {
  id: number;
  name: string;
  typeIds: number[];
  media: MediaRecord | null;
  createTime: string;
  updateTime: string;
}

interface BatchUploadItem {
  id: string;
  file: File;
  fileName: string;
  actionName: string;
  rawTypeName: string;
  resolvedTypeId: number | null;
  resolvedTypeName: string;
  needsCreateType: boolean;
  status: "ready" | "invalid";
  message: string;
}

interface BatchUploadDialogState {
  items: BatchUploadItem[];
}

type CourseSectionKey = "warmup" | "cooldown";
type CourseLayout = "WATERFALL" | "STATIONS";
type PodEnding = "HYDRATE" | "MOVE_ZONE" | "FINISH";
type VideoGroupScreenCount = 1 | 3;

interface WaterfallItem {
  id: string;
  actionId: string;
  actionName: string;
  seconds: number;
  cue: string;
}

interface WaterfallSection {
  id: string;
  title: string;
  layout: "WATERFALL";
  items: WaterfallItem[];
}

interface VideoCard {
  id: string;
  actionId: string;
  actionName: string;
  stationNumber: string;
}

interface VideoGroupScreen {
  id: string;
  screenIndex: number;
  stationLabel: string;
  layout: CourseLayout;
  videoCards: VideoCard[];
}

interface VideoGroup {
  id: string;
  name: string;
  screenCount: VideoGroupScreenCount;
  screens: VideoGroupScreen[];
}

interface PodSetConfig {
  id: string;
  workSeconds: number;
  restSeconds: number;
}

interface PodScreen {
  id: string;
  screenIndex: number;
  loopCount: number;
  stationRestSeconds: number;
  setConfigs: PodSetConfig[];
  isCustomized?: boolean;
}

interface Pod {
  id: string;
  name: string;
  videoGroupId: string;
  ending: PodEnding;
  screens: PodScreen[];
}

interface TrainingPanel {
  setCount: number;
  breakCount: number;
  workSeconds: number;
  restSeconds: number;
}

interface CourseScript {
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

interface CourseSummary {
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

interface CourseRecord {
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

interface ScheduleRecord {
  id: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

interface ScheduleCollection {
  currentWeek: ScheduleRecord[];
  lastWeek: ScheduleRecord[];
  history: ScheduleRecord[];
}

interface VenueRecord {
  id: string;
  name: string;
  accountNamespace: string;
  createTime: string;
  updateTime: string;
}

interface WaterfallTemplateRecord {
  id: number;
  kind: "warmup" | "cooldown";
  name: string;
  section: WaterfallSection;
  updateTime: string;
}

interface TrainingTemplateRecord {
  id: number;
  kind: "training";
  name: string;
  videoGroup: VideoGroup;
  updateTime: string;
}

type TemplateRecord = WaterfallTemplateRecord | TrainingTemplateRecord;

interface TemplateCollections {
  warmup: WaterfallTemplateRecord[];
  cooldown: WaterfallTemplateRecord[];
  training: TrainingTemplateRecord[];
}

interface MetaPayload {
  actionTypes: TypeOption[];
  lessonTypes: TypeOption[];
  actions: ActionRecord[];
  courses: CourseRecord[];
  templates: TemplateCollections;
  schedules: ScheduleCollection;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface LegacyEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
}

interface AuthTokenPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
}

interface AuthSession extends AuthTokenPayload, UserProfile {}

interface LoginFormState {
  username: string;
  password: string;
}

interface ActionDraft {
  id: number | null;
  name: string;
  typeIds: number[];
  media: MediaRecord | null;
  uploadFile: File | null;
  previewUrl: string;
}

interface CourseDraft {
  id: number | null;
  typeIds: number[];
  logoMedia: MediaRecord | null;
  logoFile: File | null;
  logoPreview: string;
  script: CourseScript;
}

interface CourseEditorTabState {
  tabId: string;
  courseId: number | null;
  title: CourseEditorTitle;
  draft: CourseDraft;
}

interface ScheduleDraft {
  courseName: string;
  courseId: string;
  version: string;
  date: string;
  time: string;
  duration: string;
}

interface CalendarDay {
  key: string;
  title: string;
  subtitle: string;
}

interface NoticeState {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface TypeDialogState {
  kind: TypeDialogKind;
  value: string;
}

interface PodRuleSetDraft {
  id: string;
  workSeconds: string;
  restSeconds: string;
}

interface PodRuleDialogState {
  podId: string;
  podName: string;
  screenId: string;
  screenIndex: number;
  screenLabel: string;
  isSingleScreen: boolean;
  loopCount: string;
  setCount: string;
  stationRestSeconds: string;
  setConfigs: PodRuleSetDraft[];
}

interface PodCopyDialogState {
  podId: string;
  podName: string;
  targetScreenId: string;
  targetScreenIndex: number;
  targetScreenLabel: string;
  selectedSourceScreenId: string;
}

interface PodConfigCopyDialogState {
  targetPodId: string;
  targetPodName: string;
  selectedSourcePodId: string;
}

interface FilterState {
  search: string;
  typeIds: number[];
}

interface CourseFilterState {
  name: string;
  creator: string;
  version: string;
  typeIds: number[];
}

interface TemplateDraft {
  id: number | null;
  kind: TemplateKind;
  name: string;
  section: WaterfallSection | null;
  videoGroup: VideoGroup | null;
}

interface TemplateUseDialogState {
  target: TemplateKind;
  selectedTemplateId: string;
  targetVideoGroupId?: string;
  targetVideoGroupName?: string;
}

interface DialogProps {
  title: string;
  width?: number;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
}

interface FilterChipsProps {
  options: TypeOption[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onAdd?: () => void;
}

interface DraftNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  minValue?: number;
  onValueChange: (value: number) => void;
}

interface EmptyBlockProps {
  title: string;
  copy: string;
}

interface CalendarBoardProps {
  weekDays: CalendarDay[];
  schedules: ScheduleRecord[];
  onDelete: (scheduleId: number) => void;
}

type CourseGroups = Record<string, CourseRecord[]>;

const NAV_ITEMS: Array<{ key: NavKey; label: string; short: string }> = [
  { key: "home", label: "首页", short: "H" },
  { key: "courses", label: "课程", short: "C" },
  { key: "actions", label: "动作库", short: "A" },
  { key: "templates", label: "课程模板", short: "T" },
  { key: "venues", label: "场馆管理", short: "M" },
  { key: "appVersions", label: "应用版本", short: "V" }
];

const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "currentWeek", label: "本周" },
  { key: "lastWeek", label: "上周" },
  { key: "history", label: "历史排课" }
];

const TEMPLATE_TABS: Array<{ key: TemplateKind; label: string }> = [
  { key: "warmup", label: "热身模板" },
  { key: "cooldown", label: "冷身模板" },
  { key: "training", label: "正式组模板" }
];

const POD_ENDING_OPTIONS: Array<{ value: PodEnding; label: string; hint: string }> = [
  { value: "HYDRATE", label: "补水", hint: "Pod 结束后进入补水" },
  { value: "MOVE_ZONE", label: "更换区域", hint: "Pod 结束后提示 move zone" },
  { value: "FINISH", label: "课程结束", hint: "最后一个 Pod 结束后进入课程收尾" }
];

const SECTION_COPY: Record<CourseSectionKey, string> = {
  warmup: "三个竖屏同步播放同一组横向动作视频，按瀑布流依次播放并自动滚动。",
  cooldown: "显示逻辑与热身一致，三个竖屏同步显示同一组冷身视频瀑布流。"
};

const CALENDAR_START_HOUR = 0;
const CALENDAR_END_HOUR = 24;
const CALENDAR_HOUR_HEIGHT = 70;
const AUTH_STORAGE_KEY = "infini-admin-auth";
const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function composeCnDateTime(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

function toggleNumberId(list: number[], id: number): number[] {
  const numericId = Number(id);
  return list.includes(numericId)
    ? list.filter((value) => value !== numericId)
    : [...list, numericId];
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stationCode(value: string | number | null | undefined): string {
  return String(value ?? "").trim();
}

function stationInputValue(value: string | number | null | undefined): string {
  return String(value ?? "");
}

function readPositiveNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function DraftNumberInput({ value, minValue = 0, onValueChange, onBlur, onFocus, ...props }: DraftNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  return (
    <input
      {...props}
      type="number"
      min={minValue}
      value={draft}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue === "" || nextValue === "-") {
          return;
        }

        const parsed = Number(nextValue);
        if (Number.isFinite(parsed) && parsed >= minValue) {
          onValueChange(Math.floor(parsed));
        }
      }}
      onBlur={(event) => {
        setIsFocused(false);

        if (draft === "" || draft === "-") {
          const fallbackValue = Math.max(value, minValue);
          setDraft(String(fallbackValue));
          onValueChange(fallbackValue);
          onBlur?.(event);
          return;
        }

        const parsed = Number(draft);
        const normalized = Number.isFinite(parsed) ? Math.max(Math.floor(parsed), minValue) : Math.max(value, minValue);
        setDraft(String(normalized));
        onValueChange(normalized);
        onBlur?.(event);
      }}
    />
  );
}

function findActionName(actions: ActionRecord[], actionId: string): string {
  return actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

function findActionRecord(actions: ActionRecord[], actionId: string): ActionRecord | null {
  return actions.find((item) => String(item.id) === String(actionId)) ?? null;
}

function createTrainingPanel(overrides: Partial<TrainingPanel> = {}): TrainingPanel {
  return {
    setCount: 1,
    breakCount: 0,
    workSeconds: 0,
    restSeconds: 0,
    ...overrides
  };
}

function createWaterfallItem(actionId = "", actionName = ""): WaterfallItem {
  return {
    id: uid("waterfall"),
    actionId,
    actionName,
    seconds: 0,
    cue: ""
  };
}

function createWaterfallSection(title: string): WaterfallSection {
  return {
    id: uid("section"),
    title,
    layout: "WATERFALL",
    items: [createWaterfallItem()]
  };
}

function createVideoCard(stationNumber = ""): VideoCard {
  return {
    id: uid("video-card"),
    actionId: "",
    actionName: "",
    stationNumber: stationInputValue(stationNumber)
  };
}

function createVideoGroupScreen(screenIndex: number, screenCount: VideoGroupScreenCount): VideoGroupScreen {
  return {
    id: uid("video-group-screen"),
    screenIndex,
    stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
    layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
    videoCards: [createVideoCard()]
  };
}

function createVideoGroup(screenCount: VideoGroupScreenCount = 3): VideoGroup {
  return {
    id: uid("video-group"),
    name: screenCount === 1 ? "单屏瀑布组" : "三屏视频组",
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) => createVideoGroupScreen(index + 1, screenCount))
  };
}

function createPodSetConfig(overrides: Partial<PodSetConfig> = {}): PodSetConfig {
  return {
    id: overrides.id || uid("pod-set"),
    workSeconds: readNonNegativeNumber(overrides.workSeconds, 0),
    restSeconds: readNonNegativeNumber(overrides.restSeconds, 0)
  };
}

function normalizePodSetConfigs(setConfigs: Partial<PodSetConfig>[] = [], fallbackCount = 1): PodSetConfig[] {
  const safeCount = Math.max(setConfigs.length || fallbackCount, 1);
  return Array.from({ length: safeCount }, (_, index) => {
    const existing = setConfigs[index] || {};
    const isLast = index === safeCount - 1;
    return {
      id: existing.id || uid("pod-set"),
      workSeconds: readNonNegativeNumber(existing.workSeconds, 0),
      restSeconds: isLast ? 0 : readNonNegativeNumber(existing.restSeconds, 0)
    };
  });
}

function normalizePodSetConfigsForLayout(
  setConfigs: Partial<PodSetConfig>[] = [],
  isSingleScreen = false,
  fallbackCount = 1
): PodSetConfig[] {
  const source = isSingleScreen ? (setConfigs.length ? [setConfigs[0]] : []) : setConfigs;
  const targetCount = isSingleScreen ? 1 : Math.max(source.length || fallbackCount, 1);
  return normalizePodSetConfigs(source, targetCount).slice(0, targetCount);
}

function resizePodSetConfigs(setConfigs: PodSetConfig[], nextCount: number): PodSetConfig[] {
  return normalizePodSetConfigs(setConfigs, Math.max(nextCount, 1));
}

function parsePositiveIntInput(value: string, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return Math.max(fallback, 1);
}

function parseNonNegativeIntInput(value: string, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }
  return Math.max(fallback, 0);
}

function createPodRuleSetDraft(
  setConfig?: Partial<PodSetConfig> | Partial<PodRuleSetDraft>,
  isLast = false
): PodRuleSetDraft {
  return {
    id: setConfig?.id || uid("pod-set"),
    workSeconds: String(readNonNegativeNumber(setConfig?.workSeconds, 0)),
    restSeconds: String(isLast ? 0 : readNonNegativeNumber(setConfig?.restSeconds, 0))
  };
}

function resizePodRuleSetDrafts(setConfigs: PodRuleSetDraft[], nextCount: number): PodRuleSetDraft[] {
  const safeCount = Math.max(nextCount, 1);
  return Array.from({ length: safeCount }, (_, index) => {
    const existing = setConfigs[index];
    return createPodRuleSetDraft(existing, index === safeCount - 1);
  });
}

function createPodRuleDialogState(
  pod: Pod,
  screen: PodScreen,
  screenLabel: string,
  isSingleScreen: boolean
): PodRuleDialogState {
  const normalizedSetConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreen, 1);
  return {
    podId: pod.id,
    podName: pod.name || "Pod",
    screenId: screen.id,
    screenIndex: screen.screenIndex,
    screenLabel,
    isSingleScreen,
    loopCount: String(screen.loopCount),
    setCount: String(normalizedSetConfigs.length),
    stationRestSeconds: String(screen.stationRestSeconds),
    setConfigs: resizePodRuleSetDrafts(
      normalizedSetConfigs.map((setConfig, index) =>
        createPodRuleSetDraft(setConfig, index === normalizedSetConfigs.length - 1)
      ),
      normalizedSetConfigs.length
    )
  };
}

function hasCustomPodRules(screen: Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }): boolean {
  if (typeof screen.isCustomized === "boolean") {
    return screen.isCustomized;
  }

  return (
    screen.loopCount !== undefined ||
    screen.stationRestSeconds !== undefined ||
    (Array.isArray(screen.setConfigs) && screen.setConfigs.length > 0) ||
    (Array.isArray(screen.segments) && screen.segments.length > 0)
  );
}

function podHasCustomizedRules(pod: Pod | null | undefined): boolean {
  return Boolean(pod?.screens?.some((screen) => Boolean(screen?.isCustomized)));
}

function createPodScreen(
  screenIndex: number,
  screenCount: VideoGroupScreenCount,
  existing?: Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }
): PodScreen {
  const isSingleScreen = screenCount === 1;
  const legacyFirstSegment = Array.isArray(existing?.segments) ? existing?.segments[0] : null;
  const setConfigs =
    Array.isArray(existing?.setConfigs) && existing.setConfigs.length
        ? existing.setConfigs
      : [
          createPodSetConfig({
            workSeconds: readNonNegativeNumber(legacyFirstSegment?.workSeconds, 0),
            restSeconds: 0
          })
        ];

  return {
    id: existing?.id || uid("pod-screen"),
    screenIndex,
    loopCount: Math.max(Number(existing?.loopCount) || (Array.isArray(existing?.segments) ? existing.segments.length : 1), 1),
    stationRestSeconds: readNonNegativeNumber(existing?.stationRestSeconds, readNonNegativeNumber(legacyFirstSegment?.restSeconds, 0)),
    setConfigs: normalizePodSetConfigsForLayout(setConfigs, isSingleScreen, 1),
    isCustomized: existing ? hasCustomPodRules(existing) : false
  };
}

function createPodScreensFromGroup(group: VideoGroup, existingScreens: Array<Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }> = []): PodScreen[] {
  return group.screens.map((screen) => {
    const existing = existingScreens.find((item) => item.screenIndex === screen.screenIndex);
    return createPodScreen(screen.screenIndex, group.screenCount, existing);
  });
}

function createPod(group?: VideoGroup): Pod {
  const resolvedGroup = group || createVideoGroup(3);
  return {
    id: uid("pod"),
    name: `Pod ${Math.floor(Math.random() * 90) + 10}`,
    videoGroupId: resolvedGroup.id,
    ending: "HYDRATE",
    screens: createPodScreensFromGroup(resolvedGroup)
  };
}

function createEmptyCourseScript(): CourseScript {
  const defaultGroup = createVideoGroup(3);
  return {
    metadata: {
      id: uid("course"),
      name: "",
      version: "",
      creator: "",
      tags: [],
      defaultHydrateSeconds: 0,
      trainingPanel: createTrainingPanel({
        setCount: 1,
        breakCount: 0
      })
    },
    sections: {
      warmup: createWaterfallSection("热身"),
      cooldown: createWaterfallSection("冷身")
    },
    training: {
      videoGroups: [defaultGroup],
      pods: [
        {
          ...createPod(defaultGroup),
          name: "Pod 1",
          ending: "FINISH"
        }
      ]
    }
  };
}

function syncTrainingPanelCounters(script: CourseScript): CourseScript {
  return {
    ...script,
    metadata: {
      ...script.metadata,
      trainingPanel: {
        ...createTrainingPanel(script.metadata.trainingPanel),
        setCount: script.training.pods.length,
        breakCount: script.training.pods.filter((pod) => pod.ending === "HYDRATE").length
      }
    }
  };
}

function normalizeCourseScriptLocal(script: CourseScript): CourseScript {
  const cloned = cloneDeep(script);
  const sections = {
    warmup: cloneWaterfallSectionForEditor(cloned.sections?.warmup, "热身"),
    cooldown: cloneWaterfallSectionForEditor(cloned.sections?.cooldown, "冷身", true)
  };
  const videoGroups: VideoGroup[] = (cloned.training?.videoGroups || []).map((group) => {
    const resolvedScreenCount: VideoGroupScreenCount = group.screenCount === 1 ? 1 : 3;

    return {
      ...group,
      id: group.id || uid("video-group"),
      name: typeof group.name === "string" ? group.name : "",
      screenCount: resolvedScreenCount,
      screens: (group.screens || []).map((screen, screenIndex) => ({
        ...screen,
        id: screen.id || uid("video-group-screen"),
        screenIndex: screen.screenIndex || screenIndex + 1,
        stationLabel:
          screen.stationLabel || (resolvedScreenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screen.screenIndex || screenIndex + 1}`),
        layout: resolvedScreenCount === 1 ? "WATERFALL" : "STATIONS",
        videoCards: (screen.videoCards || []).map((card) => ({
          ...card,
          id: card.id || uid("video-card"),
          stationNumber: stationInputValue(card.stationNumber)
        }))
      }))
    };
  });

  const videoGroupMap = new Map(videoGroups.map((group) => [group.id, group]));
  const pods = (cloned.training?.pods || []).map((pod) => {
    const linkedGroup = videoGroupMap.get(pod.videoGroupId) || videoGroups[0] || createVideoGroup(3);
    return {
      ...pod,
      id: pod.id || uid("pod"),
      name: typeof pod.name === "string" ? pod.name : "",
      videoGroupId: pod.videoGroupId || linkedGroup.id,
      ending:
        pod.ending === "MOVE_ZONE" || pod.ending === "FINISH" || pod.ending === "HYDRATE"
          ? pod.ending
          : "HYDRATE",
      screens: createPodScreensFromGroup(linkedGroup, (pod.screens as Array<Partial<PodScreen>>) || [])
    };
  });

  return syncTrainingPanelCounters({
    ...cloned,
    sections,
    metadata: {
      ...cloneDeep(cloned.metadata),
      defaultHydrateSeconds: readNonNegativeNumber(cloned.metadata?.defaultHydrateSeconds, 0),
      trainingPanel: createTrainingPanel(cloned.metadata?.trainingPanel)
    },
    training: {
      ...cloned.training,
      videoGroups,
      pods: rebalancePodEndings(pods)
    }
  });
}

function syncPodWithVideoGroup(pod: Pod, videoGroup: VideoGroup | undefined): Pod {
  if (!videoGroup) {
    return pod;
  }

  return {
    ...pod,
    screens: createPodScreensFromGroup(videoGroup, pod.screens)
  };
}

function getPodScreenActionCount(screen: PodScreen, linkedScreen: VideoGroupScreen | null): number {
  if (!linkedScreen?.videoCards?.length) {
    return 0;
  }
  return linkedScreen.videoCards.length * Math.max(Number(screen.loopCount) || 0, 0);
}

function getPodScreenTotal(screen: PodScreen, linkedScreen: VideoGroupScreen | null): number {
  const cardCount = linkedScreen?.videoCards?.length || 0;
  if (!cardCount) {
    return 0;
  }

  const isSingleScreen = linkedScreen?.layout === "WATERFALL";
  const setConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreen, 1);
  const perLoopSeconds = setConfigs.reduce(
    (total, setConfig, index) =>
      total +
      (Number(setConfig.workSeconds) || 0) +
      (index < setConfigs.length - 1 ? Math.max(Number(setConfig.restSeconds) || 0, 0) : 0),
    0
  );
  const loopCount = Math.max(Number(screen.loopCount) || 0, 0);

  if (!loopCount) {
    return 0;
  }

  if (isSingleScreen) {
    const actionCount = cardCount * loopCount;
    const transitionSeconds =
      Math.max(actionCount - 1, 0) * Math.max(Number(screen.stationRestSeconds) || 0, 0);
    return actionCount * perLoopSeconds + transitionSeconds;
  }

  const transitionSeconds =
    Math.max(loopCount - 1, 0) * Math.max(Number(screen.stationRestSeconds) || 0, 0);
  return loopCount * perLoopSeconds + transitionSeconds;
}

function formatPodTimingMismatch(pod: Pod, linkedGroup: VideoGroup | null): string {
  const details = pod.screens.map((screen) => {
    const linkedScreen =
      linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
    const actionCount = linkedScreen?.videoCards.length || 0;
    const total = getPodScreenTotal(screen, linkedScreen);
    return `屏幕 ${screen.screenIndex}：${actionCount} 个动作，${formatSecondsLabel(total)}`;
  });

  return `当前 Pod 各屏总时长不一致。${details.join("；")}。通常是视频组动作数量或屏幕规则不同导致的。`;
}

function summarizeCourseScript(script: CourseScript): CourseSummary {
  const warmupSeconds = script.sections.warmup.items.reduce((total, item) => total + Number(item.seconds || 0), 0);
  const cooldownSeconds = script.sections.cooldown.items.reduce((total, item) => total + Number(item.seconds || 0), 0);
  const trainingSeconds = script.training.pods.reduce(
    (total, pod) => {
      const linkedGroup = script.training.videoGroups.find((group) => group.id === pod.videoGroupId) || null;
      const firstScreen = pod.screens[0] || null;
      const linkedScreen = firstScreen
        ? linkedGroup?.screens.find((screen) => screen.screenIndex === firstScreen.screenIndex) || null
        : null;
      return total + (firstScreen ? getPodScreenTotal(firstScreen, linkedScreen) : 0);
    },
    0
  );
  const hydrateSeconds = script.training.pods.reduce(
    (total, pod) =>
      total +
      (pod.ending === "FINISH" ? 0 : Number(script.metadata.defaultHydrateSeconds || 0)),
    0
  );
  const trainingCardCount = script.training.videoGroups.reduce(
    (total, group) => total + group.screens.reduce((screenTotal, screen) => screenTotal + screen.videoCards.length, 0),
    0
  );

  return {
    warmupSeconds,
    trainingSeconds,
    hydrateSeconds,
    cooldownSeconds,
    totalSeconds: warmupSeconds + trainingSeconds + hydrateSeconds + cooldownSeconds,
    podCount: script.training.pods.length,
    videoGroupCount: script.training.videoGroups.length,
    warmupActionCount: script.sections.warmup.items.length,
    cooldownActionCount: script.sections.cooldown.items.length,
    trainingCardCount
  };
}

function formatSecondsLabel(totalSeconds: number): string {
  if (!totalSeconds) {
    return "0s";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) {
    return `${seconds}s`;
  }
  if (!seconds) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatSecondsStrategy(values: number[]): string {
  if (!values.length) {
    return "0s";
  }
  return values.map((value) => `${Math.max(Number(value) || 0, 0)}s`).join(" / ");
}

function formatRestStrategy(screen: PodScreen, isSingleScreen = false): string {
  if (isSingleScreen) {
    return `${Math.max(Number(screen.stationRestSeconds) || 0, 0)}s`;
  }
  const groupRestValues = screen.setConfigs.slice(0, -1).map((setConfig) => setConfig.restSeconds);
  return [...groupRestValues.map((value) => `${Math.max(Number(value) || 0, 0)}s`), `换站 ${Math.max(Number(screen.stationRestSeconds) || 0, 0)}s`].join(" / ");
}

function getCourseDraftIssues(draft: CourseDraft): string[] {
  const issues: string[] = [];
  const script = draft.script;
  const needsTransitionDuration = script.training.pods.some((pod) => pod.ending !== "FINISH");

  if (!script.metadata.name.trim()) {
    issues.push("课程名称不能为空。");
  }
  if (!script.metadata.creator.trim()) {
    issues.push("课程设计者不能为空。");
  }
  if (!script.metadata.version.trim()) {
    issues.push("课程版本不能为空。");
  }
  if (needsTransitionDuration && Number(script.metadata.defaultHydrateSeconds) <= 0) {
    issues.push("当前课程包含补水或换区 Pod，请填写补水 / 换区时长。");
  }
  if (Number(script.metadata.trainingPanel.workSeconds) <= 0) {
    issues.push("TV 横屏的 work 时间必须大于 0。");
  }
  if (Number(script.metadata.trainingPanel.restSeconds) < 0) {
    issues.push("TV 横屏的 rest 时间不能小于 0。");
  }

  (["warmup", "cooldown"] as CourseSectionKey[]).forEach((sectionKey) => {
    const section = script.sections[sectionKey];
    const isOptionalSection = sectionKey === "cooldown";
    if (!section.items.length) {
      if (!isOptionalSection) {
        issues.push(`${section.title}至少需要一个动作。`);
      }
      return;
    }

    section.items.forEach((item, index) => {
      if (!item.actionId) {
        issues.push(`${section.title}第 ${index + 1} 个动作还没有选择动作。`);
      }
      if (Number(item.seconds) <= 0) {
        issues.push(`${section.title}第 ${index + 1} 个动作时长必须大于 0。`);
      }
    });
  });

  if (!script.training.videoGroups.length) {
    issues.push("正式训练至少需要一个视频组。");
  }

  script.training.videoGroups.forEach((group) => {
    if (![1, 3].includes(group.screenCount)) {
      issues.push(`视频组 ${group.name || "未命名"} 只允许单屏或三屏。`);
    }

    group.screens.forEach((screen) => {
      if (group.screenCount !== 1) {
        const stationCodes = screen.videoCards.map((card) => stationCode(card.stationNumber));
        if (stationCodes.some((code) => !code)) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 站点标签不能为空。`);
        }
        if (new Set(stationCodes).size !== stationCodes.length) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 站点标签不能重复。`);
        }
      }
      if (!screen.videoCards.length) {
        issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 至少需要一个动作。`);
      }
      screen.videoCards.forEach((card, index) => {
        if (!card.actionId) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 第 ${index + 1} 个卡片未选择动作。`);
        }
      });
    });
  });

  if (!script.training.pods.length) {
    issues.push("正式训练至少需要一个 Pod。");
  }

  script.training.pods.forEach((pod, podIndex) => {
    const linkedGroup = script.training.videoGroups.find((group) => group.id === pod.videoGroupId);
    if (!linkedGroup) {
      issues.push(`Pod ${pod.name || podIndex + 1} 没有关联到有效的视频组。`);
      return;
    }

    if (pod.screens.length !== linkedGroup.screenCount) {
      issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕数量必须和视频组保持一致。`);
    }

    const totals = pod.screens.map((screen) => {
      const linkedScreen = linkedGroup.screens.find((item) => item.screenIndex === screen.screenIndex) || null;
      return getPodScreenTotal(screen, linkedScreen);
    });
    if (totals.some((total) => total !== totals[0])) {
      issues.push(`Pod ${pod.name || podIndex + 1} 的各屏总时长必须一致。`);
    }

    pod.screens.forEach((screen) => {
      const linkedScreen = linkedGroup.screens.find((item) => item.screenIndex === screen.screenIndex);
      const isSingleScreen = linkedGroup.screenCount === 1;
      const effectiveSetConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreen, 1);
      if (!effectiveSetConfigs.length) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 至少需要 1 组训练。`);
      }
      if (Number(screen.loopCount) <= 0) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 循环次数必须大于 0。`);
      }
      if (Number(screen.stationRestSeconds) < 0) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 换站休息不能小于 0。`);
      }
      effectiveSetConfigs.forEach((setConfig, setIndex) => {
        if (Number(setConfig.workSeconds) <= 0) {
          issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组 work 时间必须大于 0。`);
        }
        if (setIndex < effectiveSetConfigs.length - 1 && Number(setConfig.restSeconds) < 0) {
          issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组间休息不能小于 0。`);
        }
      });
      if (!linkedScreen?.videoCards.length) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 绑定的视频组还没有动作。`);
      }
    });

    const isLastPod = podIndex === script.training.pods.length - 1;
    if (isLastPod && pod.ending !== "FINISH") {
      issues.push("最后一个 Pod 必须以课程结束收尾。");
    }
    if (!isLastPod && pod.ending === "FINISH") {
      issues.push("只有最后一个 Pod 可以结束课程。");
    }
  });

  return issues;
}

function createPodName(index: number): string {
  return `Pod ${index + 1}`;
}

function rebalancePodEndings(pods: Pod[]): Pod[] {
  return pods.map((pod, index) => {
    const isLastPod = index === pods.length - 1;
    if (isLastPod) {
      return {
        ...pod,
        ending: "FINISH"
      };
    }

    return {
      ...pod,
      ending: pod.ending === "FINISH" ? "HYDRATE" : pod.ending
    };
  });
}

function syncPodsForVideoGroup(script: CourseScript, nextGroup: VideoGroup): CourseScript {
  return {
    ...script,
    training: {
      ...script.training,
      videoGroups: script.training.videoGroups.map((group) => (group.id === nextGroup.id ? nextGroup : group)),
      pods: script.training.pods.map((pod) =>
        pod.videoGroupId === nextGroup.id ? syncPodWithVideoGroup(pod, nextGroup) : pod
      )
    }
  };
}

function removeVideoGroup(script: CourseScript, groupId: string): CourseScript {
  if (script.training.videoGroups.length <= 1) {
    return script;
  }

  const remainingGroups = script.training.videoGroups.filter((group) => group.id !== groupId);
  const fallbackGroup = remainingGroups[0];
  if (!fallbackGroup) {
    return script;
  }

  return {
    ...script,
    training: {
      ...script.training,
      videoGroups: remainingGroups,
      pods: rebalancePodEndings(
        script.training.pods.map((pod) => {
          if (pod.videoGroupId !== groupId) {
            return pod;
          }

          return syncPodWithVideoGroup(
            {
              ...pod,
              videoGroupId: fallbackGroup.id
            },
            fallbackGroup
          );
        })
      )
    }
  };
}

function createActionDraft(action: ActionRecord | null = null): ActionDraft {
  return {
    id: action?.id ?? null,
    name: action?.name ?? "",
    typeIds: [...(action?.typeIds ?? [])],
    media: action?.media ?? null,
    uploadFile: null,
    previewUrl: action?.media?.url ? withCacheToken(action.media.url, action.updateTime) : ""
  };
}

function normalizeBatchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[\s_\-－—]+/g, "")
    .replace(/[()（）]/g, "");
}

function formatGeneratedTypeName(value: string): string {
  const text = value.trim();
  if (!text) {
    return "";
  }

  if (/[\u4e00-\u9fff]/.test(text)) {
    return text;
  }

  return text
    .split(/[\s_\-－—]+/)
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" ");
}

function buildActionTypeLookup(options: TypeOption[]): Map<string, TypeOption> {
  const lookup = new Map<string, TypeOption>();

  options.forEach((item) => {
    const normalized = normalizeBatchKey(item.name);
    if (!normalized) {
      return;
    }

    if (!lookup.has(normalized)) {
      lookup.set(normalized, item);
    }

    const withoutLeadingNumber = normalized.replace(/^\d+/, "");
    if (withoutLeadingNumber && !lookup.has(withoutLeadingNumber)) {
      lookup.set(withoutLeadingNumber, item);
    }
  });

  return lookup;
}

function getBatchSeparatorIndex(name: string): number {
  return ["-", "_", "－", "—"].reduce((max, separator) => Math.max(max, name.lastIndexOf(separator)), -1);
}

function createBatchUploadItem(file: File, actionTypes: TypeOption[]): BatchUploadItem {
  const rawName = file.name.replace(/\.[^.]+$/, "");
  const separatorIndex = getBatchSeparatorIndex(rawName);

  if (separatorIndex <= 0 || separatorIndex >= rawName.length - 1) {
    return {
      id: uid("batch"),
      file,
      fileName: file.name,
      actionName: "",
      rawTypeName: "",
      resolvedTypeId: null,
      resolvedTypeName: "",
      needsCreateType: false,
      status: "invalid",
      message: "文件名需按“动作-类型”命名，例如：划船-hyrox.mp4"
    };
  }

  const actionName = rawName.slice(0, separatorIndex).trim();
  const rawTypeName = rawName.slice(separatorIndex + 1).trim();

  if (!actionName || !rawTypeName) {
    return {
      id: uid("batch"),
      file,
      fileName: file.name,
      actionName,
      rawTypeName,
      resolvedTypeId: null,
      resolvedTypeName: "",
      needsCreateType: false,
      status: "invalid",
      message: "动作名和类型都不能为空。"
    };
  }

  const typeLookup = buildActionTypeLookup(actionTypes);
  const matchedType = typeLookup.get(normalizeBatchKey(rawTypeName)) || null;
  const resolvedTypeName = matchedType ? matchedType.name : formatGeneratedTypeName(rawTypeName);

  return {
    id: uid("batch"),
    file,
    fileName: file.name,
    actionName,
    rawTypeName,
    resolvedTypeId: matchedType?.id ?? null,
    resolvedTypeName,
    needsCreateType: !matchedType,
    status: "ready",
    message: matchedType ? "将自动创建动作。" : `未找到现有分类，将自动创建“${resolvedTypeName}”。`
  };
}

function findExistingActionForBatch(actions: ActionRecord[], actionName: string, typeId: number): ActionRecord | null {
  const normalizedName = normalizeBatchKey(actionName);
  return actions.find((item) => normalizeBatchKey(item.name) === normalizedName && item.typeIds.includes(typeId)) ?? null;
}

function createCourseDraft(course: CourseRecord | null = null): CourseDraft {
  return {
    id: course?.id ?? null,
    typeIds: [...(course?.typeIds ?? [])],
    logoMedia: course?.logoMedia ?? null,
    logoFile: null,
    logoPreview: course?.logoMedia?.url ?? "",
    script: normalizeCourseScriptLocal(course?.script || createEmptyCourseScript())
  };
}

function createCourseEditorTab(course: CourseRecord | null = null): CourseEditorTabState {
  return {
    tabId: uid("course-tab"),
    courseId: course?.id ?? null,
    title: course ? "编辑课程" : "添加课程",
    draft: createCourseDraft(course)
  };
}

function createTemplateCollections(): TemplateCollections {
  return {
    warmup: [],
    cooldown: [],
    training: []
  };
}

function getTemplateKindLabel(kind: TemplateKind): string {
  if (kind === "cooldown") {
    return "冷身模板";
  }
  if (kind === "training") {
    return "正式组模板";
  }
  return "热身模板";
}

function cloneWaterfallItemForEditor(item?: Partial<WaterfallItem>): WaterfallItem {
  return {
    id: uid("waterfall"),
    actionId: String(item?.actionId || ""),
    actionName: String(item?.actionName || ""),
    seconds: readNonNegativeNumber(item?.seconds, 0),
    cue: ""
  };
}

function cloneWaterfallSectionForEditor(
  section: Partial<WaterfallSection> | null | undefined,
  title: string,
  allowEmpty = false
): WaterfallSection {
  const sourceItems = Array.isArray(section?.items) ? section.items : [];
  const items = sourceItems.length ? sourceItems : allowEmpty ? [] : [createWaterfallItem()];
  return {
    id: uid("section"),
    title,
    layout: "WATERFALL",
    items: items.map((item) => cloneWaterfallItemForEditor(item))
  };
}

function cloneVideoCardForEditor(card?: Partial<VideoCard>, screenCount: VideoGroupScreenCount = 3): VideoCard {
  return {
    id: uid("video-card"),
    actionId: String(card?.actionId || ""),
    actionName: String(card?.actionName || ""),
    stationNumber: screenCount === 1 ? "" : stationInputValue(card?.stationNumber)
  };
}

function cloneVideoGroupForEditor(
  group: Partial<VideoGroup> | null | undefined,
  fallbackName = ""
): VideoGroup {
  const screenCount = group?.screenCount === 1 ? 1 : 3;
  const sourceScreens = Array.isArray(group?.screens) ? group.screens : [];

  return {
    id: uid("video-group"),
    name: String(group?.name || fallbackName || (screenCount === 1 ? "单屏瀑布组" : "三屏视频组")),
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) => {
      const screenIndex = index + 1;
      const sourceScreen = sourceScreens.find((item) => item.screenIndex === screenIndex);
      const sourceCards =
        Array.isArray(sourceScreen?.videoCards) && sourceScreen.videoCards.length
          ? sourceScreen.videoCards
          : [createVideoCard()];

      return {
        id: uid("video-group-screen"),
        screenIndex,
        stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
        layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
        videoCards: sourceCards.map((card) => cloneVideoCardForEditor(card, screenCount))
      };
    })
  };
}

function createTemplateDraft(template: TemplateRecord | null = null, kind: TemplateKind = "warmup"): TemplateDraft {
  const resolvedKind = template?.kind || kind;
  if (resolvedKind === "training") {
    const trainingTemplate = template as TrainingTemplateRecord | null;
    return {
      id: trainingTemplate?.id ?? null,
      kind: "training",
      name: trainingTemplate?.name ?? "",
      section: null,
      videoGroup: cloneVideoGroupForEditor(trainingTemplate?.videoGroup, trainingTemplate?.name ?? "正式组模板")
    };
  }

  const waterfallTemplate = template as WaterfallTemplateRecord | null;
  const title = resolvedKind === "cooldown" ? "冷身" : "热身";
  return {
    id: waterfallTemplate?.id ?? null,
    kind: resolvedKind,
    name: waterfallTemplate?.name ?? "",
    section: cloneWaterfallSectionForEditor(waterfallTemplate?.section, title),
    videoGroup: null
  };
}

function getWaterfallSectionTotal(section: WaterfallSection | null | undefined): number {
  return (section?.items || []).reduce((total, item) => total + Number(item.seconds || 0), 0);
}

function getVideoGroupCardCount(group: VideoGroup | null | undefined): number {
  return (group?.screens || []).reduce((total, screen) => total + screen.videoCards.length, 0);
}

function formatTemplateSummary(template: TemplateRecord): string {
  if (template.kind === "training") {
    return `${template.videoGroup.screenCount === 1 ? "单屏瀑布" : "三屏站点"} · ${getVideoGroupCardCount(template.videoGroup)} 个动作位`;
  }

  return `${template.section.items.length} 个动作 · ${formatSecondsLabel(getWaterfallSectionTotal(template.section))}`;
}

function isDefaultVideoGroupName(name: string, screenCount: VideoGroupScreenCount): boolean {
  const trimmed = String(name || "").trim();
  return trimmed === "" || trimmed === (screenCount === 1 ? "单屏瀑布组" : "三屏视频组");
}

function hasEditedVideoGroup(group: VideoGroup | null | undefined): boolean {
  if (!group) {
    return false;
  }

  if (!isDefaultVideoGroupName(group.name, group.screenCount)) {
    return true;
  }

  return group.screens.some((screen) => {
    if (screen.videoCards.length > 1) {
      return true;
    }

    return screen.videoCards.some((card) => {
      if (group.screenCount !== 1 && stationCode(card.stationNumber)) {
        return true;
      }

      return Boolean(String(card.actionId || "").trim() || String(card.actionName || "").trim());
    });
  });
}

function createScheduleDraft(courses: CourseRecord[], preferredDate = ""): ScheduleDraft {
  const first = [...courses].sort((left, right) => {
    if (left.name === right.name) {
      return left.version.localeCompare(right.version);
    }
    return left.name.localeCompare(right.name);
  })[0];

  return {
    courseName: first?.name ?? "",
    courseId: first ? String(first.id) : "",
    version: first?.version ?? "",
    date: preferredDate || todayValue(),
    time: "19:00",
    duration: "45"
  };
}

function groupCoursesByName(courses: CourseRecord[]): CourseGroups {
  return courses.reduce((groups, course) => {
    const key = course.name;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(course);
    groups[key].sort((left, right) => right.version.localeCompare(left.version));
    return groups;
  }, {} as CourseGroups);
}

function getWeekDays(offsetWeeks: number): CalendarDay[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta + offsetWeeks * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
      current.getDate()
    ).padStart(2, "0")}`;

    return {
      key: dateKey,
      title: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
      subtitle: `${current.getMonth() + 1}.${current.getDate()}`
    };
  });
}

function getTimeSlots(): Array<{ hour: number; label: string }> {
  return Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => {
    const hour = CALENDAR_START_HOUR + index;
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`
    };
  });
}

function getSchedulePlacement(schedule: ScheduleRecord): { top: number; height: number } {
  const date = new Date(schedule.beginTime);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const top = ((minutes - CALENDAR_START_HOUR * 60) / 60) * CALENDAR_HOUR_HEIGHT;
  const height = Math.max((Number(schedule.duration || 0) / 60) * CALENDAR_HOUR_HEIGHT, 54);

  return {
    top: Math.max(top, 0),
    height
  };
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDate(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function matchesTypeFilter(sourceIds: number[], selectedIds: number[]): boolean {
  return selectedIds.length === 0 || selectedIds.some((id) => sourceIds.includes(id));
}

function withCacheToken(url: string, token?: string | number | null): string {
  if (!url) {
    return "";
  }

  if (!token) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(token))}`;
}

function readStorageJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveStorageJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageItem(key: string): void {
  window.localStorage.removeItem(key);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误，请稍后再试。";
}

function triggerFileInput(inputId: string): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  input?.click();
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message || `请求失败 (${response.status})`;
    const shouldExpire =
      (response.status === 401 || response.status === 403) &&
      (String(message || "").includes("登录已失效") || String(message || "").includes("refresh token 已失效"));
    if (shouldExpire) {
      try {
        window.dispatchEvent(new CustomEvent("infini-auth-expired", { detail: { message } }));
      } catch {
        // Ignore dispatch failures.
      }
    }
    throw new Error(message);
  }

  return payload as T;
}

async function uploadBinary(kind: "image" | "video", file: File): Promise<MediaRecord> {
  const endpoint = kind === "image" ? "/api/upload/image" : "/api/upload/video";
  const response = await fetch(`${endpoint}?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });
  const payload = (await response.json().catch(() => null)) as { data?: MediaRecord; message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message || "上传失败");
  }

  return payload?.data as MediaRecord;
}

function pageTabs(
  baseLabel: string,
  editingLabel: string,
  isEditing: boolean,
  onBack: () => void,
  onClose: () => void
) {
  return (
    <div className="inner-tabs">
      <button className={`inner-tab ${!isEditing ? "is-active" : ""}`} type="button" onClick={onBack}>
        {baseLabel}
      </button>
      {isEditing ? (
        <button className="inner-tab is-active is-closable" type="button" onClick={onClose}>
          {editingLabel}
          <span className="inner-tab-close-mark">×</span>
        </button>
      ) : null}
    </div>
  );
}

function Dialog({
  title,
  width = 560,
  onClose,
  onConfirm,
  confirmText = "确认",
  confirmDisabled = false,
  children
}: DialogProps) {
  return (
    <div className="dialog-mask">
      <div className="dialog-card" style={{ width }}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button type="button" className="dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-foot">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChips({ options, selectedIds, onToggle, onAdd }: FilterChipsProps) {
  return (
    <div className="chip-row">
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`filter-chip ${selectedIds.includes(item.id) ? "is-active" : ""}`}
          onClick={() => onToggle(item.id)}
        >
          {item.name}
        </button>
      ))}
      {onAdd ? (
        <button type="button" className="filter-chip is-add" onClick={onAdd}>
          + 添加
        </button>
      ) : null}
    </div>
  );
}

function EmptyBlock({ title, copy }: EmptyBlockProps) {
  return (
    <div className="empty-block">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function getVideoPreviewCaptureTime(video: HTMLVideoElement) {
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0.08;
  }

  return Math.min(0.12, Math.max(duration * 0.02, 0.04), Math.max(duration - 0.01, 0));
}

function FirstFrameVideo({
  src,
  className
}: {
  src: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureStateRef = useRef<"idle" | "seeking" | "done">("idle");
  const [posterUrl, setPosterUrl] = useState("");

  useEffect(() => {
    setPosterUrl("");
    captureStateRef.current = "idle";
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      return;
    }

    let cancelled = false;

    const finalize = () => {
      if (cancelled) {
        return;
      }

      captureStateRef.current = "done";
      video.pause();
    };

    const capturePoster = () => {
      if (captureStateRef.current === "done") {
        return;
      }

      try {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");

          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const nextPosterUrl = canvas.toDataURL("image/jpeg", 0.86);
            if (!cancelled) {
              setPosterUrl(nextPosterUrl);
            }
          }
        }
      } catch {
        // Direct OSS links may not always allow canvas export. In that case we still
        // keep the preview parked on the first visible frame instead of a black panel.
      }

      finalize();
    };

    const handleLoadedData = () => {
      const nextTime = getVideoPreviewCaptureTime(video);
      if (captureStateRef.current === "idle" && nextTime > 0 && Math.abs(video.currentTime - nextTime) > 0.01) {
        captureStateRef.current = "seeking";
        try {
          video.currentTime = nextTime;
          return;
        } catch {
          // Ignore seek failures and fall through to direct capture.
        }
      }

      capturePoster();
    };

    const handleSeeked = () => {
      if (captureStateRef.current === "seeking") {
        capturePoster();
      }
    };

    const handleError = () => {
      finalize();
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
  }, [src]);

  return (
    <video
      key={src}
      ref={videoRef}
      className={className}
      src={src}
      poster={posterUrl || undefined}
      controls
      playsInline
      preload="auto"
      onPlay={() => {
        const video = videoRef.current;
        if (!video) {
          return;
        }

        if (video.currentTime > 0 && video.currentTime < 0.2) {
          video.currentTime = 0;
        }
      }}
    />
  );
}

function ActionMediaPreview({
  actionId,
  actions,
  emptyCopy = "请选择动作查看视频"
}: {
  actionId: string;
  actions: ActionRecord[];
  emptyCopy?: string;
}) {
  const action = findActionRecord(actions, actionId);
  const mediaUrl = action?.media?.url ? withCacheToken(action.media.url, action.updateTime) : "";

  return (
    <div className="action-media-preview">
      <div className="action-media-preview-frame">
        {mediaUrl ? (
          <FirstFrameVideo src={mediaUrl} />
        ) : (
          <div className="action-media-preview-empty">{action ? "该动作暂无视频" : emptyCopy}</div>
        )}
      </div>
      <div className="action-media-preview-copy">
        <strong>{action?.name || "未选择动作"}</strong>
        <span>{action ? "已选动作视频预览，可直接播放确认" : "选中动作后可直接预览视频"}</span>
      </div>
    </div>
  );
}

function CalendarBoard({ weekDays, schedules, onDelete }: CalendarBoardProps) {
  const timeSlots = getTimeSlots();

  return (
    <div className="calendar-board-wrap" style={{ "--calendar-columns": weekDays.length } as CSSProperties}>
      <div className="calendar-head">
        <div className="calendar-time-corner" />
        <div className="calendar-day-heads">
          {weekDays.map((day) => (
            <div key={day.key} className="calendar-day-head">
              <strong>{day.title}</strong>
              <span>{day.subtitle}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-time-column">
          {timeSlots.map((slot) => (
            <div key={slot.hour} className="calendar-time-cell">
              <span>{slot.label}</span>
            </div>
          ))}
        </div>

        <div className="calendar-day-columns">
          {weekDays.map((day, dayIndex) => {
            const daySchedules = schedules.filter((item) => item.beginTime.slice(0, 10) === day.key);

            return (
              <div key={day.key} className="calendar-day-column">
                {timeSlots.map((slot) => (
                  <div key={`${day.key}-${slot.hour}`} className="calendar-hour-line" />
                ))}

                {daySchedules.map((item, itemIndex) => {
                  const placement = getSchedulePlacement(item);

                  return (
                    <article
                      key={item.id}
                      className={`calendar-event tone-${(dayIndex + itemIndex) % 6}`}
                      style={{
                        top: `${placement.top}px`,
                        height: `${placement.height}px`
                      }}
                    >
                      <div className="calendar-event-top">
                        <span className="calendar-event-time">
                          {formatTime(item.beginTime)} - {formatTime(
                            new Date(new Date(item.beginTime).getTime() + Number(item.duration || 0) * 60000)
                          )}
                        </span>
                        <button type="button" className="calendar-event-delete" onClick={() => onDelete(item.id)}>
                          删除
                        </button>
                      </div>
                      <strong>{item.courseName}</strong>
                      <p>版本 {item.version || "--"}</p>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {!schedules.length ? (
        <div className="calendar-empty-state">当前周还没有排课，点击右上角“添加课程”开始创建。</div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [appData, setAppData] = useState<MetaPayload | null>(null);
  const [busyText, setBusyText] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    username: "",
    password: ""
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<NavKey>("home");
  const [homeTab, setHomeTab] = useState<HomeTabKey>("currentWeek");
  const [actionFiltersDraft, setActionFiltersDraft] = useState<FilterState>({ search: "", typeIds: [] });
  const [actionFilters, setActionFilters] = useState<FilterState>({ search: "", typeIds: [] });
  const [courseFiltersDraft, setCourseFiltersDraft] = useState<CourseFilterState>({
    name: "",
    creator: "",
    version: "",
    typeIds: []
  });
  const [courseFilters, setCourseFilters] = useState<CourseFilterState>({
    name: "",
    creator: "",
    version: "",
    typeIds: []
  });
  const [actionEditor, setActionEditor] = useState<ActionDraft | null>(null);
  const [actionBatchGuideOpen, setActionBatchGuideOpen] = useState(false);
  const [actionBatchDialog, setActionBatchDialog] = useState<BatchUploadDialogState | null>(null);
  const [courseEditorTabs, setCourseEditorTabsState] = useState<CourseEditorTabState[]>([]);
  const [activeCourseTabId, setActiveCourseTabId] = useState<string>("all-courses");
  const [templateTab, setTemplateTab] = useState<TemplateKind>("warmup");
  const [templateEditor, setTemplateEditor] = useState<TemplateDraft | null>(null);
  const [templateUseDialog, setTemplateUseDialog] = useState<TemplateUseDialogState | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null);
  const [typeDialog, setTypeDialog] = useState<TypeDialogState | null>(null);
  const [podRuleDialog, setPodRuleDialog] = useState<PodRuleDialogState | null>(null);
  const [podCopyDialog, setPodCopyDialog] = useState<PodCopyDialogState | null>(null);
  const [podConfigCopyDialog, setPodConfigCopyDialog] = useState<PodConfigCopyDialogState | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>("all");
  const activeCourseEditorTab = courseEditorTabs.find((tab) => tab.tabId === activeCourseTabId) ?? null;
  const courseEditor = activeCourseEditorTab?.draft ?? null;
  const templateCollections = appData?.templates || createTemplateCollections();
  const activeTemplateList = templateCollections[templateTab];
  const hasRecoverableDraft =
    Boolean(actionEditor) ||
    actionBatchGuideOpen ||
    Boolean(actionBatchDialog) ||
    courseEditorTabs.length > 0 ||
    Boolean(templateEditor) ||
    Boolean(templateUseDialog) ||
    Boolean(scheduleDraft) ||
    Boolean(typeDialog) ||
    Boolean(podRuleDialog) ||
    Boolean(podCopyDialog) ||
    Boolean(podConfigCopyDialog);

  useEffect(() => {
    const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
    if (storedAuth?.access_token) {
      setAuthSession(storedAuth);
      setLoginForm((current) => ({
        ...current,
        username: storedAuth.username || current.username
      }));
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (authSession) {
      saveStorageJson(AUTH_STORAGE_KEY, authSession);
      return;
    }

    removeStorageItem(AUTH_STORAGE_KEY);
  }, [authReady, authSession]);

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const message = String(detail?.message || "");
      if (!message.includes("登录已失效") && !message.includes("refresh token 已失效")) {
        return;
      }
      forceLogout("登录已过期，请重新登录。", "error");
    }

    window.addEventListener("infini-auth-expired", handleAuthExpired as EventListener);
    return () => window.removeEventListener("infini-auth-expired", handleAuthExpired as EventListener);
  }, []);

  useEffect(() => {
    if (!authReady || !authSession) {
      return;
    }

    (async () => {
      try {
        await loadMeta("正在加载页面...");
      } catch {
        // loadMeta handles notice already.
      }
    })();
  }, [authReady, authSession?.access_token]);

  useEffect(() => {
    if (!hasRecoverableDraft) {
      return undefined;
    }

    const message = "当前页面有未保存操作，刷新后会丢失。";

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;
      return message;
    }

    window.onbeforeunload = handleBeforeUnload;
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.onbeforeunload = null;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasRecoverableDraft]);

  useEffect(() => {
    if (!hasRecoverableDraft) {
      return undefined;
    }

    function handleReloadShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isRefreshShortcut = key === "f5" || ((event.metaKey || event.ctrlKey) && key === "r");

      if (!isRefreshShortcut) {
        return;
      }

      if (!window.confirm("当前页面有未保存操作，刷新后会丢失。是否继续刷新？")) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleReloadShortcut);
    return () => {
      window.removeEventListener("keydown", handleReloadShortcut);
    };
  }, [hasRecoverableDraft]);

  function setCourseEditor(nextValue: CourseDraft | ((current: CourseDraft) => CourseDraft) | null) {
    if (activeCourseTabId === "all-courses") {
      return;
    }

    if (nextValue === null) {
      setActiveCourseTabId("all-courses");
      return;
    }

    setCourseEditorTabsState((current) =>
      current.map((tab) =>
        tab.tabId === activeCourseTabId
          ? {
              ...tab,
              draft: typeof nextValue === "function" ? nextValue(tab.draft) : nextValue
            }
          : tab
      )
    );
  }

  function updateCourseScript(updater: (current: CourseScript) => CourseScript) {
    setCourseEditor((current) => ({
      ...current,
      script: normalizeCourseScriptLocal(updater(current.script))
    }));
  }

  function pushNotice(message: string, tone: NoticeState["tone"] = "success") {
    const next = { id: Date.now(), message, tone };
    setNotice(next);
    window.setTimeout(() => {
      setNotice((current) => (current?.id === next.id ? null : current));
    }, 3200);
  }

  function updateActionEditor(updater: (current: ActionDraft) => ActionDraft) {
    setActionEditor((current) => (current ? updater(current) : current));
  }

  function updateTemplateEditor(updater: (current: TemplateDraft) => TemplateDraft) {
    setTemplateEditor((current) => (current ? updater(current) : current));
  }

  function updateScheduleDraft(updater: (current: ScheduleDraft) => ScheduleDraft) {
    setScheduleDraft((current) => (current ? updater(current) : current));
  }

  function updateTypeDialog(updater: (current: TypeDialogState) => TypeDialogState) {
    setTypeDialog((current) => (current ? updater(current) : current));
  }

  function updatePodRuleDialog(updater: (current: PodRuleDialogState) => PodRuleDialogState) {
    setPodRuleDialog((current) => (current ? updater(current) : current));
  }

  function resetEditorState() {
    setActivePage("home");
    setHomeTab("currentWeek");
    setActionFiltersDraft({ search: "", typeIds: [] });
    setActionFilters({ search: "", typeIds: [] });
    setCourseFiltersDraft({ name: "", creator: "", version: "", typeIds: [] });
    setCourseFilters({ name: "", creator: "", version: "", typeIds: [] });
    setActionEditor(null);
    setActionBatchDialog(null);
    setCourseEditorTabsState([]);
    setActiveCourseTabId("all-courses");
    setTemplateTab("warmup");
    setTemplateEditor(null);
    setTemplateUseDialog(null);
    setScheduleDraft(null);
    setTypeDialog(null);
    setPodRuleDialog(null);
    setPodCopyDialog(null);
    setPodConfigCopyDialog(null);
    setSelectedScheduleDate("all");
  }

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      pushNotice("请输入账号和密码。", "error");
      return;
    }

    setBusyText("正在登录...");

    try {
      const loginResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/login", {
        method: "POST",
        headers: {
          Authorization: LEGACY_BASIC_AUTH
        },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password.trim(),
          grant_type: "password",
          client: "editor-web"
        })
      });

      const profileResponse = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
        headers: {
          Authorization: `${loginResponse.data.token_type} ${loginResponse.data.access_token}`
        }
      });

      const nextAuth = {
        ...loginResponse.data,
        ...profileResponse.data
      };

      setAuthSession(nextAuth);
      setLoginForm((current) => ({
        ...current,
        username: nextAuth.username,
        password: ""
      }));
      pushNotice("登录成功。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  function handleLogout() {
    forceLogout("已退出登录。");
  }

  function forceLogout(message?: string, tone: "success" | "error" = "success") {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setAppData(null);
    resetEditorState();
    setLoginForm({ username: "", password: "" });
    if (message) {
      pushNotice(message, tone);
    }
  }

  async function loadMeta(label = ""): Promise<void> {
    if (label) {
      setBusyText(label);
    }

    try {
      const payload = await requestJson<MetaPayload>("/api/meta");
      setAppData(payload);
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  const actionTypeMap = new Map((appData?.actionTypes || []).map((item) => [item.id, item.name]));
  const lessonTypeMap = new Map((appData?.lessonTypes || []).map((item) => [item.id, item.name]));
  const courseGroups = groupCoursesByName(appData?.courses || []);

  const filteredActions = (appData?.actions || []).filter((action) => {
    const nameMatches = !actionFilters.search || action.name.toLowerCase().includes(actionFilters.search.toLowerCase());
    return nameMatches && matchesTypeFilter(action.typeIds || [], actionFilters.typeIds);
  });

  const filteredCourses = (appData?.courses || []).filter((course) => {
    const nameMatches = !courseFilters.name || course.name.toLowerCase().includes(courseFilters.name.toLowerCase());
    const creatorMatches =
      !courseFilters.creator || course.creator.toLowerCase().includes(courseFilters.creator.toLowerCase());
    const versionMatches =
      !courseFilters.version || course.version.toLowerCase().includes(courseFilters.version.toLowerCase());

    return (
      nameMatches &&
      creatorMatches &&
      versionMatches &&
      matchesTypeFilter(course.typeIds || [], courseFilters.typeIds)
    );
  });

  const weekDays = getWeekDays(homeTab === "lastWeek" ? -1 : 0);
  const weekDayKeysSignature = weekDays.map((day) => day.key).join("|");
  const schedules = appData?.schedules || { currentWeek: [], lastWeek: [], history: [] };
  const visibleSchedules =
    homeTab === "currentWeek"
      ? schedules.currentWeek
      : homeTab === "lastWeek"
        ? schedules.lastWeek
        : schedules.history;

  useEffect(() => {
    if (selectedScheduleDate !== "all" && !weekDays.some((day) => day.key === selectedScheduleDate)) {
      setSelectedScheduleDate("all");
    }
  }, [selectedScheduleDate, weekDayKeysSignature]);

  function openActionEditor(action: ActionRecord | null = null) {
    setActionEditor(createActionDraft(action));
    setActivePage("actions");
  }

  function openBatchUploadDialog(files: FileList | null) {
    const pickedFiles = Array.from(files || []);
    if (!pickedFiles.length) {
      return;
    }

    const items = pickedFiles.map((file) => createBatchUploadItem(file, appData?.actionTypes || []));
    setActionBatchDialog({ items });
    setActivePage("actions");
  }

  function openBatchUploadGuide() {
    setActionBatchGuideOpen(true);
    setActivePage("actions");
  }

  function confirmBatchUploadGuide() {
    setActionBatchGuideOpen(false);
    triggerFileInput("action-batch-upload");
  }

  function openCourseEditor(course: CourseRecord | null = null) {
    setActivePage("courses");

    if (course?.id) {
      const existingTab = courseEditorTabs.find((tab) => tab.courseId === course.id);
      if (existingTab) {
        setActiveCourseTabId(existingTab.tabId);
        return;
      }
    }

    const nextTab = createCourseEditorTab(course);
    setCourseEditorTabsState((current) => [...current, nextTab]);
    setActiveCourseTabId(nextTab.tabId);
  }

  function openTemplateEditor(template: TemplateRecord | null = null, kind: TemplateKind = templateTab) {
    const nextKind = template?.kind || kind;
    setTemplateTab(nextKind);
    setTemplateEditor(createTemplateDraft(template, nextKind));
    setActivePage("templates");
  }

  async function saveTemplate() {
    if (!templateEditor) {
      return;
    }

    if (!templateEditor.name.trim()) {
      pushNotice("模板名称不能为空。", "error");
      return;
    }

    setBusyText("正在保存模板...");

    try {
      const payload =
        templateEditor.kind === "training"
          ? {
              kind: "training",
              name: templateEditor.name.trim(),
              videoGroup: templateEditor.videoGroup
                ? {
                    ...templateEditor.videoGroup,
                    name: templateEditor.name.trim()
                  }
                : null
            }
          : {
              kind: templateEditor.kind,
              name: templateEditor.name.trim(),
              section: templateEditor.section
            };

      if (templateEditor.id) {
        await requestJson<ApiResponse<TemplateRecord>>(`/api/templates/${templateEditor.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson<ApiResponse<TemplateRecord>>("/api/templates", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      await loadMeta();
      setTemplateEditor(null);
      pushNotice("模板已保存。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function removeTemplate(template: TemplateRecord) {
    if (!window.confirm(`确认删除模板“${template.name}”吗？`)) {
      return;
    }

    setBusyText("正在删除模板...");

    try {
      await requestJson(`/api/templates/${template.id}`, { method: "DELETE" });
      await loadMeta();
      if (templateEditor?.id === template.id) {
        setTemplateEditor(null);
      }
      pushNotice("模板已删除。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  function openTemplateUseDialog(target: TemplateKind, targetVideoGroup?: VideoGroup | null) {
    if (!(templateCollections[target] || []).length) {
      pushNotice(`还没有可用的${getTemplateKindLabel(target)}。`, "error");
      return;
    }

    if (target === "training" && !targetVideoGroup) {
      pushNotice("请先选择要套用模版的视频组。", "error");
      return;
    }

    setTemplateUseDialog({
      target,
      selectedTemplateId: String((templateCollections[target] || [])[0]?.id ?? ""),
      targetVideoGroupId: targetVideoGroup?.id,
      targetVideoGroupName: targetVideoGroup?.name || undefined
    });
  }

  function applyTemplateToCourse() {
    if (!courseEditor || !templateUseDialog?.selectedTemplateId) {
      return;
    }

    const templates = templateCollections[templateUseDialog.target] || [];
    const selectedTemplate = templates.find(
      (template) => String(template.id) === String(templateUseDialog.selectedTemplateId)
    );

    if (!selectedTemplate) {
      pushNotice("请选择要使用的模版。", "error");
      return;
    }

    if (templateUseDialog.target === "training") {
      const trainingTemplate = selectedTemplate as TrainingTemplateRecord;
      if (!templateUseDialog.targetVideoGroupId) {
        pushNotice("没有找到要覆盖的视频组。", "error");
        return;
      }

      const targetGroup = courseEditor.script.training.videoGroups.find(
        (group) => group.id === templateUseDialog.targetVideoGroupId
      );

      if (!targetGroup) {
        pushNotice("当前视频组不存在。", "error");
        return;
      }

      if (
        hasEditedVideoGroup(targetGroup) &&
        !window.confirm(`使用模版会覆盖当前视频组“${templateUseDialog.targetVideoGroupName || targetGroup.name || "视频组"}”的内容，是否继续？`)
      ) {
        return;
      }

      updateCourseScript((current) => ({
        ...syncPodsForVideoGroup(current, {
          ...cloneVideoGroupForEditor(trainingTemplate.videoGroup, trainingTemplate.name),
          id: templateUseDialog.targetVideoGroupId
        })
      }));
      pushNotice(`已用模版“${trainingTemplate.name}”覆盖当前视频组。`);
    } else {
      const waterfallTemplate = selectedTemplate as WaterfallTemplateRecord;
      const sectionTitle = templateUseDialog.target === "cooldown" ? "冷身" : "热身";
      updateCourseScript((current) => ({
        ...current,
        sections: {
          ...current.sections,
          [templateUseDialog.target]: cloneWaterfallSectionForEditor(waterfallTemplate.section, sectionTitle)
        }
      }));
      pushNotice(`已应用${sectionTitle}模版“${waterfallTemplate.name}”。`);
    }

    setTemplateUseDialog(null);
  }

  function closeCourseTab(tabId: string) {
    const currentIndex = courseEditorTabs.findIndex((tab) => tab.tabId === tabId);
    const nextTabs = courseEditorTabs.filter((tab) => tab.tabId !== tabId);
    setCourseEditorTabsState(nextTabs);
    setPodRuleDialog(null);
    setPodCopyDialog(null);
    setPodConfigCopyDialog(null);

    if (activeCourseTabId === tabId) {
      const fallbackTab = nextTabs[currentIndex - 1] || nextTabs[currentIndex] || null;
      setActiveCourseTabId(fallbackTab ? fallbackTab.tabId : "all-courses");
    }
  }

  function openPodRuleDialog(pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) {
    setPodRuleDialog(createPodRuleDialogState(pod, screen, screenLabel, isSingleScreen));
  }

  function openPodCopyDialog(pod: Pod, screen: PodScreen, screenLabel: string) {
    const firstAvailableSource = pod.screens.find((candidate) => candidate.id !== screen.id && candidate.isCustomized);
    setPodCopyDialog({
      podId: pod.id,
      podName: pod.name || "Pod",
      targetScreenId: screen.id,
      targetScreenIndex: screen.screenIndex,
      targetScreenLabel: screenLabel,
      selectedSourceScreenId: firstAvailableSource?.id || ""
    });
  }

  function openPodConfigCopyDialog(pod: Pod, podLabel: string) {
    const pods = courseEditor?.script.training.pods || [];
    const firstAvailableSource = pods.find((candidate) => candidate.id !== pod.id && podHasCustomizedRules(candidate));
    setPodConfigCopyDialog({
      targetPodId: pod.id,
      targetPodName: podLabel || pod.name || "Pod",
      selectedSourcePodId: firstAvailableSource?.id || ""
    });
  }

  function confirmPodRuleDialog() {
    if (!podRuleDialog) {
      return;
    }

    const nextSetCount = podRuleDialog.isSingleScreen
      ? 1
      : parsePositiveIntInput(podRuleDialog.setCount, podRuleDialog.setConfigs.length || 1);
    const nextSetDrafts = resizePodRuleSetDrafts(podRuleDialog.setConfigs, nextSetCount);
    const nextSetConfigs = nextSetDrafts.map((setConfig, setIndex) =>
      createPodSetConfig({
        id: setConfig.id,
        workSeconds: parseNonNegativeIntInput(setConfig.workSeconds, 0),
        restSeconds: setIndex === nextSetCount - 1 ? 0 : parseNonNegativeIntInput(setConfig.restSeconds, 0)
      })
    );
    const nextScreen: PodScreen = {
      id: podRuleDialog.screenId,
      screenIndex: podRuleDialog.screenIndex,
      loopCount: parsePositiveIntInput(podRuleDialog.loopCount, 1),
      stationRestSeconds: parseNonNegativeIntInput(podRuleDialog.stationRestSeconds, 0),
      setConfigs: nextSetConfigs,
      isCustomized: true
    };

    updateCourseScript((current) => ({
      ...current,
      training: {
        ...current.training,
        pods: current.training.pods.map((pod) =>
          pod.id === podRuleDialog.podId
            ? {
                ...pod,
                screens: pod.screens.map((screen) => (screen.id === podRuleDialog.screenId ? nextScreen : screen))
              }
            : pod
        )
      }
    }));
    setPodRuleDialog(null);
  }

  function confirmPodCopyDialog() {
    if (!podCopyDialog?.selectedSourceScreenId) {
      return;
    }

    updateCourseScript((current) => ({
      ...current,
      training: {
        ...current.training,
        pods: current.training.pods.map((pod) => {
          if (pod.id !== podCopyDialog.podId) {
            return pod;
          }

          const sourceScreen = pod.screens.find((screen) => screen.id === podCopyDialog.selectedSourceScreenId);
          if (!sourceScreen?.isCustomized) {
            return pod;
          }

          return {
            ...pod,
            screens: pod.screens.map((screen) =>
              screen.id === podCopyDialog.targetScreenId
                ? {
                    ...cloneDeep(sourceScreen),
                    id: podCopyDialog.targetScreenId,
                    screenIndex: podCopyDialog.targetScreenIndex,
                    isCustomized: true
                  }
                : screen
            )
          };
        })
      }
    }));
    setPodCopyDialog(null);
  }

  function confirmPodConfigCopyDialog() {
    if (!podConfigCopyDialog?.selectedSourcePodId) {
      return;
    }

    updateCourseScript((current) => {
      const sourcePod = current.training.pods.find((pod) => pod.id === podConfigCopyDialog.selectedSourcePodId) || null;
      if (!sourcePod) {
        return current;
      }

      return {
        ...current,
        training: {
          ...current.training,
          pods: current.training.pods.map((pod) => {
            if (pod.id !== podConfigCopyDialog.targetPodId) {
              return pod;
            }

            const linkedGroup = current.training.videoGroups.find((group) => group.id === pod.videoGroupId) || null;
            const targetIsSingleScreen = linkedGroup?.screenCount === 1;
            const sourceIsSingleScreen = sourcePod.screens.length === 1;

            const resolveSourceForTarget = (screenIndex: number) => {
              if (sourceIsSingleScreen) {
                return sourcePod.screens[0] || null;
              }
              return (
                sourcePod.screens.find((screen) => screen.screenIndex === screenIndex)
                || sourcePod.screens[0]
                || null
              );
            };

            return {
              ...pod,
              ending: sourcePod.ending,
              screens: pod.screens.map((screen) => {
                const sourceScreen = resolveSourceForTarget(screen.screenIndex);
                if (!sourceScreen) {
                  return screen;
                }

                const linkedScreen =
                  linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
                const isSingleScreenRule = targetIsSingleScreen || linkedScreen?.layout === "WATERFALL";

                return {
                  ...screen,
                  loopCount: sourceScreen.loopCount,
                  stationRestSeconds: sourceScreen.stationRestSeconds,
                  setConfigs: normalizePodSetConfigsForLayout(sourceScreen.setConfigs, isSingleScreenRule, 1),
                  isCustomized: true
                };
              })
            };
          })
        }
      };
    });

    setPodConfigCopyDialog(null);
    pushNotice("Pod 配置已复制。");
  }

  function openScheduleDialog() {
    if (!(appData?.courses || []).length) {
      pushNotice("请先在课程页创建课程。", "error");
      return;
    }
    setScheduleDraft(
      createScheduleDraft(appData?.courses || [], selectedScheduleDate !== "all" ? selectedScheduleDate : "")
    );
  }

  async function saveAction() {
    if (!actionEditor?.name.trim()) {
      pushNotice("动作名称不能为空。", "error");
      return;
    }

    setBusyText("正在保存动作...");

    try {
      let media = actionEditor.media;
      if (actionEditor.uploadFile) {
        media = await uploadBinary("video", actionEditor.uploadFile);
      }

      const payload = {
        name: actionEditor.name.trim(),
        typeIds: actionEditor.typeIds,
        media
      };

      if (actionEditor.id) {
        await requestJson<ApiResponse<ActionRecord>>(`/api/actions/${actionEditor.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson<ApiResponse<ActionRecord>>("/api/actions", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      await loadMeta();
      setActionEditor(null);
      pushNotice("动作已保存。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function saveBatchActions() {
    const batchItems = actionBatchDialog?.items || [];
    const validItems = batchItems.filter((item) => item.status === "ready");

    if (!validItems.length) {
      pushNotice("没有可上传的文件，请检查命名是否符合“动作-类型”。", "error");
      return;
    }

    const workingTypes = [...(appData?.actionTypes || [])];
    const workingActions = [...(appData?.actions || [])];
    const typeLookup = buildActionTypeLookup(workingTypes);
    const createdTypeCache = new Map<string, TypeOption>();
    let createdCount = 0;
    let updatedCount = 0;
    let createdTypeCount = 0;
    const failures: string[] = [];

    setBusyText(`正在批量上传 1/${validItems.length}...`);

    for (const [index, item] of validItems.entries()) {
      setBusyText(`正在批量上传 ${index + 1}/${validItems.length}：${item.fileName}`);

      try {
        const typeKey = normalizeBatchKey(item.rawTypeName);
        let typeOption = typeLookup.get(typeKey) || createdTypeCache.get(typeKey) || null;

        if (!typeOption) {
          const created = await requestJson<ApiResponse<TypeOption>>("/api/action-types", {
            method: "POST",
            body: JSON.stringify({ name: item.resolvedTypeName })
          });

          typeOption = created.data;
          workingTypes.push(typeOption);
          createdTypeCache.set(typeKey, typeOption);
          buildActionTypeLookup([typeOption]).forEach((value, key) => {
            if (!typeLookup.has(key)) {
              typeLookup.set(key, value);
            }
          });
          createdTypeCount += 1;
        }

        const media = await uploadBinary("video", item.file);
        const existing = findExistingActionForBatch(workingActions, item.actionName, typeOption.id);
        const payload = {
          name: item.actionName,
          typeIds: existing ? [...new Set([...existing.typeIds, typeOption.id])] : [typeOption.id],
          media
        };

        if (existing) {
          const response = await requestJson<ApiResponse<ActionRecord>>(`/api/actions/${existing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          const existingIndex = workingActions.findIndex((action) => action.id === existing.id);
          if (existingIndex >= 0) {
            workingActions[existingIndex] = response.data;
          }
          updatedCount += 1;
        } else {
          const response = await requestJson<ApiResponse<ActionRecord>>("/api/actions", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          workingActions.push(response.data);
          createdCount += 1;
        }
      } catch (error) {
        failures.push(`${item.fileName}：${getErrorMessage(error)}`);
      }
    }

    try {
      await loadMeta();
    } finally {
      setBusyText("");
    }

    if (createdCount || updatedCount) {
      setActionBatchDialog(null);
    }

    if (failures.length) {
      pushNotice(
        `批量上传完成：新增 ${createdCount}，更新 ${updatedCount}，新分类 ${createdTypeCount}，失败 ${failures.length}`,
        "error"
      );
      window.alert(["以下文件处理失败：", ...failures].join("\n"));
      return;
    }

    pushNotice(`批量上传完成：新增 ${createdCount}，更新 ${updatedCount}，新分类 ${createdTypeCount}`);
  }

  async function removeAction(actionId: number) {
    if (!window.confirm("确认删除这个动作吗？")) {
      return;
    }

    setBusyText("正在删除动作...");

    try {
      await requestJson(`/api/actions/${actionId}`, { method: "DELETE" });
      await loadMeta();
      pushNotice("动作已删除。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function saveCourse() {
    if (!courseEditor) {
      return;
    }

    const issues = getCourseDraftIssues(courseEditor);
    if (issues.length) {
      pushNotice(issues[0], "error");
      return;
    }

    setBusyText("正在保存课程...");

    try {
      let logoMedia = courseEditor.logoMedia;
      if (courseEditor.logoFile) {
        logoMedia = await uploadBinary("image", courseEditor.logoFile);
      }

      const script = normalizeCourseScriptLocal(cloneDeep(courseEditor.script));
      script.metadata.name = courseEditor.script.metadata.name.trim();
      script.metadata.creator = courseEditor.script.metadata.creator.trim();
      script.metadata.version = courseEditor.script.metadata.version.trim();
      script.metadata.defaultHydrateSeconds = readNonNegativeNumber(
        courseEditor.script.metadata.defaultHydrateSeconds,
        0
      );

      const payload = {
        name: script.metadata.name,
        creator: script.metadata.creator,
        version: script.metadata.version,
        typeIds: courseEditor.typeIds,
        logoMedia,
        script
      };

      let savedCourse;

      if (courseEditor.id) {
        const response = await requestJson<ApiResponse<CourseRecord>>(`/api/courses/${courseEditor.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        savedCourse = response.data;
      } else {
        const response = await requestJson<ApiResponse<CourseRecord>>("/api/courses", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        savedCourse = response.data;
      }

      setCourseEditorTabsState((current) =>
        current.map((tab) =>
          tab.tabId === activeCourseTabId
            ? {
                ...tab,
                courseId: savedCourse.id,
                title: "编辑课程",
                draft: createCourseDraft(savedCourse)
              }
            : tab
        )
      );
      await loadMeta();
      pushNotice("课程已保存。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function removeCourse(courseId: number) {
    if (!window.confirm("确认删除这个课程吗？")) {
      return;
    }

    setBusyText("正在删除课程...");

    try {
      await requestJson(`/api/courses/${courseId}`, { method: "DELETE" });
      const nextTabs = courseEditorTabs.filter((tab) => tab.courseId !== courseId);
      setCourseEditorTabsState(nextTabs);
      if (activeCourseEditorTab?.courseId === courseId) {
        setActiveCourseTabId("all-courses");
      }
      await loadMeta();
      pushNotice("课程已删除。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function saveSchedule() {
    if (!scheduleDraft?.courseId) {
      pushNotice("请选择课程。", "error");
      return;
    }
    if (!scheduleDraft.date || !scheduleDraft.time) {
      pushNotice("请选择课程日期和开始时间。", "error");
      return;
    }
    if (!scheduleDraft.duration || Number(scheduleDraft.duration) <= 0) {
      pushNotice("请输入正确的课程时长。", "error");
      return;
    }

    setBusyText("正在保存排课...");

    try {
      await requestJson("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          courseId: Number(scheduleDraft.courseId),
          version: scheduleDraft.version,
          beginTime: composeCnDateTime(scheduleDraft.date, scheduleDraft.time),
          duration: Number(scheduleDraft.duration)
        })
      });

      await loadMeta();
      setScheduleDraft(null);
      pushNotice("排课已添加。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function copyLastWeekSchedule() {
    if (schedules.currentWeek.length && !window.confirm("本周已有排课，确认用上周排课覆盖本周吗？")) {
      return;
    }

    setBusyText("正在复制上周排课...");

    try {
      await requestJson("/api/schedules/copy-last-week", {
        method: "POST"
      });
      await loadMeta();
      pushNotice("上周排课已复制到本周。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function removeSchedule(scheduleId: number) {
    if (!window.confirm("确认删除这个排课吗？")) {
      return;
    }

    setBusyText("正在删除排课...");

    try {
      await requestJson(`/api/schedules/${scheduleId}`, { method: "DELETE" });
      await loadMeta();
      pushNotice("排课已删除。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  async function confirmTypeDialog() {
    if (!typeDialog?.value.trim()) {
      pushNotice("名称不能为空。", "error");
      return;
    }

    setBusyText(typeDialog.kind === "action" ? "正在添加动作分类..." : "正在添加课程分类...");

    try {
      const payload = await requestJson<ApiResponse<TypeOption>>(
        typeDialog.kind === "action" ? "/api/action-types" : "/api/lesson-types",
        {
          method: "POST",
          body: JSON.stringify({ name: typeDialog.value.trim() })
        }
      );

      await loadMeta();
      if (typeDialog.kind === "action") {
        updateActionEditor((current) => ({
          ...current,
          typeIds: current.typeIds.includes(payload.data.id)
            ? current.typeIds
            : [...current.typeIds, payload.data.id]
        }));
      } else {
        setCourseEditor((current) => ({
          ...current,
          typeIds: current.typeIds.includes(payload.data.id)
            ? current.typeIds
            : [...current.typeIds, payload.data.id]
        }));
      }
      setTypeDialog(null);
      pushNotice("分类已添加。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
      setBusyText("");
    }
  }

  function renderLogin() {
    return (
      <div className="login-shell">
        <section className="login-stage">
          <div className="login-stage-top">
            <div className="traffic-lights">
              <span className="dot is-red" />
              <span className="dot is-yellow" />
              <span className="dot is-green" />
            </div>
            <div className="brand-wordmark">INFINI</div>
          </div>

            <div className="login-panel">
              <div className="login-panel-copy">
                <p className="workspace-kicker">Infini Admin</p>
                <h1>欢迎登录</h1>
                <p>输入账号和密码后进入后台。</p>
              </div>

              <div className="login-form old-login-form">
                <label className="login-select-field">
                  <span>账号</span>
                  <div className="login-password-row">
                    <input
                      value={loginForm.username}
                      onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder="手机号或自定义账号"
                      autoComplete="username"
                      inputMode="text"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleLogin();
                        }
                      }}
                    />
                  </div>
                </label>

              <label className="login-select-field">
                <span>密码</span>
                <div className="login-password-row">
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    inputMode="text"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />
                </div>
              </label>

              <button type="button" className="primary-button login-submit old-login-submit" onClick={handleLogin}>
                登录
              </button>
            </div>

            <div className="login-panel-foot">
              <div className="login-mark">INFINI ADMIN</div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderHome() {
    const calendarDays =
      selectedScheduleDate === "all"
        ? weekDays
        : weekDays.filter((day) => day.key === selectedScheduleDate);

    return (
      <section className="page-card">
        <div className="page-card-head">
          <div>
            <p className="page-eyebrow">Scheduling</p>
            <h1>课表</h1>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="primary-button" onClick={openScheduleDialog}>
              + 添加课程
            </button>
            <button type="button" className="ghost-button" onClick={copyLastWeekSchedule}>
              一键复制上周排课
            </button>
          </div>
        </div>

        <div className="tab-row">
          {HOME_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${homeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setHomeTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="divider" />

        <>
        {homeTab === "history" ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>课程版本</th>
                  <th>开始时间</th>
                  <th>时长</th>
                  <th>管理</th>
                </tr>
              </thead>
              <tbody>
                {visibleSchedules.length ? (
                  visibleSchedules.map((item) => (
                    <tr key={item.id}>
                      <td>{item.courseName}</td>
                      <td>{item.version}</td>
                      <td className="cell-nowrap">{formatDateTime(item.beginTime)}</td>
                      <td>{item.duration} min</td>
                      <td>
                        <button type="button" className="table-link danger" onClick={() => removeSchedule(item.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyBlock title="还没有历史排课" copy="你添加过的课程排期会展示在这里。" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="calendar-wrap">
            <div className="calendar-date-strip">
              <button
                type="button"
                className={`calendar-date-pill ${selectedScheduleDate === "all" ? "is-active" : ""}`}
                onClick={() => setSelectedScheduleDate("all")}
              >
                全部日期
              </button>
              {weekDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`calendar-date-pill ${selectedScheduleDate === day.key ? "is-active" : ""}`}
                  onClick={() => setSelectedScheduleDate(day.key)}
                >
                  <strong>{day.title}</strong>
                  <span>{day.subtitle}</span>
                </button>
              ))}
            </div>

            <CalendarBoard weekDays={calendarDays} schedules={visibleSchedules} onDelete={removeSchedule} />
          </div>
        )}
        </>
      </section>
    );
  }

  function renderActions() {
    const batchReadyCount = actionBatchDialog?.items.filter((item) => item.status === "ready").length || 0;
    const batchInvalidCount = actionBatchDialog?.items.filter((item) => item.status === "invalid").length || 0;
    const applyActionFilterSearch = () => setActionFilters(actionFiltersDraft);
    const toggleActionTypeFilter = (typeId: number) => {
      const nextTypeIds = toggleNumberId(actionFiltersDraft.typeIds, typeId);
      setActionFiltersDraft((current) => ({ ...current, typeIds: nextTypeIds }));
      setActionFilters((current) => ({ ...current, typeIds: nextTypeIds }));
    };

    return (
      <section className="page-card is-no-padding">
        {pageTabs("动作库", actionEditor?.id ? "编辑动作" : "上传动作", Boolean(actionEditor), () => setActionEditor(null), () =>
          setActionEditor(null)
        )}

        {actionEditor ? (
          <div className="editor-layout">
            <div className="editor-header">
              <h2>编辑动作</h2>
            </div>
            <div className="editor-form">
              <div className="form-row single">
                <label className="field">
                  <span>名称</span>
                  <input
                    value={actionEditor.name}
                    onChange={(event) => updateActionEditor((current) => ({ ...current, name: event.target.value }))}
                    placeholder="请输入动作名称"
                  />
                </label>
              </div>

              <div className="form-row">
                <div className="field grow">
                  <span>动作类型</span>
                  <FilterChips
                    options={appData?.actionTypes || []}
                    selectedIds={actionEditor.typeIds}
                    onToggle={(typeId) =>
                      updateActionEditor((current) => ({
                        ...current,
                        typeIds: toggleNumberId(current.typeIds, typeId)
                      }))
                    }
                    onAdd={() => setTypeDialog({ kind: "action", value: "" })}
                  />
                </div>
              </div>

              <div className="editor-divider" />

              <div className="asset-panel">
                <div className="asset-panel-head">
                  <button type="button" className="primary-button" onClick={() => triggerFileInput("action-video-upload")}>
                    + 上传动作
                  </button>
                  <input
                    id="action-video-upload"
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      updateActionEditor((current) => ({
                        ...current,
                        uploadFile: file,
                        previewUrl: URL.createObjectURL(file)
                      }));
                    }}
                  />
                </div>

                <div className="video-preview">
                  {actionEditor.previewUrl ? (
                    <FirstFrameVideo src={actionEditor.previewUrl} />
                  ) : (
                    <div className="asset-placeholder">点击上方按钮上传动作视频</div>
                  )}
                </div>
              </div>

              <div className="editor-actions">
                <button type="button" className="primary-button" onClick={saveAction}>
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="page-content">
            <div className="page-section">
              <div className="section-head">
                <div>
                  <p className="page-eyebrow">Action Library</p>
                  <h2>全部动作</h2>
                </div>
                <div className="section-head-actions">
                  <button type="button" className="ghost-button" onClick={openBatchUploadGuide}>
                    批量上传
                  </button>
                  <input
                    id="action-batch-upload"
                    type="file"
                    accept="video/*"
                    multiple
                    hidden
                    onChange={(event) => {
                      openBatchUploadDialog(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button type="button" className="primary-button" onClick={() => openActionEditor()}>
                    + 添加动作
                  </button>
                </div>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>动作名称</span>
                  <input
                    value={actionFiltersDraft.search}
                    onChange={(event) =>
                      setActionFiltersDraft((current) => ({ ...current, search: event.target.value }))
                    }
                    placeholder="按动作名称搜索"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applyActionFilterSearch();
                      }
                    }}
                  />
                </label>
                <div className="filter-action">
                  <button type="button" className="primary-button" onClick={applyActionFilterSearch}>
                    搜索
                  </button>
                </div>
              </div>

              <div className="filter-line">
                <span className="filter-label">动作类型</span>
                <FilterChips
                  options={appData?.actionTypes || []}
                  selectedIds={actionFiltersDraft.typeIds}
                  onToggle={toggleActionTypeFilter}
                />
              </div>
            </div>

            <div className="divider" />

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>动作序号</th>
                    <th>动作名称</th>
                    <th>动作类型</th>
                    <th>添加时间</th>
                    <th>管理</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.length ? (
                    filteredActions.map((action) => (
                      <tr key={action.id}>
                        <td>{action.id}</td>
                        <td>{action.name}</td>
                        <td>
                          <div className="table-tags">
                            {action.typeIds.length ? (
                              action.typeIds.map((typeId) => (
                                <span key={typeId} className="table-tag">
                                  {actionTypeMap.get(typeId) || `分类 ${typeId}`}
                                </span>
                              ))
                            ) : (
                              <span className="table-tag is-muted">未分类</span>
                            )}
                          </div>
                        </td>
                        <td>{formatDate(action.createTime)}</td>
                        <td>
                          <button type="button" className="table-link" onClick={() => openActionEditor(action)}>
                            编辑
                          </button>
                          <button type="button" className="table-link danger" onClick={() => removeAction(action.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <EmptyBlock title="没有找到匹配动作" copy="可以调整筛选条件，或者直接新建一个动作。" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {actionBatchGuideOpen ? (
          <Dialog
            title="批量上传动作"
            width={640}
            onClose={() => setActionBatchGuideOpen(false)}
            onConfirm={confirmBatchUploadGuide}
            confirmText="选择视频"
          >
            <div className="dialog-form">
              <div className="batch-upload-note">
                <strong>上传前请先按规则命名视频</strong>
                <p>文件名需要使用 `动作-类型` 格式，例如：`划船-hyrox.mp4`、`推雪橇-耐力.mp4`。</p>
                <p>系统会根据文件名自动创建动作，并自动匹配或创建对应的动作分类。</p>
                <p>确认命名无误后，再点击下方“选择视频”开始挑选要上传的文件。</p>
              </div>
            </div>
          </Dialog>
        ) : null}

        {actionBatchDialog ? (
          <Dialog
            title="批量上传动作"
            width={920}
            onClose={() => setActionBatchDialog(null)}
            onConfirm={saveBatchActions}
            confirmText="开始上传"
          >
            <div className="dialog-form">
              <div className="batch-upload-note">
                <strong>命名规则：动作-类型</strong>
                <p>例如：`划船-hyrox.mp4` 会自动创建动作“划船”，并自动匹配或创建分类“HYROX”。</p>
              </div>

              <div className="batch-upload-summary">
                <span>待处理 {batchReadyCount} 个</span>
                <span>命名异常 {batchInvalidCount} 个</span>
              </div>

              <div className="batch-upload-table-wrap">
                <table className="data-table batch-upload-table">
                  <thead>
                    <tr>
                      <th>文件名</th>
                      <th>动作名</th>
                      <th>分类</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionBatchDialog.items.map((item) => (
                      <tr key={item.id}>
                        <td className="cell-break">{item.fileName}</td>
                        <td>{item.actionName || "--"}</td>
                        <td>
                          {item.resolvedTypeName ? (
                            <span className={`table-tag ${item.needsCreateType ? "is-pending" : ""}`}>
                              {item.needsCreateType ? `将创建 ${item.resolvedTypeName}` : item.resolvedTypeName}
                            </span>
                          ) : (
                            <span className="table-tag is-muted">--</span>
                          )}
                        </td>
                        <td className={item.status === "invalid" ? "batch-status is-invalid" : "batch-status"}>
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Dialog>
        ) : null}
      </section>
    );
  }

  function renderTemplates() {
    const isEditingTemplate = Boolean(templateEditor);
    const editingLabel = templateEditor
      ? `${templateEditor.id ? "编辑" : "添加"}${getTemplateKindLabel(templateEditor.kind)}`
      : "编辑模板";

    return (
      <section className="page-card is-no-padding">
        {pageTabs("课程模板", editingLabel, isEditingTemplate, () => setTemplateEditor(null), () => setTemplateEditor(null))}

        {templateEditor ? (
          <div className="editor-layout">
            <div className="editor-header">
              <h2>{editingLabel}</h2>
            </div>

            <div className="editor-form">
              <div className="form-row single">
                <label className="field">
                  <span>模板名称</span>
                  <input
                    value={templateEditor.name}
                    onChange={(event) =>
                      updateTemplateEditor((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    placeholder={`请输入${getTemplateKindLabel(templateEditor.kind)}名称`}
                  />
                </label>
              </div>

              {templateEditor.kind === "training" && templateEditor.videoGroup ? (
                <div className="section-card">
                  <div className="section-card-head">
                    <div>
                      <h3>正式组模板</h3>
                      <p className="section-copy">这里负责定义屏幕数量、站点和动作位结构，动作可以先留空，后面在课程里再填。</p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        updateTemplateEditor((current) => ({
                          ...current,
                          videoGroup: current.videoGroup
                            ? {
                                ...current.videoGroup,
                                screenCount: current.videoGroup.screenCount === 1 ? 3 : 1,
                                screens: Array.from(
                                  { length: current.videoGroup.screenCount === 1 ? 3 : 1 },
                                  (_, index) => {
                                    const screenCount = current.videoGroup!.screenCount === 1 ? 3 : 1;
                                    const screenIndex = index + 1;
                                    const existingScreen = current.videoGroup!.screens.find(
                                      (entry) => entry.screenIndex === screenIndex
                                    );

                                    return existingScreen
                                      ? {
                                          ...existingScreen,
                                          stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                                          layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
                                          videoCards: existingScreen.videoCards.map((card) => ({
                                            ...card,
                                            stationNumber: screenCount === 1 ? "" : card.stationNumber
                                          }))
                                        }
                                      : createVideoGroupScreen(screenIndex, screenCount);
                                  }
                                )
                              }
                            : current.videoGroup
                        }))
                      }
                    >
                      切换为{templateEditor.videoGroup.screenCount === 1 ? "三屏" : "单屏"}
                    </button>
                  </div>

                  <div className={`screen-grid ${templateEditor.videoGroup.screenCount === 1 ? "is-single" : ""}`}>
                    {templateEditor.videoGroup.screens.map((screen) => (
                      <div key={screen.id} className="screen-card">
                        <div className="screen-card-head">
                          <div>
                            <strong>{screen.stationLabel}</strong>
                            <span>{screen.layout === "WATERFALL" ? "瀑布流动作列表" : "站点动作列表"}</span>
                          </div>
                        </div>

                        <div className="stack-list">
                          {screen.videoCards.map((card, cardIndex) => (
                            <div key={card.id} className="stack-row compact card-row">
                              <div className="stack-row-main">
                                <label className="field grow action-field">
                                  <span>动作位 {cardIndex + 1}</span>
                                  <select
                                    value={card.actionId}
                                    onChange={(event) =>
                                      updateTemplateEditor((current) => ({
                                        ...current,
                                        videoGroup: current.videoGroup
                                          ? {
                                              ...current.videoGroup,
                                              screens: current.videoGroup.screens.map((entry) =>
                                                entry.id === screen.id
                                                  ? {
                                                      ...entry,
                                                      videoCards: entry.videoCards.map((videoCard) =>
                                                        videoCard.id === card.id
                                                          ? {
                                                              ...videoCard,
                                                              actionId: event.target.value,
                                                              actionName: findActionName(appData?.actions || [], event.target.value)
                                                            }
                                                          : videoCard
                                                      )
                                                    }
                                                  : entry
                                              )
                                            }
                                          : current.videoGroup
                                      }))
                                    }
                                  >
                                    <option value="">先留空，课程里再选动作</option>
                                    {(appData?.actions || []).map((action) => (
                                      <option key={action.id} value={action.id}>
                                        {action.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                {templateEditor.videoGroup.screenCount === 3 ? (
                                  <label className="field station-field">
                                    <span>站点</span>
                                    <input
                                      type="text"
                                      value={card.stationNumber}
                                      placeholder="1 / A / 1A"
                                      onChange={(event) =>
                                        updateTemplateEditor((current) => ({
                                          ...current,
                                          videoGroup: current.videoGroup
                                            ? {
                                                ...current.videoGroup,
                                                screens: current.videoGroup.screens.map((entry) =>
                                                  entry.id === screen.id
                                                    ? {
                                                        ...entry,
                                                        videoCards: entry.videoCards.map((videoCard) =>
                                                          videoCard.id === card.id
                                                            ? { ...videoCard, stationNumber: event.target.value }
                                                            : videoCard
                                                        )
                                                      }
                                                    : entry
                                                )
                                              }
                                            : current.videoGroup
                                        }))
                                      }
                                    />
                                  </label>
                                ) : null}

                                <button
                                  type="button"
                                  className="table-link danger"
                                  onClick={() =>
                                    updateTemplateEditor((current) => ({
                                      ...current,
                                      videoGroup: current.videoGroup
                                        ? {
                                            ...current.videoGroup,
                                            screens: current.videoGroup.screens.map((entry) =>
                                              entry.id === screen.id
                                                ? {
                                                    ...entry,
                                                    videoCards: entry.videoCards.filter((videoCard) => videoCard.id !== card.id)
                                                      .length
                                                      ? entry.videoCards.filter((videoCard) => videoCard.id !== card.id)
                                                      : [createVideoCard()]
                                                  }
                                                : entry
                                            )
                                          }
                                        : current.videoGroup
                                    }))
                                  }
                                >
                                  删除
                                </button>
                              </div>

                              <ActionMediaPreview
                                actionId={card.actionId}
                                actions={appData?.actions || []}
                                emptyCopy="模板里可以先不选动作，保留结构占位"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="screen-card-footer">
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() =>
                              updateTemplateEditor((current) => ({
                                ...current,
                                videoGroup: current.videoGroup
                                  ? {
                                      ...current.videoGroup,
                                      screens: current.videoGroup.screens.map((entry) =>
                                        entry.id === screen.id
                                          ? {
                                              ...entry,
                                              videoCards: [...entry.videoCards, createVideoCard()]
                                            }
                                          : entry
                                      )
                                    }
                                  : current.videoGroup
                              }))
                            }
                          >
                            + 添加动作
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : templateEditor.section ? (
                <div className="section-card">
                  <div className="section-card-head">
                    <div>
                      <h3>{templateEditor.kind === "cooldown" ? "冷身模板" : "热身模板"}</h3>
                      <p className="section-copy">模板会保存动作和持续时间，方便在课程编辑里直接复用。</p>
                    </div>
                  </div>

                  <div className="section-inline-summary">
                    <span>{templateEditor.section.items.length} 个动作</span>
                    <span>{formatSecondsLabel(getWaterfallSectionTotal(templateEditor.section))}</span>
                  </div>

                  <div className="stack-list">
                    {templateEditor.section.items.map((item, index) => (
                      <div key={item.id} className="stack-row waterfall-row">
                        <div className="stack-row-main">
                          <label className="field grow">
                            <span>动作 {index + 1}</span>
                            <select
                              value={item.actionId}
                              onChange={(event) =>
                                updateTemplateEditor((current) => ({
                                  ...current,
                                  section: current.section
                                    ? {
                                        ...current.section,
                                        items: current.section.items.map((entry) =>
                                          entry.id === item.id
                                            ? {
                                                ...entry,
                                                actionId: event.target.value,
                                                actionName: findActionName(appData?.actions || [], event.target.value)
                                              }
                                            : entry
                                        )
                                      }
                                    : current.section
                                }))
                              }
                            >
                              <option value="">请选择动作</option>
                              {(appData?.actions || []).map((action) => (
                                <option key={action.id} value={action.id}>
                                  {action.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field narrow">
                            <span>时长</span>
                            <DraftNumberInput
                              value={item.seconds}
                              minValue={0}
                              onValueChange={(value) =>
                                updateTemplateEditor((current) => ({
                                  ...current,
                                  section: current.section
                                    ? {
                                        ...current.section,
                                        items: current.section.items.map((entry) =>
                                          entry.id === item.id ? { ...entry, seconds: value } : entry
                                        )
                                      }
                                    : current.section
                                }))
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="table-link danger"
                            onClick={() =>
                              updateTemplateEditor((current) => ({
                                ...current,
                                section: current.section
                                  ? {
                                      ...current.section,
                                      items: current.section.items.filter((entry) => entry.id !== item.id).length
                                        ? current.section.items.filter((entry) => entry.id !== item.id)
                                        : [createWaterfallItem()]
                                    }
                                  : current.section
                              }))
                            }
                          >
                            删除
                          </button>
                        </div>

                        <ActionMediaPreview actionId={item.actionId} actions={appData?.actions || []} />
                      </div>
                    ))}
                  </div>

                  <div className="section-card-footer">
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        updateTemplateEditor((current) => ({
                          ...current,
                          section: current.section
                            ? {
                                ...current.section,
                                items: [...current.section.items, createWaterfallItem()]
                              }
                            : current.section
                        }))
                      }
                    >
                      + 添加动作
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="editor-actions">
                <button type="button" className="primary-button" onClick={saveTemplate}>
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="page-content">
            <div className="page-section">
              <div className="section-head">
                <div>
                  <p className="page-eyebrow">Template Library</p>
                  <h2>课程模板</h2>
                </div>
                <div className="section-head-actions">
                  <button type="button" className="primary-button" onClick={() => openTemplateEditor(null, templateTab)}>
                    + 添加模板
                  </button>
                </div>
              </div>
            </div>

            <div className="tab-row template-tab-row">
              {TEMPLATE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-button ${templateTab === tab.key ? "is-active" : ""}`}
                  onClick={() => setTemplateTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="divider" />

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>模板名称</th>
                    <th>模板类型</th>
                    <th>内容概览</th>
                    <th>更新时间</th>
                    <th>管理</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTemplateList.length ? (
                    activeTemplateList.map((template) => (
                      <tr key={template.id}>
                        <td>{template.name}</td>
                        <td>{getTemplateKindLabel(template.kind)}</td>
                        <td>{formatTemplateSummary(template)}</td>
                        <td>{formatDate(template.updateTime)}</td>
                        <td>
                          <button type="button" className="table-link" onClick={() => openTemplateEditor(template, template.kind)}>
                            编辑
                          </button>
                          <button type="button" className="table-link danger" onClick={() => removeTemplate(template)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <EmptyBlock title="还没有模板" copy="先创建一套热身、冷身或正式组模板，课程编辑里就能直接复用。" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderCourses() {
    const isCourseLibraryActive = activeCourseTabId === "all-courses" || !activeCourseEditorTab;
    const videoGroupMap = new Map(courseEditor?.script.training.videoGroups.map((group) => [group.id, group]) || []);

    return (
      <section className="page-card is-no-padding">
        <div className="inner-tabs">
          <button
            className={`inner-tab ${isCourseLibraryActive ? "is-active" : ""}`}
            type="button"
            onClick={() => setActiveCourseTabId("all-courses")}
          >
            全部课程
          </button>
          {courseEditorTabs.map((tab) => (
            <button
              key={tab.tabId}
              className={`inner-tab is-closable ${activeCourseTabId === tab.tabId ? "is-active" : ""}`}
              type="button"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest(".inner-tab-close-mark")) {
                  event.preventDefault();
                  closeCourseTab(tab.tabId);
                  return;
                }
                setActiveCourseTabId(tab.tabId);
              }}
            >
              <span>{tab.title}</span>
              <span className="inner-tab-close-mark">×</span>
            </button>
          ))}
        </div>

        {!isCourseLibraryActive && courseEditor ? (
          <div className="editor-layout">
            <div className="editor-header">
              <h2>{activeCourseEditorTab?.title || "编辑课程"}</h2>
              <p className="section-copy">课程脚本已升级为热身、正式训练、冷身三段式动态编辑，Pod 可复用视频组并控制正式训练流程。</p>
            </div>

            <div className="editor-form">
              <div className="form-row three">
                <label className="field">
                  <span>名称</span>
                  <input
                    value={courseEditor.script.metadata.name}
                    onChange={(event) =>
                      updateCourseScript((current) => ({
                        ...current,
                        metadata: {
                          ...current.metadata,
                          name: event.target.value
                        }
                      }))
                    }
                    placeholder="请输入课程名称"
                  />
                </label>

                <label className="field">
                  <span>课程设计者</span>
                  <input
                    value={courseEditor.script.metadata.creator}
                    onChange={(event) =>
                      updateCourseScript((current) => ({
                        ...current,
                        metadata: {
                          ...current.metadata,
                          creator: event.target.value
                        }
                      }))
                    }
                    placeholder="请输入设计者"
                  />
                </label>

                <label className="field">
                  <span>课程版本</span>
                  <input
                    value={courseEditor.script.metadata.version}
                    onChange={(event) =>
                      updateCourseScript((current) => ({
                        ...current,
                        metadata: {
                          ...current.metadata,
                          version: event.target.value
                        }
                      }))
                    }
                    placeholder="请输入版本号"
                  />
                </label>
              </div>

              <div className="form-row single">
                <div className="field">
                  <span>课程类型</span>
                  <FilterChips
                    options={appData?.lessonTypes || []}
                    selectedIds={courseEditor.typeIds}
                    onToggle={(typeId) =>
                      setCourseEditor((current) => ({
                        ...current,
                        typeIds: toggleNumberId(current.typeIds, typeId)
                      }))
                    }
                    onAdd={() => setTypeDialog({ kind: "lesson", value: "" })}
                  />
                </div>
              </div>

              <div className="logo-panel">
                <div className="field">
                  <span>课程 Logo</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => triggerFileInput("course-logo-upload")}
                  >
                    上传 Logo
                  </button>
                  <input
                    id="course-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      setCourseEditor((current) => ({
                        ...current,
                        logoFile: file,
                        logoPreview: URL.createObjectURL(file)
                      }));
                    }}
                  />
                </div>
                <div className="logo-preview">
                  {courseEditor.logoPreview ? (
                    <img src={courseEditor.logoPreview} alt="课程 logo 预览" />
                  ) : (
                    <span>暂无 Logo</span>
                  )}
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head">
                  <div>
                    <h3>TV 横屏信息</h3>
                    <p className="section-copy">这一组字段会提供给 TV 第 4 块横屏显示，保留你原来的 set / break / rest / work 口径。</p>
                  </div>
                </div>

                <div className="form-row four">
                  <label className="field">
                    <span>Set</span>
                    <input value={courseEditor.script.metadata.trainingPanel.setCount} readOnly />
                  </label>

                  <label className="field">
                    <span>Break</span>
                    <input value={courseEditor.script.metadata.trainingPanel.breakCount} readOnly />
                  </label>

                  <label className="field">
                    <span>Rest</span>
                    <DraftNumberInput
                      value={courseEditor.script.metadata.trainingPanel.restSeconds}
                      minValue={0}
                      onValueChange={(value) =>
                        updateCourseScript((current) => ({
                          ...current,
                          metadata: {
                            ...current.metadata,
                            trainingPanel: {
                              ...current.metadata.trainingPanel,
                              restSeconds: value
                            }
                          }
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Work</span>
                    <DraftNumberInput
                      value={courseEditor.script.metadata.trainingPanel.workSeconds}
                      minValue={0}
                      onValueChange={(value) =>
                        updateCourseScript((current) => ({
                          ...current,
                          metadata: {
                            ...current.metadata,
                            trainingPanel: {
                              ...current.metadata.trainingPanel,
                              workSeconds: value
                            }
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              {(["warmup", "cooldown"] as CourseSectionKey[]).map((sectionKey) => {
                const section = courseEditor.script.sections[sectionKey];
                const isCooldownSection = sectionKey === "cooldown";
                const isSectionEmpty = section.items.length === 0;

                return (
                  <div key={section.id} className="section-card">
                    <div className="section-card-head">
                      <div>
                        <h3>{section.title}</h3>
                        <p className="section-copy">{SECTION_COPY[sectionKey]}</p>
                      </div>
                      <div className="section-head-actions">
                        <button
                          type="button"
                          className="ghost-button small"
                          onClick={() => openTemplateUseDialog(sectionKey)}
                        >
                          使用模版
                        </button>
                        {isCooldownSection && !isSectionEmpty ? (
                          <button
                            type="button"
                            className="table-link danger"
                            onClick={() =>
                              updateCourseScript((current) => ({
                                ...current,
                                sections: {
                                  ...current.sections,
                                  cooldown: {
                                    ...current.sections.cooldown,
                                    items: []
                                  }
                                }
                              }))
                            }
                          >
                            删除冷身
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="section-inline-summary">
                      <span>{section.items.length} 个动作</span>
                      <span>{formatSecondsLabel(section.items.reduce((total, item) => total + Number(item.seconds || 0), 0))}</span>
                    </div>

                    {isSectionEmpty ? (
                      <EmptyBlock
                        title="当前未启用冷身"
                        copy="这节课可以没有冷身模块。你可以直接保存，也可以重新添加动作或使用冷身模版恢复。"
                      />
                    ) : (
                      <div className="stack-list">
                        {section.items.map((item, index) => (
                          <div key={item.id} className="stack-row waterfall-row">
                            <div className="stack-row-main">
                              <label className="field grow">
                                <span>动作 {index + 1}</span>
                                <select
                                  value={item.actionId}
                                  onChange={(event) =>
                                    updateCourseScript((current) => ({
                                      ...current,
                                      sections: {
                                        ...current.sections,
                                        [sectionKey]: {
                                          ...current.sections[sectionKey],
                                          items: current.sections[sectionKey].items.map((entry) =>
                                            entry.id === item.id
                                              ? {
                                                  ...entry,
                                                  actionId: event.target.value,
                                                  actionName: findActionName(appData?.actions || [], event.target.value)
                                                }
                                              : entry
                                          )
                                        }
                                      }
                                    }))
                                  }
                                >
                                  <option value="">请选择动作</option>
                                  {(appData?.actions || []).map((action) => (
                                    <option key={action.id} value={action.id}>
                                      {action.name}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="field narrow">
                                <span>时长</span>
                                <DraftNumberInput
                                  value={item.seconds}
                                  minValue={0}
                                  onValueChange={(value) =>
                                    updateCourseScript((current) => ({
                                      ...current,
                                      sections: {
                                        ...current.sections,
                                        [sectionKey]: {
                                          ...current.sections[sectionKey],
                                          items: current.sections[sectionKey].items.map((entry) =>
                                            entry.id === item.id ? { ...entry, seconds: value } : entry
                                          )
                                        }
                                      }
                                    }))
                                  }
                                />
                              </label>

                              <button
                                type="button"
                                className="table-link danger"
                                onClick={() =>
                                  updateCourseScript((current) => {
                                    const nextItems = current.sections[sectionKey].items.filter((entry) => entry.id !== item.id);
                                    return {
                                      ...current,
                                      sections: {
                                        ...current.sections,
                                        [sectionKey]: {
                                          ...current.sections[sectionKey],
                                          items: nextItems.length || isCooldownSection ? nextItems : [createWaterfallItem()]
                                        }
                                      }
                                    };
                                  })
                                }
                              >
                                删除
                              </button>
                            </div>

                            <ActionMediaPreview actionId={item.actionId} actions={appData?.actions || []} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="section-card-footer">
                      <button
                        type="button"
                        className="ghost-button small"
                        onClick={() =>
                          updateCourseScript((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              [sectionKey]: {
                                ...current.sections[sectionKey],
                                items: [...current.sections[sectionKey].items, createWaterfallItem()]
                              }
                            }
                          }))
                        }
                      >
                        {isCooldownSection && isSectionEmpty ? "+ 添加冷身动作" : "+ 添加动作"}
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="section-card">
                <div className="section-card-head">
                  <div>
                    <h3>正式训练 · 视频组</h3>
                    <p className="section-copy">先定义视频组的屏幕和站点动作，再由 Pod 多次引用这些视频组。</p>
                  </div>
                  <div className="section-head-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        updateCourseScript((current) => ({
                          ...current,
                          training: {
                            ...current.training,
                            videoGroups: [...current.training.videoGroups, createVideoGroup(3)]
                          }
                        }))
                      }
                    >
                      + 三屏组
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        updateCourseScript((current) => ({
                          ...current,
                          training: {
                            ...current.training,
                            videoGroups: [...current.training.videoGroups, createVideoGroup(1)]
                          }
                        }))
                      }
                    >
                      + 单屏组
                    </button>
                  </div>
                </div>

                <div className="module-list">
                  {courseEditor.script.training.videoGroups.map((group, groupIndex) => (
                    <div key={group.id} className="module-card">
                      <div className="module-card-head">
                        <div>
                          <strong>{group.name || `视频组 ${groupIndex + 1}`}</strong>
                          <span>{group.screenCount === 1 ? "单屏瀑布流展示" : "三屏站点展示"}</span>
                        </div>
                        <div className="screen-card-actions">
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => openTemplateUseDialog("training", group)}
                          >
                            使用模版
                          </button>
                        </div>
                      </div>

                      <div className="form-row two">
                        <label className="field">
                          <span>视频组名称</span>
                          <input
                            value={group.name}
                            onChange={(event) =>
                              updateCourseScript((current) => {
                                const nextGroup = {
                                  ...group,
                                  name: event.target.value
                                };
                                return syncPodsForVideoGroup(current, nextGroup);
                              })
                            }
                            placeholder="例如：拳击三屏组 / 有氧瀑布组"
                          />
                        </label>

                        <label className="field">
                          <span>屏幕模式</span>
                          <input
                            value={group.screenCount === 1 ? "单屏瀑布流" : "三屏站点"}
                            readOnly
                          />
                        </label>
                      </div>

                      <div className="group-meta-actions">
                        <button
                          type="button"
                          className="ghost-button small"
                          onClick={() =>
                            updateCourseScript((current) => {
                              const nextScreenCount = group.screenCount === 1 ? 3 : 1;
                              const nextGroup: VideoGroup = {
                                ...group,
                                screenCount: nextScreenCount,
                                screens: Array.from({ length: nextScreenCount }, (_, index) => {
                                  const screenIndex = index + 1;
                                  const existingScreen = group.screens.find((entry) => entry.screenIndex === screenIndex);
                                  return existingScreen
                                    ? {
                                        ...existingScreen,
                                        stationLabel: nextScreenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                                        layout: nextScreenCount === 1 ? "WATERFALL" : "STATIONS"
                                      }
                                    : createVideoGroupScreen(screenIndex, nextScreenCount);
                                })
                              };

                              return syncPodsForVideoGroup(current, nextGroup);
                            })
                          }
                        >
                          切换为{group.screenCount === 1 ? "三屏" : "单屏"}
                        </button>

                        <button
                          type="button"
                          className="table-link danger"
                          onClick={() => {
                            if (courseEditor.script.training.videoGroups.length <= 1) {
                              pushNotice("至少保留一个视频组。", "error");
                              return;
                            }
                            updateCourseScript((current) => removeVideoGroup(current, group.id));
                          }}
                        >
                          删除视频组
                        </button>
                      </div>

                      <div className={`screen-grid ${group.screenCount === 1 ? "is-single" : ""}`}>
                        {group.screens.map((screen) => (
                          <div key={screen.id} className="screen-card">
                            <div className="screen-card-head">
                              <div>
                                <strong>{screen.stationLabel}</strong>
                                <span>{screen.layout === "WATERFALL" ? "瀑布流动作列表" : "站点动作列表"}</span>
                              </div>
                            </div>

                            <div className="stack-list">
                              {screen.videoCards.map((card, cardIndex) => (
                                <div key={card.id} className="stack-row compact card-row">
                                  <div className="stack-row-main">
                                    <label className="field grow action-field">
                                      <span>动作 {cardIndex + 1}</span>
                                      <select
                                        value={card.actionId}
                                        onChange={(event) =>
                                          updateCourseScript((current) => {
                                            const nextGroup = {
                                              ...group,
                                              screens: group.screens.map((entry) =>
                                                entry.id === screen.id
                                                  ? {
                                                      ...entry,
                                                      videoCards: entry.videoCards.map((videoCard) =>
                                                        videoCard.id === card.id
                                                          ? {
                                                              ...videoCard,
                                                              actionId: event.target.value,
                                                              actionName: findActionName(appData?.actions || [], event.target.value)
                                                            }
                                                          : videoCard
                                                      )
                                                    }
                                                  : entry
                                              )
                                            };
                                            return syncPodsForVideoGroup(current, nextGroup);
                                          })
                                        }
                                      >
                                        <option value="">请选择动作</option>
                                        {(appData?.actions || []).map((action) => (
                                          <option key={action.id} value={action.id}>
                                            {action.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    {group.screenCount === 3 ? (
                                      <label className="field station-field">
                                        <span>站点</span>
                                        <input
                                          type="text"
                                          value={card.stationNumber}
                                          placeholder="1 / A / 1A"
                                          onChange={(event) =>
                                            updateCourseScript((current) => {
                                              const nextGroup = {
                                                ...group,
                                                screens: group.screens.map((entry) =>
                                                  entry.id === screen.id
                                                    ? {
                                                        ...entry,
                                                        videoCards: entry.videoCards.map((videoCard) =>
                                                          videoCard.id === card.id
                                                            ? { ...videoCard, stationNumber: event.target.value }
                                                            : videoCard
                                                        )
                                                      }
                                                    : entry
                                                )
                                              };
                                              return syncPodsForVideoGroup(current, nextGroup);
                                            })
                                          }
                                        />
                                      </label>
                                    ) : null}

                                    <button
                                      type="button"
                                      className="table-link danger"
                                      onClick={() =>
                                        updateCourseScript((current) => {
                                          const nextGroup = {
                                            ...group,
                                            screens: group.screens.map((entry) =>
                                              entry.id === screen.id
                                                ? {
                                                    ...entry,
                                                    videoCards: entry.videoCards.filter((videoCard) => videoCard.id !== card.id).length
                                                      ? entry.videoCards.filter((videoCard) => videoCard.id !== card.id)
                                                      : [createVideoCard()]
                                                  }
                                                : entry
                                            )
                                          };
                                          return syncPodsForVideoGroup(current, nextGroup);
                                        })
                                      }
                                    >
                                      删除
                                    </button>
                                  </div>

                                  <ActionMediaPreview actionId={card.actionId} actions={appData?.actions || []} />
                                </div>
                              ))}
                            </div>

                            <div className="screen-card-footer">
                              <button
                                type="button"
                                className="ghost-button small"
                                onClick={() =>
                                  updateCourseScript((current) => {
                                    const nextGroup = {
                                      ...group,
                                      screens: group.screens.map((entry) =>
                                        entry.id === screen.id
                                          ? {
                                              ...entry,
                                              videoCards: [...entry.videoCards, createVideoCard()]
                                            }
                                          : entry
                                      )
                                    };
                                    return syncPodsForVideoGroup(current, nextGroup);
                                  })
                                }
                              >
                                + 添加动作
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head">
                  <div>
                    <h3>正式训练 · Pod 流程</h3>
                    <p className="section-copy">Pod 不再逐节点编辑。单屏瀑布流按循环次数、工作时间和动作间休息生成；三屏站点模式按循环次数、组数、每组 work / rest 和换站休息生成。同动作组间休息不提示，换动作时 TV 提示 move station。</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      updateCourseScript((current) => {
                        const targetGroup = current.training.videoGroups[0] || createVideoGroup(3);
                        const nextPod = {
                          ...createPod(targetGroup),
                          name: createPodName(current.training.pods.length)
                        };

                        return {
                          ...current,
                          training: {
                            ...current.training,
                            pods: rebalancePodEndings([...current.training.pods, nextPod])
                          }
                        };
                      })
                    }
                  >
                    + 添加 Pod
                  </button>
                </div>

                <div className="module-list">
                  {courseEditor.script.training.pods.map((pod, podIndex) => {
                    const linkedGroup =
                      videoGroupMap.get(pod.videoGroupId) || courseEditor.script.training.videoGroups[0] || null;
                    const podTotals = pod.screens.map((screen) => {
                      const linkedScreen =
                        linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
                      return getPodScreenTotal(screen, linkedScreen);
                    });
                    const isBalanced = podTotals.every((total) => total === (podTotals[0] ?? 0));
                    const isLastPod = podIndex === courseEditor.script.training.pods.length - 1;

                    return (
                      <div key={pod.id} className="module-card is-pod">
                        <div className="module-card-head">
                          <div>
                            <strong>{pod.name || createPodName(podIndex)}</strong>
                            <span>
                              {linkedGroup?.name || "未绑定视频组"} · {linkedGroup?.screenCount === 1 ? "单屏瀑布" : "多屏站点"}
                            </span>
                          </div>
                          <div className="module-card-actions">
                            <button
                              type="button"
                              className="ghost-button small"
                              disabled={
                                !courseEditor.script.training.pods.some(
                                  (candidate) => candidate.id !== pod.id && podHasCustomizedRules(candidate)
                                )
                              }
                              onClick={() => openPodConfigCopyDialog(pod, pod.name || createPodName(podIndex))}
                            >
                              复制 Pod
                            </button>
                            <button
                              type="button"
                              className="table-link danger"
                              onClick={() => {
                                if (courseEditor.script.training.pods.length <= 1) {
                                  pushNotice("至少保留一个 Pod。", "error");
                                  return;
                                }

                                updateCourseScript((current) => ({
                                  ...current,
                                  training: {
                                    ...current.training,
                                    pods: rebalancePodEndings(
                                      current.training.pods.filter((entry) => entry.id !== pod.id)
                                    )
                                  }
                                }));
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        <div className={`form-row ${pod.ending === "FINISH" ? "three" : "four"}`}>
                          <label className="field">
                            <span>Pod 名称</span>
                            <input
                              value={pod.name}
                              onChange={(event) =>
                                updateCourseScript((current) => ({
                                  ...current,
                                  training: {
                                    ...current.training,
                                    pods: current.training.pods.map((entry) =>
                                      entry.id === pod.id ? { ...entry, name: event.target.value } : entry
                                    )
                                  }
                                }))
                              }
                            />
                          </label>

                          <label className="field">
                            <span>绑定视频组</span>
                            <select
                              value={pod.videoGroupId}
                              onChange={(event) =>
                                updateCourseScript((current) => {
                                  const nextGroup = current.training.videoGroups.find(
                                    (group) => group.id === event.target.value
                                  );

                                  return {
                                    ...current,
                                    training: {
                                      ...current.training,
                                      pods: current.training.pods.map((entry) =>
                                        entry.id === pod.id
                                          ? syncPodWithVideoGroup(
                                              {
                                                ...entry,
                                                videoGroupId: event.target.value
                                              },
                                              nextGroup
                                            )
                                          : entry
                                      )
                                    }
                                  };
                                })
                              }
                            >
                              {(courseEditor.script.training.videoGroups || []).map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name || `视频组 ${group.screenCount} 屏`}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Pod 结束方式</span>
                            <select
                              value={pod.ending}
                              onChange={(event) =>
                                updateCourseScript((current) => ({
                                  ...current,
                                  training: {
                                    ...current.training,
                                    pods: current.training.pods.map((entry) =>
                                      entry.id === pod.id
                                        ? { ...entry, ending: event.target.value as PodEnding }
                                        : entry
                                    )
                                  }
                                }))
                              }
                            >
                              {POD_ENDING_OPTIONS.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                  disabled={(item.value === "FINISH" && !isLastPod) || (isLastPod && item.value !== "FINISH")}
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          {pod.ending !== "FINISH" ? (
                            <label className="field">
                              <span>{pod.ending === "HYDRATE" ? "补水时长（秒）" : "换区时长（秒）"}</span>
                              <DraftNumberInput
                                value={courseEditor.script.metadata.defaultHydrateSeconds}
                                minValue={0}
                                onValueChange={(value) =>
                                  updateCourseScript((current) => ({
                                    ...current,
                                    metadata: {
                                      ...current.metadata,
                                      defaultHydrateSeconds: value
                                    }
                                  }))
                                }
                              />
                            </label>
                          ) : null}
                        </div>

                        <div className="section-inline-summary">
                          {pod.screens.map((screen) => (
                            <span key={screen.id}>
                              屏幕 {screen.screenIndex}: {formatSecondsLabel(
                                getPodScreenTotal(
                                  screen,
                                  linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null
                                )
                              )}
                            </span>
                          ))}
                        </div>

                        {!isBalanced ? (
                          <div className="inline-warning">{formatPodTimingMismatch(pod, linkedGroup || null)}</div>
                        ) : null}

                        <div className={`screen-grid ${linkedGroup?.screenCount === 1 ? "is-single" : ""}`}>
                          {pod.screens.map((screen) => {
                            const linkedScreen =
                              linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
                            const screenTotal = getPodScreenTotal(screen, linkedScreen);
                            const actionCount = linkedScreen?.videoCards.length || 0;
                            const isSingleScreenRule = linkedGroup?.screenCount === 1;
                            const effectiveSetConfigs = normalizePodSetConfigsForLayout(
                              screen.setConfigs,
                              isSingleScreenRule,
                              1
                            );

                            return (
                              <div key={screen.id} className="screen-card">
                                <div className="screen-card-head">
                                  <div>
                                    <strong>{linkedScreen?.stationLabel || `屏幕 ${screen.screenIndex}`}</strong>
                                    <span>{actionCount} 个动作 · {formatSecondsLabel(screenTotal)}</span>
                                  </div>
                                  <div className="screen-card-actions">
                                    {linkedGroup?.screenCount === 3 ? (
                                      <button
                                        type="button"
                                        className="ghost-button small"
                                        onClick={() =>
                                          openPodCopyDialog(
                                            pod,
                                            screen,
                                            linkedScreen?.stationLabel || `屏幕 ${screen.screenIndex}`
                                          )
                                        }
                                      >
                                        复制
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="ghost-button small"
                                      onClick={() =>
                                        openPodRuleDialog(
                                          pod,
                                          screen,
                                          linkedScreen?.stationLabel || `屏幕 ${screen.screenIndex}`,
                                          isSingleScreenRule
                                        )
                                      }
                                    >
                                      编辑规则
                                    </button>
                                  </div>
                                </div>

                                <div className={`form-row ${isSingleScreenRule ? "three" : "four"}`}>
                                  <label className="field">
                                    <span>循环次数</span>
                                    <input value={`${screen.loopCount} 次`} readOnly />
                                  </label>

                                  {!isSingleScreenRule ? (
                                    <label className="field">
                                      <span>组数</span>
                                      <input value={`${effectiveSetConfigs.length} 组`} readOnly />
                                    </label>
                                  ) : null}

                                  <label className="field">
                                    <span>休息时间策略</span>
                                    <input
                                      value={formatRestStrategy(screen, isSingleScreenRule)}
                                      readOnly
                                    />
                                  </label>

                                  <label className="field">
                                    <span>工作时间策略</span>
                                    <input
                                      value={formatSecondsStrategy(effectiveSetConfigs.map((setConfig) => setConfig.workSeconds))}
                                      readOnly
                                    />
                                  </label>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="editor-actions">
                <button type="button" className="primary-button" onClick={saveCourse}>
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="page-content">
            <div className="page-section">
              <div className="section-head">
                <div>
                  <p className="page-eyebrow">Course Library</p>
                  <h2>全部课程</h2>
                </div>
                <button type="button" className="primary-button" onClick={() => openCourseEditor()}>
                  + 添加课程
                </button>
              </div>

              <div className="filter-grid course-grid">
                <label className="field">
                  <span>课程名称</span>
                  <input
                    value={courseFiltersDraft.name}
                    onChange={(event) =>
                      setCourseFiltersDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="按课程名称搜索"
                  />
                </label>
                <label className="field">
                  <span>课程设计者</span>
                  <input
                    value={courseFiltersDraft.creator}
                    onChange={(event) =>
                      setCourseFiltersDraft((current) => ({ ...current, creator: event.target.value }))
                    }
                    placeholder="按设计者搜索"
                  />
                </label>
                <label className="field">
                  <span>课程版本</span>
                  <input
                    value={courseFiltersDraft.version}
                    onChange={(event) =>
                      setCourseFiltersDraft((current) => ({ ...current, version: event.target.value }))
                    }
                    placeholder="按版本搜索"
                  />
                </label>
                <div className="filter-action">
                  <button type="button" className="primary-button" onClick={() => setCourseFilters(courseFiltersDraft)}>
                    搜索
                  </button>
                </div>
              </div>

              <div className="filter-line">
                <span className="filter-label">课程类型</span>
                <FilterChips
                  options={appData?.lessonTypes || []}
                  selectedIds={courseFiltersDraft.typeIds}
                  onToggle={(typeId) =>
                    setCourseFiltersDraft((current) => ({
                      ...current,
                      typeIds: toggleNumberId(current.typeIds, typeId)
                    }))
                  }
                />
              </div>
            </div>

            <div className="divider" />

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>课程序号</th>
                    <th>课程版本</th>
                    <th>课程名称</th>
                    <th>课程设计者</th>
                    <th>课程类型</th>
                    <th>最后更新时间</th>
                    <th>管理</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length ? (
                    filteredCourses.map((course) => (
                      <tr key={course.id}>
                        <td>{course.id}</td>
                        <td>{course.version}</td>
                        <td>
                          <div className="course-cell">
                            <strong>{course.name}</strong>
                            <span>
                              {(course.summary?.warmupActionCount ?? course.script?.sections?.warmup?.items?.length ?? 0)} 热身 /
                              {" "}
                              {(course.summary?.trainingCardCount ??
                                course.script?.training?.videoGroups?.reduce(
                                  (sum, group) => sum + group.screens.reduce((screenSum, screen) => screenSum + screen.videoCards.length, 0),
                                  0
                                ) ??
                                0)} 训练动作 / {(course.summary?.podCount ?? course.script?.training?.pods?.length ?? 0)} Pod
                            </span>
                          </div>
                        </td>
                        <td>{course.creator}</td>
                        <td>
                          <div className="table-tags">
                            {course.typeIds.length ? (
                              course.typeIds.map((typeId) => (
                                <span key={typeId} className="table-tag">
                                  {lessonTypeMap.get(typeId) || `分类 ${typeId}`}
                                </span>
                              ))
                            ) : (
                              <span className="table-tag is-muted">未分类</span>
                            )}
                          </div>
                        </td>
                        <td className="cell-nowrap">{formatDate(course.updateTime)}</td>
                        <td>
                          <button type="button" className="table-link" onClick={() => openCourseEditor(course)}>
                            编辑
                          </button>
                          <button type="button" className="table-link danger" onClick={() => removeCourse(course.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyBlock title="没有找到匹配课程" copy="可以调整筛选条件，或者新增一个课程版本。" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  }

  const podCopyTargetPod =
    podCopyDialog && courseEditor
      ? courseEditor.script.training.pods.find((pod) => pod.id === podCopyDialog.podId) || null
      : null;
  const podCopyOptions =
    podCopyTargetPod && podCopyDialog
      ? podCopyTargetPod.screens
          .filter((screen) => screen.id !== podCopyDialog.targetScreenId)
          .map((screen) => ({
            ...screen,
            label: `屏幕 ${screen.screenIndex}`,
            disabled: !screen.isCustomized
          }))
      : [];
  const podConfigCopyTargetPod =
    podConfigCopyDialog && courseEditor
      ? courseEditor.script.training.pods.find((pod) => pod.id === podConfigCopyDialog.targetPodId) || null
      : null;
  const podConfigCopyOptions =
    podConfigCopyDialog && courseEditor
      ? courseEditor.script.training.pods
          .filter((pod) => pod.id !== podConfigCopyDialog.targetPodId)
          .map((pod, index) => {
            const linkedGroup =
              courseEditor.script.training.videoGroups.find((group) => group.id === pod.videoGroupId) || null;
            const isSingleScreenRule = linkedGroup?.screenCount === 1;
            const firstScreen = pod.screens[0] || null;
            const effectiveSetConfigs = firstScreen
              ? normalizePodSetConfigsForLayout(firstScreen.setConfigs, isSingleScreenRule, 1)
              : [];
            const copiedWorkStrategy = effectiveSetConfigs.length
              ? formatSecondsStrategy(effectiveSetConfigs.map((setConfig) => setConfig.workSeconds))
              : "--";
            const label = pod.name || createPodName(index);
            const customized = podHasCustomizedRules(pod);
            return {
              id: pod.id,
              label,
              disabled: !customized,
              hint: customized ? `已编辑 · ${copiedWorkStrategy}` : "未编辑，暂不可复制"
            };
          })
      : [];
  const templateUseOptions = templateUseDialog ? templateCollections[templateUseDialog.target] || [] : [];

  if (!authReady) {
    return <div className="busy-mask">正在恢复登录...</div>;
  }

  if (!authSession) {
    return (
      <>
        {renderLogin()}
        {notice ? <div className={`notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
        {busyText ? <div className="busy-mask">{busyText}</div> : null}
      </>
    );
  }

  return (
    <div className={`admin-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className={`sidebar-edge-toggle ${sidebarCollapsed ? "is-collapsed" : ""}`}
        onClick={() => setSidebarCollapsed((current) => !current)}
        aria-label={sidebarCollapsed ? "展开导航" : "收起导航"}
      >
        <span>{sidebarCollapsed ? "›" : "‹"}</span>
      </button>

      <aside className="sidebar">
        <div>
          <div className="brand-lockup">
            <div className="traffic-lights">
              <span className="dot is-red" />
              <span className="dot is-yellow" />
              <span className="dot is-green" />
            </div>
            <div className="brand-wordmark">INFINI</div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activePage === item.key ? "is-active" : ""}`}
                onClick={() => setActivePage(item.key)}
              >
                <span className="nav-icon">{item.short}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-top">
          <div className="workspace-top-main">
            <div className="workspace-top-left">
              <div>
                <p className="workspace-kicker">Infini Admin</p>
                <strong>课程编辑端</strong>
              </div>
            </div>
            <div className="workspace-top-actions">
              <div className="user-pill">
                <strong>{authSession.username}</strong>
                <span>已登录账号</span>
              </div>
              <button type="button" className="ghost-button" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          </div>
        </header>

        <main className="workspace-body">
          {activePage === "home" ? renderHome() : null}
          {activePage === "courses" ? renderCourses() : null}
          {activePage === "actions" ? renderActions() : null}
          {activePage === "templates" ? renderTemplates() : null}
          {activePage === "venues" ? (
            <VenueManagementPage
              tokenType={authSession.token_type}
              accessToken={authSession.access_token}
              onNotice={pushNotice}
            />
          ) : null}
          {activePage === "appVersions" ? (
            <AppVersionsPage
              tokenType={authSession.token_type}
              accessToken={authSession.access_token}
              onBusyTextChange={setBusyText}
              onNotice={pushNotice}
            />
          ) : null}
        </main>
      </div>

      {templateUseDialog ? (
        <Dialog
          title={
            templateUseDialog.target === "training"
              ? `为${templateUseDialog.targetVideoGroupName || "当前视频组"}使用正式组模版`
              : `使用${getTemplateKindLabel(templateUseDialog.target)}`
          }
          width={720}
          onClose={() => setTemplateUseDialog(null)}
          onConfirm={applyTemplateToCourse}
          confirmText={templateUseDialog.target === "training" ? "覆盖当前视频组" : "使用模版"}
          confirmDisabled={!templateUseDialog.selectedTemplateId}
        >
          <div className="dialog-form">
            {templateUseOptions.length ? (
              <div className="copy-screen-options">
                {templateUseOptions.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`copy-screen-option ${
                      templateUseDialog.selectedTemplateId === String(template.id) ? "is-selected" : ""
                    }`}
                    onClick={() =>
                      setTemplateUseDialog((current) =>
                        current
                          ? {
                              ...current,
                              selectedTemplateId: String(template.id)
                            }
                          : current
                      )
                    }
                  >
                    <strong>{template.name}</strong>
                    <span>{formatTemplateSummary(template)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyBlock title="还没有可用模板" copy="先去课程模板页创建好模板，再回来一键套用。" />
            )}
          </div>
        </Dialog>
      ) : null}

      {podRuleDialog ? (
        <Dialog
          title={`${podRuleDialog.podName} · ${podRuleDialog.screenLabel} 规则`}
          width={860}
          onClose={() => setPodRuleDialog(null)}
          onConfirm={confirmPodRuleDialog}
          confirmText="确定"
        >
          <div className="dialog-form pod-rule-dialog-form">
            <div className={`form-row ${podRuleDialog.isSingleScreen ? "single" : "two"}`}>
              <label className="field">
                <span>循环次数</span>
                <input
                  type="number"
                  min="1"
                  value={podRuleDialog.loopCount}
                  onChange={(event) =>
                    updatePodRuleDialog((current) => ({
                      ...current,
                      loopCount: event.target.value
                    }))
                  }
                />
              </label>

              {!podRuleDialog.isSingleScreen ? (
                <label className="field">
                  <span>组数</span>
                  <input
                    type="number"
                    min="1"
                    value={podRuleDialog.setCount}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updatePodRuleDialog((current) => {
                        const parsedCount = Number(nextValue);
                        return {
                          ...current,
                          setCount: nextValue,
                          setConfigs:
                            Number.isFinite(parsedCount) && parsedCount >= 1
                              ? resizePodRuleSetDrafts(current.setConfigs, Math.floor(parsedCount))
                              : current.setConfigs
                        };
                      });
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div className="pod-rule-dialog-section">
              <strong>工作时间（秒）</strong>
              <div className="pod-rule-grid">
                {podRuleDialog.setConfigs.map((setConfig, setIndex) => (
                  <label key={setConfig.id} className="field">
                    <span>训练 {setIndex + 1}</span>
                    <input
                      type="number"
                      min="1"
                      value={setConfig.workSeconds}
                      onChange={(event) =>
                        updatePodRuleDialog((current) => ({
                          ...current,
                          setConfigs: current.setConfigs.map((item) =>
                            item.id === setConfig.id
                              ? {
                                  ...item,
                                  workSeconds: event.target.value
                                }
                              : item
                          )
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            {!podRuleDialog.isSingleScreen && podRuleDialog.setConfigs.length > 1 ? (
              <div className="pod-rule-dialog-section">
                <strong>组间休息时间（秒）</strong>
                <div className="pod-rule-grid secondary">
                  {podRuleDialog.setConfigs.slice(0, -1).map((setConfig, setIndex) => (
                    <label key={`${setConfig.id}-rest`} className="field">
                      <span>组间休息 {setIndex + 1}</span>
                      <input
                        type="number"
                        min="0"
                        value={setConfig.restSeconds}
                      onChange={(event) =>
                        updatePodRuleDialog((current) => ({
                          ...current,
                          setConfigs: current.setConfigs.map((item) =>
                            item.id === setConfig.id
                              ? {
                                  ...item,
                                  restSeconds: event.target.value
                                }
                              : item
                          )
                        }))
                      }
                    />
                  </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="form-row single">
              <label className="field">
                <span>{podRuleDialog.isSingleScreen ? "休息时间（动作间）（秒）" : "休息时间（换站）（秒）"}</span>
                <input
                  type="number"
                  min="0"
                  value={podRuleDialog.stationRestSeconds}
                  onChange={(event) =>
                    updatePodRuleDialog((current) => ({
                      ...current,
                      stationRestSeconds: event.target.value
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </Dialog>
      ) : null}

      {podCopyDialog ? (
        <Dialog
          title={`${podCopyDialog.podName} · ${podCopyDialog.targetScreenLabel} 复制规则`}
          width={620}
          onClose={() => setPodCopyDialog(null)}
          onConfirm={confirmPodCopyDialog}
          confirmText="复制"
          confirmDisabled={!podCopyDialog.selectedSourceScreenId}
        >
          <div className="dialog-form">
            {podCopyOptions.length ? (
              <div className="copy-screen-options">
                {podCopyOptions.map((screen) => (
                  <button
                    key={screen.id}
                    type="button"
                    className={`copy-screen-option ${podCopyDialog.selectedSourceScreenId === screen.id ? "is-selected" : ""}`}
                    disabled={screen.disabled}
                    onClick={() =>
                      setPodCopyDialog((current) => (current ? { ...current, selectedSourceScreenId: screen.id } : current))
                    }
                  >
                    <strong>{screen.label}</strong>
                    <span>{screen.disabled ? "未编辑，暂不可复制" : `已编辑 · ${formatSecondsStrategy(screen.setConfigs.map((setConfig) => setConfig.workSeconds))}`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyBlock title="没有可复制的屏幕" copy="当前 Pod 还没有其他屏幕规则可供复制。" />
            )}
          </div>
        </Dialog>
      ) : null}

      {podConfigCopyDialog ? (
        <Dialog
          title={`${podConfigCopyDialog.targetPodName} · 复制 Pod 配置`}
          width={640}
          onClose={() => setPodConfigCopyDialog(null)}
          onConfirm={confirmPodConfigCopyDialog}
          confirmText="复制"
          confirmDisabled={!podConfigCopyDialog.selectedSourcePodId}
        >
          <div className="dialog-form">
            {podConfigCopyOptions.length ? (
              <div className="copy-screen-options">
                {podConfigCopyOptions.map((pod) => (
                  <button
                    key={pod.id}
                    type="button"
                    className={`copy-screen-option ${podConfigCopyDialog.selectedSourcePodId === pod.id ? "is-selected" : ""}`}
                    disabled={pod.disabled}
                    onClick={() =>
                      setPodConfigCopyDialog((current) =>
                        current ? { ...current, selectedSourcePodId: pod.id } : current
                      )
                    }
                  >
                    <strong>{pod.label}</strong>
                    <span>{pod.hint}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyBlock title="没有可复制的 Pod" copy="先编辑一个 Pod 的规则，再到其他 Pod 点击“复制 Pod”。" />
            )}
          </div>
        </Dialog>
      ) : null}

      {scheduleDraft ? (
        <Dialog title="添加排课" onClose={() => setScheduleDraft(null)} onConfirm={saveSchedule}>
          <div className="dialog-form">
            <label className="field">
              <span>请选择课程</span>
              <select
                value={scheduleDraft.courseName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  const group = courseGroups[nextName] || [];
                  const first = group[0];
                  updateScheduleDraft((current) => ({
                    ...current,
                    courseName: nextName,
                    courseId: first ? String(first.id) : "",
                    version: first?.version || ""
                  }));
                }}
              >
                <option value="">请选择课程</option>
                {Object.keys(courseGroups).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>请选择版本</span>
              <select
                value={scheduleDraft.courseId}
                onChange={(event) => {
                  const selected = (courseGroups[scheduleDraft.courseName] || []).find(
                    (course) => String(course.id) === event.target.value
                  );
                  updateScheduleDraft((current) => ({
                    ...current,
                    courseId: event.target.value,
                    version: selected?.version || ""
                  }));
                }}
              >
                <option value="">请选择版本</option>
                {(courseGroups[scheduleDraft.courseName] || []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.version}
                  </option>
                ))}
              </select>
            </label>

            <div className="schedule-inline-row">
              <label className="field">
                <span>课程日期</span>
                <input
                  type="date"
                  value={scheduleDraft.date}
                  onChange={(event) => updateScheduleDraft((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>开始时间</span>
                <input
                  type="time"
                  value={scheduleDraft.time}
                  onChange={(event) => updateScheduleDraft((current) => ({ ...current, time: event.target.value }))}
                />
              </label>
            </div>

            <label className="field">
              <span>时长（分钟）</span>
              <input
                type="number"
                min="1"
                value={scheduleDraft.duration}
                onChange={(event) => updateScheduleDraft((current) => ({ ...current, duration: event.target.value }))}
              />
            </label>
          </div>
        </Dialog>
      ) : null}

      {typeDialog ? (
        <Dialog
          title={typeDialog.kind === "action" ? "添加动作分类" : "添加课程分类"}
          width={420}
          onClose={() => setTypeDialog(null)}
          onConfirm={confirmTypeDialog}
          confirmText="保存"
        >
          <div className="dialog-form">
            <label className="field">
              <span>名称</span>
              <input
                value={typeDialog.value}
                onChange={(event) => updateTypeDialog((current) => ({ ...current, value: event.target.value }))}
                placeholder="请输入分类名称"
              />
            </label>
          </div>
        </Dialog>
      ) : null}

      {notice ? <div className={`notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
      {busyText ? <div className="busy-mask">{busyText}</div> : null}
    </div>
  );
}
