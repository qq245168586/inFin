import type {
  ActionRecord,
  CourseRecord,
  CourseScript,
  EffectivePodScreen,
  HorizontalProgress,
  Pod,
  PodScreen,
  TrainingScreenState,
  VideoCard,
  VideoGroup,
  VideoGroupScreen,
  WaterfallItem,
  WaterfallScreenState
} from "./types.ts";

export const SCRIPT_VERTICAL_SCREENS = [1, 2, 3] as const;
export const SIMULATED_VERTICAL_SCREENS = [1, 3, 5] as const;
export const HORIZONTAL_SCREEN = 2;

export function scriptScreenIndexForPhysical(screenNumber: number): number {
  if (screenNumber === 1) return 1;
  if (screenNumber === 3) return 2;
  if (screenNumber === 5) return 3;
  return screenNumber;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeSeconds(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMediaUrl(url: unknown): string {
  const raw = text(url);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const current = globalThis.location;
      if (
        current?.origin &&
        (parsed.host === current.host || parsed.hostname === "8.130.65.113" || parsed.hostname === "course.infintraining.work")
      ) {
        return `${current.origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  if (raw.startsWith("//")) {
    return `${globalThis.location?.protocol || "https:"}${raw}`;
  }
  if (raw.startsWith("/")) {
    return raw;
  }
  return raw.startsWith("api/") ? `/${raw}` : `/api/${raw}`;
}

function mediaRecordUrl(media: ActionRecord["media"]): string {
  if (!media) return "";
  if (media.url || media.path) return normalizeMediaUrl(media.url || media.path);
  return media.filename ? normalizeMediaUrl(`/api/media/${media.filename}`) : "";
}

function scriptOf(course: CourseRecord | null): CourseScript {
  return course?.script || {};
}

export function formatClock(totalSeconds: number): string {
  const safeTotal = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function withResolvedMedia(course: CourseRecord, actions: ActionRecord[]): CourseRecord {
  const next = clone(course);
  const actionMedia = new Map(
    actions.map((action) => [
      String(action.id),
      mediaRecordUrl(action.media)
    ])
  );
  const resolveUrl = (actionId?: string, fallback = "") => normalizeMediaUrl(actionMedia.get(String(actionId || "")) || fallback);
  const script = next.script || {};

  if (script.sections?.warmup?.items) {
    script.sections.warmup.items = script.sections.warmup.items.map((item) => ({
      ...item,
      mediaUrl: resolveUrl(item.actionId, item.mediaUrl)
    }));
  }

  if (script.sections?.cooldown?.items) {
    script.sections.cooldown.items = script.sections.cooldown.items.map((item) => ({
      ...item,
      mediaUrl: resolveUrl(item.actionId, item.mediaUrl)
    }));
  }

  if (script.training?.videoGroups) {
    script.training.videoGroups = script.training.videoGroups.map((group) => ({
      ...group,
      screens: (group.screens || []).map((screen) => ({
        ...screen,
        videoCards: (screen.videoCards || []).map((card) => ({
          ...card,
          mediaUrl: resolveUrl(card.actionId, card.mediaUrl)
        }))
      }))
    }));
  }

  next.script = script;
  return next;
}

function waterfallItems(section?: { items?: WaterfallItem[] }): WaterfallItem[] {
  return (section?.items || []).filter((item) => text(item.actionId) || text(item.actionName) || text(item.mediaUrl));
}

export function getWaterfallDurationSeconds(items: WaterfallItem[]): number {
  return items.reduce((total, item) => total + safeSeconds(item.seconds), 0);
}

export function getWarmupDurationSeconds(course: CourseRecord | null): number {
  return getWaterfallDurationSeconds(waterfallItems(scriptOf(course).sections?.warmup));
}

export function getCooldownDurationSeconds(course: CourseRecord | null): number {
  return getWaterfallDurationSeconds(waterfallItems(scriptOf(course).sections?.cooldown));
}

export function getDefaultHydrateSeconds(course: CourseRecord | null): number {
  return safeSeconds(scriptOf(course).metadata?.defaultHydrateSeconds);
}

function findVideoGroup(course: CourseRecord | null, videoGroupId?: string): VideoGroup | null {
  return scriptOf(course).training?.videoGroups?.find((group) => text(group.id) === text(videoGroupId)) || null;
}

function normalizeRows(rowLayouts?: number[], fallbackCount = 3): number[] {
  const rows = (rowLayouts || []).map((columns) => (Number(columns) === 2 ? 2 : 1)).filter(Boolean);
  return rows.length ? rows.slice(0, 5) : Array.from({ length: fallbackCount }, () => 1);
}

function filterPlayableCards(cards?: VideoCard[]): VideoCard[] {
  return (cards || []).filter((card) => text(card.actionId) || text(card.actionName) || text(card.mediaUrl));
}

function effectiveSetConfigs(rule: PodScreen | null): Array<{ workSeconds: number; restSeconds: number }> {
  const setConfigs = rule?.setConfigs?.length ? rule.setConfigs : [{ workSeconds: 0, restSeconds: 0 }];
  return setConfigs.map((setConfig, index) => ({
    workSeconds: safeSeconds(setConfig.workSeconds),
    restSeconds: index === setConfigs.length - 1 ? 0 : safeSeconds(setConfig.restSeconds)
  }));
}

function normalizeRule(rule: PodScreen | null, screenIndex: number): EffectivePodScreen["rule"] {
  return {
    screenIndex: rule?.screenIndex || screenIndex,
    loopCount: Math.max(1, safeSeconds(rule?.loopCount, 1)),
    stationRestSeconds: safeSeconds(rule?.stationRestSeconds),
    setConfigs: effectiveSetConfigs(rule)
  };
}

function findGroupScreen(group: VideoGroup | null, screenIndex: number): VideoGroupScreen | null {
  return group?.screens?.find((screen) => Number(screen.screenIndex) === Number(screenIndex)) || null;
}

function findPodScreen(pod: Pod | null, screenIndex: number): PodScreen | null {
  return pod?.screens?.find((screen) => Number(screen.screenIndex) === Number(screenIndex)) || null;
}

export function materializePodScreen(course: CourseRecord | null, pod: Pod | null, screenIndex: number): EffectivePodScreen | null {
  const group = findVideoGroup(course, pod?.videoGroupId);
  if (!pod || !group) return null;

  if (Number(group.screenCount || 1) <= 1) {
    const sourceScreen = group.screens?.[0] || null;
    const rule = pod.screens?.[0] || null;
    return {
      displayScreenIndex: screenIndex,
      rule: normalizeRule(rule, screenIndex),
      sourceScreen,
      videoCards: filterPlayableCards(sourceScreen?.videoCards),
      rowLayouts: normalizeRows(sourceScreen?.rowLayouts, 1),
      waterfallLayout: true
    };
  }

  const sourceScreen = findGroupScreen(group, screenIndex);
  const rule = findPodScreen(pod, screenIndex);
  if (!sourceScreen || !rule) return null;
  return {
    displayScreenIndex: screenIndex,
    rule: normalizeRule(rule, screenIndex),
    sourceScreen,
    videoCards: filterPlayableCards(sourceScreen.videoCards),
    rowLayouts: normalizeRows(sourceScreen.rowLayouts),
    waterfallLayout: false
  };
}

export function materializeProgressPodScreen(course: CourseRecord | null, pod: Pod | null): EffectivePodScreen | null {
  const group = findVideoGroup(course, pod?.videoGroupId);
  if (!group || !pod) return null;
  if (Number(group.screenCount || 1) <= 1) {
    return materializePodScreen(course, pod, 1);
  }

  let best: EffectivePodScreen | null = null;
  let bestWorkSegments = -1;
  for (const screenIndex of SCRIPT_VERTICAL_SCREENS) {
    const candidate = materializePodScreen(course, pod, screenIndex);
    const workSegments = countHorizontalProgressWorkSegments(pod, candidate);
    if (candidate && workSegments > bestWorkSegments) {
      best = candidate;
      bestWorkSegments = workSegments;
    }
  }
  return best;
}

export function getPodEndingDurationSeconds(course: CourseRecord | null, pod: Pod | null): number {
  const ending = text(pod?.ending).toUpperCase();
  if (ending === "HYDRATE" || ending === "MOVE_ZONE") {
    const podEndingSeconds = Number(pod?.endingSeconds);
    if (pod?.endingSeconds !== undefined && Number.isFinite(podEndingSeconds)) {
      return Math.max(0, Math.floor(podEndingSeconds));
    }
    return getDefaultHydrateSeconds(course);
  }
  return 0;
}

export function getPodScreenDurationSeconds(pod: Pod | null, effectiveScreen: EffectivePodScreen | null): number {
  if (!pod || !effectiveScreen?.videoCards.length) return 0;
  const setConfigs = effectiveScreen.rule.setConfigs;
  const loopCount = Math.max(effectiveScreen.rule.loopCount, 1);
  const stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
  let duration = 0;

  if (!effectiveScreen.waterfallLayout) {
    if (text(pod.stationFlow).toUpperCase() === "SWITCH" && effectiveScreen.videoCards.length >= 2) {
      for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
        for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
          const setConfig = setConfigs[setIndex];
          duration += safeSeconds(setConfig.workSeconds) * 2;
          duration += stationRestSeconds;
          if (setIndex < setConfigs.length - 1) {
            duration += safeSeconds(setConfig.restSeconds);
          }
        }
        if (loopIndex < loopCount - 1) {
          duration += stationRestSeconds;
        }
      }
      return duration;
    }

    for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
      for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
        const setConfig = setConfigs[setIndex];
        duration += safeSeconds(setConfig.workSeconds);
        if (setIndex < setConfigs.length - 1) {
          duration += safeSeconds(setConfig.restSeconds);
        }
      }
      if (loopIndex < loopCount - 1) {
        duration += stationRestSeconds;
      }
    }
    return duration;
  }

  const totalActions = effectiveScreen.videoCards.length * loopCount;
  for (let actionIndex = 0; actionIndex < totalActions; actionIndex += 1) {
    for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
      const setConfig = setConfigs[setIndex];
      duration += safeSeconds(setConfig.workSeconds);
      if (setIndex < setConfigs.length - 1) {
        duration += safeSeconds(setConfig.restSeconds);
      }
    }
    if (actionIndex < totalActions - 1) {
      duration += stationRestSeconds;
    }
  }
  return duration;
}

export function getTrainingTotalSeconds(course: CourseRecord | null, includeEnding = true): number {
  return (scriptOf(course).training?.pods || []).reduce((total, pod) => {
    const podDuration = getPodScreenDurationSeconds(pod, materializeProgressPodScreen(course, pod));
    return total + podDuration + (includeEnding ? getPodEndingDurationSeconds(course, pod) : 0);
  }, 0);
}

export function getCourseTotalSeconds(course: CourseRecord | null): number {
  return getWarmupDurationSeconds(course) + getTrainingTotalSeconds(course, true) + getCooldownDurationSeconds(course);
}

export function buildWaterfallScreenState(items: WaterfallItem[], sectionTitle: string, elapsedSeconds: number): WaterfallScreenState {
  let cursor = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const duration = safeSeconds(item.seconds);
    if (elapsedSeconds < cursor + duration) {
      return {
        sectionTitle,
        items,
        activeIndex: index,
        remainingSeconds: Math.max(cursor + duration - elapsedSeconds, 0),
        cue: text(item.cue)
      };
    }
    cursor += duration;
  }
  return {
    sectionTitle,
    items,
    activeIndex: Math.max(items.length - 1, 0),
    remainingSeconds: 0,
    cue: ""
  };
}

function emptyTrainingState(podName = "TRAINING", mode: TrainingScreenState["mode"] = "empty"): TrainingScreenState {
  return {
    mode,
    stageLabel: "TRAINING",
    stageProgress: "",
    hintText: "",
    remainingSeconds: 0,
    displayCards: [],
    activeCardIndex: -1,
    playActiveCard: false,
    rowLayouts: [],
    transitionType: "",
    stageSecondaryText: "",
    completedDots: 0,
    totalDots: 0,
    podName
  };
}

function stationTrainingHint(roundIndex: number, totalRounds: number, setIndex: number, totalSets: number): string {
  return `TRAINING · ROUND ${roundIndex}/${totalRounds} · SET ${setIndex}/${totalSets}`;
}

function buildStationState(pod: Pod, screen: EffectivePodScreen, elapsedSeconds: number): TrainingScreenState {
  const setConfigs = screen.rule.setConfigs;
  const loopCount = Math.max(screen.rule.loopCount, 1);
  const stationRestSeconds = Math.max(screen.rule.stationRestSeconds, 0);
  let cursor = 0;

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
      const setConfig = setConfigs[setIndex];
      const workSeconds = safeSeconds(setConfig.workSeconds);
      if (workSeconds > 0 && elapsedSeconds < cursor + workSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "station"),
          stageLabel: "REMAINING",
          stageProgress: "WORK",
          hintText: stationTrainingHint(loopIndex + 1, loopCount, setIndex + 1, setConfigs.length),
          remainingSeconds: cursor + workSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          activeCardIndex: -1,
          playActiveCard: true,
          rowLayouts: screen.rowLayouts,
          stageSecondaryText: `SET ${setIndex + 1}`
        };
      }
      cursor += workSeconds;

      const hasNextSet = setIndex < setConfigs.length - 1;
      const restSeconds = safeSeconds(setConfig.restSeconds);
      if (hasNextSet && restSeconds > 0 && elapsedSeconds < cursor + restSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "transition"),
          stageLabel: "REMAINING",
          stageProgress: "REST",
          remainingSeconds: cursor + restSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          rowLayouts: screen.rowLayouts,
          transitionType: "REST",
          completedDots: setIndex + 1,
          totalDots: setConfigs.length
        };
      }
      if (hasNextSet) cursor += restSeconds;
    }

    const hasNextLoop = loopIndex < loopCount - 1;
    if (hasNextLoop && stationRestSeconds > 0 && elapsedSeconds < cursor + stationRestSeconds) {
      return {
        ...emptyTrainingState(text(pod.name), "transition"),
        stageLabel: "REMAINING",
        stageProgress: "MOVE STATION",
        remainingSeconds: cursor + stationRestSeconds - elapsedSeconds,
        displayCards: screen.videoCards,
        rowLayouts: screen.rowLayouts,
        transitionType: "MOVE_STATION"
      };
    }
    if (hasNextLoop) cursor += stationRestSeconds;
  }

  return {
    ...emptyTrainingState(text(pod.name), "station"),
    displayCards: screen.videoCards,
    rowLayouts: screen.rowLayouts
  };
}

function buildWaterfallPodState(pod: Pod, screen: EffectivePodScreen, elapsedSeconds: number): TrainingScreenState {
  if (!screen.videoCards.length) return emptyTrainingState(text(pod.name), "waterfall");
  const loopCount = Math.max(screen.rule.loopCount, 1);
  const actionSequence = Array.from({ length: loopCount }, () => screen.videoCards).flat();
  const workSeconds = safeSeconds(screen.rule.setConfigs[0]?.workSeconds);
  const stationRestSeconds = Math.max(screen.rule.stationRestSeconds, 0);
  const actionCountPerLoop = Math.max(screen.videoCards.length, 1);
  let cursor = 0;

  for (let actionIndex = 0; actionIndex < actionSequence.length; actionIndex += 1) {
    const currentCard = actionSequence[actionIndex];
    const roundIndex = Math.floor(actionIndex / actionCountPerLoop) + 1;
    if (workSeconds > 0 && elapsedSeconds < cursor + workSeconds) {
      return {
        ...emptyTrainingState(text(pod.name), "waterfall"),
        stageLabel: "REMAINING",
        stageProgress: "WORK",
        hintText: `TRAINING · ${text(currentCard.actionName) || "ACTION"} · ROUND ${roundIndex}/${loopCount}`,
        remainingSeconds: cursor + workSeconds - elapsedSeconds,
        displayCards: actionSequence,
        activeCardIndex: actionIndex,
        playActiveCard: true,
        rowLayouts: [1]
      };
    }
    cursor += workSeconds;

    const hasNextAction = actionIndex < actionSequence.length - 1;
    if (hasNextAction && stationRestSeconds > 0 && elapsedSeconds < cursor + stationRestSeconds) {
      return {
        ...emptyTrainingState(text(pod.name), "waterfall"),
        stageLabel: "REMAINING",
        stageProgress: "REST",
        hintText: "TRAINING · REST",
        remainingSeconds: cursor + stationRestSeconds - elapsedSeconds,
        displayCards: actionSequence,
        activeCardIndex: actionIndex + 1,
        playActiveCard: false,
        rowLayouts: [1],
        transitionType: "REST"
      };
    }
    if (hasNextAction) cursor += stationRestSeconds;
  }

  return {
    ...emptyTrainingState(text(pod.name), "waterfall"),
    displayCards: actionSequence,
    activeCardIndex: Math.max(actionSequence.length - 1, 0),
    rowLayouts: [1]
  };
}

function buildSwitchState(pod: Pod, screen: EffectivePodScreen, elapsedSeconds: number): TrainingScreenState {
  if (screen.videoCards.length < 2) return buildStationState(pod, screen, elapsedSeconds);
  const setConfigs = screen.rule.setConfigs;
  const loopCount = Math.max(screen.rule.loopCount, 1);
  const pairCount = Math.floor(screen.videoCards.length / 2);
  const stationRestSeconds = Math.max(screen.rule.stationRestSeconds, 0);
  let cursor = 0;

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    const pairIndex = loopIndex % pairCount;
    const cardAIndex = pairIndex * 2;
    const cardBIndex = cardAIndex + 1;

    for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
      const setConfig = setConfigs[setIndex];
      const workSeconds = safeSeconds(setConfig.workSeconds);
      if (workSeconds > 0 && elapsedSeconds < cursor + workSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "station"),
          stageLabel: "REMAINING",
          stageProgress: "WORK",
          hintText: `TRAINING · SWITCH A · ROUND ${loopIndex + 1}/${loopCount} · PAIR ${pairIndex + 1}/${pairCount}`,
          remainingSeconds: cursor + workSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          activeCardIndex: cardAIndex,
          playActiveCard: true,
          rowLayouts: screen.rowLayouts,
          stageSecondaryText: `SET ${setIndex + 1}/${setConfigs.length}`,
          completedDots: setIndex * 2 + 1,
          totalDots: setConfigs.length * 2
        };
      }
      cursor += workSeconds;

      if (stationRestSeconds > 0 && elapsedSeconds < cursor + stationRestSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "transition"),
          stageLabel: "REMAINING",
          stageProgress: "SWITCH",
          remainingSeconds: cursor + stationRestSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          activeCardIndex: cardBIndex,
          rowLayouts: screen.rowLayouts,
          transitionType: "SWITCH",
          completedDots: setIndex * 2 + 1,
          totalDots: setConfigs.length * 2
        };
      }
      cursor += stationRestSeconds;

      if (workSeconds > 0 && elapsedSeconds < cursor + workSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "station"),
          stageLabel: "REMAINING",
          stageProgress: "WORK",
          hintText: `TRAINING · SWITCH B · ROUND ${loopIndex + 1}/${loopCount} · PAIR ${pairIndex + 1}/${pairCount}`,
          remainingSeconds: cursor + workSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          activeCardIndex: cardBIndex,
          playActiveCard: true,
          rowLayouts: screen.rowLayouts,
          stageSecondaryText: `SET ${setIndex + 1}/${setConfigs.length}`,
          completedDots: setIndex * 2 + 2,
          totalDots: setConfigs.length * 2
        };
      }
      cursor += workSeconds;

      const hasNextSet = setIndex < setConfigs.length - 1;
      const restSeconds = safeSeconds(setConfig.restSeconds);
      if (hasNextSet && restSeconds > 0 && elapsedSeconds < cursor + restSeconds) {
        return {
          ...emptyTrainingState(text(pod.name), "transition"),
          stageLabel: "REMAINING",
          stageProgress: "SWITCH",
          remainingSeconds: cursor + restSeconds - elapsedSeconds,
          displayCards: screen.videoCards,
          activeCardIndex: cardAIndex,
          rowLayouts: screen.rowLayouts,
          transitionType: "SWITCH",
          completedDots: Math.min(setIndex * 2 + 2, setConfigs.length * 2),
          totalDots: setConfigs.length * 2
        };
      }
      if (hasNextSet) cursor += restSeconds;
    }

    const hasNextPairRound = loopIndex < loopCount - 1;
    if (hasNextPairRound && stationRestSeconds > 0 && elapsedSeconds < cursor + stationRestSeconds) {
      const nextPairIndex = (loopIndex + 1) % pairCount;
      return {
        ...emptyTrainingState(text(pod.name), "transition"),
        stageLabel: "REMAINING",
        stageProgress: "MOVE STATION",
        remainingSeconds: cursor + stationRestSeconds - elapsedSeconds,
        displayCards: screen.videoCards,
        activeCardIndex: nextPairIndex * 2,
        rowLayouts: screen.rowLayouts,
        transitionType: "MOVE_STATION",
        completedDots: setConfigs.length * 2,
        totalDots: setConfigs.length * 2
      };
    }
    if (hasNextPairRound) cursor += stationRestSeconds;
  }

  return {
    ...emptyTrainingState(text(pod.name), "station"),
    displayCards: screen.videoCards,
    rowLayouts: screen.rowLayouts
  };
}

function buildPodRunningState(pod: Pod, screen: EffectivePodScreen | null, elapsedSeconds: number): TrainingScreenState {
  if (!screen) return emptyTrainingState(text(pod.name));
  if (screen.waterfallLayout) return buildWaterfallPodState(pod, screen, elapsedSeconds);
  if (text(pod.stationFlow).toUpperCase() === "SWITCH") return buildSwitchState(pod, screen, elapsedSeconds);
  return buildStationState(pod, screen, elapsedSeconds);
}

function buildPodEndingState(course: CourseRecord | null, pod: Pod, currentScreen: EffectivePodScreen | null, nextScreen: EffectivePodScreen | null, endingElapsedSeconds: number): TrainingScreenState {
  const ending = text(pod.ending).toUpperCase() === "MOVE_ZONE" ? "MOVE_ZONE" : "HYDRATE";
  const duration = getPodEndingDurationSeconds(course, pod);
  const previewScreen = nextScreen || currentScreen;
  return {
    ...emptyTrainingState(text(pod.name), "transition"),
    stageLabel: "REMAINING",
    stageProgress: ending === "MOVE_ZONE" ? "MOVE ZONE" : "HYDRATE",
    remainingSeconds: Math.max(duration - endingElapsedSeconds, 0),
    displayCards: previewScreen?.videoCards || [],
    activeCardIndex: previewScreen?.waterfallLayout ? 0 : -1,
    rowLayouts: previewScreen?.rowLayouts || [],
    transitionType: ending
  };
}

export function buildTrainingScreenState(course: CourseRecord | null, screenIndex: number, trainingElapsedSeconds: number): TrainingScreenState | null {
  const pods = scriptOf(course).training?.pods || [];
  let cursor = 0;

  for (let podIndex = 0; podIndex < pods.length; podIndex += 1) {
    const pod = pods[podIndex];
    const displayScreen = materializePodScreen(course, pod, screenIndex);
    const group = findVideoGroup(course, pod.videoGroupId);
    const displayHasActions = Boolean(displayScreen?.videoCards.length);
    const effectiveScreen = !displayHasActions && group && Number(group.screenCount || 1) > 1 ? materializeProgressPodScreen(course, pod) : displayScreen;
    const podDuration = getPodScreenDurationSeconds(pod, effectiveScreen);
    const nextPod = pods[podIndex + 1] || null;
    const nextScreen = nextPod ? materializePodScreen(course, nextPod, screenIndex) : null;

    if (trainingElapsedSeconds < cursor + podDuration) {
      const state = buildPodRunningState(pod, effectiveScreen, trainingElapsedSeconds - cursor);
      if (!displayHasActions && effectiveScreen?.videoCards.length) {
        return {
          ...state,
          mode: "transition",
          displayCards: [],
          activeCardIndex: -1,
          playActiveCard: false,
          transitionType: state.transitionType || state.stageProgress || "WORK"
        };
      }
      return state;
    }
    cursor += podDuration;

    const endingDuration = getPodEndingDurationSeconds(course, pod);
    if (endingDuration > 0 && trainingElapsedSeconds < cursor + endingDuration) {
      return buildPodEndingState(course, pod, displayScreen, nextScreen, trainingElapsedSeconds - cursor);
    }
    cursor += endingDuration;
  }

  return null;
}

export function buildPreviewTrainingState(course: CourseRecord | null, screenIndex: number): TrainingScreenState | null {
  const firstPod = scriptOf(course).training?.pods?.[0] || null;
  if (!firstPod) return null;
  const screen = materializePodScreen(course, firstPod, screenIndex) || materializeProgressPodScreen(course, firstPod);
  if (!screen) return null;
  return {
    ...emptyTrainingState(text(firstPod.name), screen.waterfallLayout ? "waterfall" : "station"),
    stageLabel: "PREVIEW",
    stageProgress: "READY",
    hintText: "COURSE PREVIEW",
    displayCards: screen.videoCards,
    activeCardIndex: screen.waterfallLayout ? 0 : -1,
    rowLayouts: screen.rowLayouts
  };
}

export function buildCourseStage(course: CourseRecord | null, elapsedSeconds: number): { stage: "warmup" | "training" | "cooldown" | "finished"; offsetSeconds: number } {
  const warmupDuration = getWarmupDurationSeconds(course);
  if (elapsedSeconds < warmupDuration) return { stage: "warmup", offsetSeconds: elapsedSeconds };

  const trainingDuration = getTrainingTotalSeconds(course, true);
  const trainingElapsed = elapsedSeconds - warmupDuration;
  if (trainingElapsed < trainingDuration) return { stage: "training", offsetSeconds: trainingElapsed };

  const cooldownElapsed = trainingElapsed - trainingDuration;
  const cooldownDuration = getCooldownDurationSeconds(course);
  if (cooldownElapsed < cooldownDuration) return { stage: "cooldown", offsetSeconds: cooldownElapsed };

  return { stage: "finished", offsetSeconds: 0 };
}

function countHorizontalProgressWorkSegments(pod: Pod | null, screen: EffectivePodScreen | null): number {
  if (!pod || !screen?.videoCards.length) return 0;
  const positiveWorkSetCount = screen.rule.setConfigs.filter((setConfig) => safeSeconds(setConfig.workSeconds) > 0).length;
  if (positiveWorkSetCount <= 0) return 0;
  const loopCount = Math.max(screen.rule.loopCount, 1);
  if (text(pod.stationFlow).toUpperCase() === "SWITCH" && screen.videoCards.length >= 2) {
    return loopCount * positiveWorkSetCount * 2;
  }
  if (screen.waterfallLayout) {
    return screen.videoCards.length * loopCount * positiveWorkSetCount;
  }
  return loopCount * positiveWorkSetCount;
}

function addHorizontalWorkTimings(timings: Array<{ realStartSeconds: number; workStartSeconds: number; durationSeconds: number; markerAfter?: boolean }>, pod: Pod, screen: EffectivePodScreen | null, realPodOffsetSeconds: number, workOffsetSeconds: number): number {
  if (!screen?.videoCards.length) return workOffsetSeconds;
  const setConfigs = screen.rule.setConfigs;
  const loopCount = Math.max(screen.rule.loopCount, 1);
  const stationRestSeconds = Math.max(screen.rule.stationRestSeconds, 0);
  let screenOffsetSeconds = 0;

  if (text(pod.stationFlow).toUpperCase() === "SWITCH" && screen.videoCards.length >= 2) {
    for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
      for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
        const setConfig = setConfigs[setIndex];
        const workSeconds = safeSeconds(setConfig.workSeconds);
        if (workSeconds > 0) {
          timings.push({ realStartSeconds: realPodOffsetSeconds + screenOffsetSeconds, workStartSeconds: workOffsetSeconds, durationSeconds: workSeconds });
          workOffsetSeconds += workSeconds;
        }
        screenOffsetSeconds += workSeconds + stationRestSeconds;
        if (workSeconds > 0) {
          timings.push({ realStartSeconds: realPodOffsetSeconds + screenOffsetSeconds, workStartSeconds: workOffsetSeconds, durationSeconds: workSeconds });
          workOffsetSeconds += workSeconds;
        }
        screenOffsetSeconds += workSeconds;
        if (setIndex < setConfigs.length - 1) screenOffsetSeconds += safeSeconds(setConfig.restSeconds);
      }
      if (loopIndex < loopCount - 1) screenOffsetSeconds += stationRestSeconds;
    }
    return workOffsetSeconds;
  }

  if (screen.waterfallLayout) {
    const actionSequenceLength = screen.videoCards.length * loopCount;
    for (let actionIndex = 0; actionIndex < actionSequenceLength; actionIndex += 1) {
      for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
        const setConfig = setConfigs[setIndex];
        const workSeconds = safeSeconds(setConfig.workSeconds);
        if (workSeconds > 0) {
          timings.push({ realStartSeconds: realPodOffsetSeconds + screenOffsetSeconds, workStartSeconds: workOffsetSeconds, durationSeconds: workSeconds });
          workOffsetSeconds += workSeconds;
        }
        screenOffsetSeconds += workSeconds;
        if (setIndex < setConfigs.length - 1) screenOffsetSeconds += safeSeconds(setConfig.restSeconds);
      }
      if (actionIndex < actionSequenceLength - 1) screenOffsetSeconds += stationRestSeconds;
    }
    return workOffsetSeconds;
  }

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    for (let setIndex = 0; setIndex < setConfigs.length; setIndex += 1) {
      const setConfig = setConfigs[setIndex];
      const workSeconds = safeSeconds(setConfig.workSeconds);
      if (workSeconds > 0) {
        timings.push({ realStartSeconds: realPodOffsetSeconds + screenOffsetSeconds, workStartSeconds: workOffsetSeconds, durationSeconds: workSeconds });
        workOffsetSeconds += workSeconds;
      }
      screenOffsetSeconds += workSeconds;
      if (setIndex < setConfigs.length - 1) screenOffsetSeconds += safeSeconds(setConfig.restSeconds);
    }
    if (loopIndex < loopCount - 1) screenOffsetSeconds += stationRestSeconds;
  }
  return workOffsetSeconds;
}

function buildHorizontalWorkTimings(course: CourseRecord | null) {
  const timings: Array<{ realStartSeconds: number; workStartSeconds: number; durationSeconds: number; markerAfter?: boolean }> = [];
  let realTrainingOffsetSeconds = 0;
  let workOffsetSeconds = 0;

  for (const pod of scriptOf(course).training?.pods || []) {
    const firstIndex = timings.length;
    const screen = materializeProgressPodScreen(course, pod);
    workOffsetSeconds = addHorizontalWorkTimings(timings, pod, screen, realTrainingOffsetSeconds, workOffsetSeconds);
    const endingDuration = getPodEndingDurationSeconds(course, pod);
    if (endingDuration > 0 && timings.length > firstIndex) {
      timings[timings.length - 1].markerAfter = true;
    }
    realTrainingOffsetSeconds += getPodScreenDurationSeconds(pod, screen) + endingDuration;
  }
  return timings;
}

export function buildHorizontalProgress(course: CourseRecord | null, courseElapsedSeconds: number): HorizontalProgress {
  const warmupDuration = getWarmupDurationSeconds(course);
  const trainingElapsed = Math.max(0, courseElapsedSeconds - warmupDuration);
  const workTimings = buildHorizontalWorkTimings(course);
  const workTotalSeconds = workTimings.reduce((total, timing) => total + timing.durationSeconds, 0);
  const workElapsedSeconds = resolveWorkElapsedSeconds(workTimings, trainingElapsed);
  return {
    formalElapsedSeconds: resolveFormalTrainingElapsedSeconds(course, trainingElapsed),
    formalTotalSeconds: getTrainingTotalSeconds(course, false),
    workElapsedSeconds,
    workTotalSeconds,
    workSegments: workTimings.map((timing) => ({
      workStartSeconds: timing.workStartSeconds,
      durationSeconds: timing.durationSeconds,
      markerAfter: timing.markerAfter
    }))
  };
}

function resolveWorkElapsedSeconds(timings: Array<{ realStartSeconds: number; workStartSeconds: number; durationSeconds: number }>, elapsedSeconds: number): number {
  let workElapsedSeconds = 0;
  for (const timing of timings) {
    if (elapsedSeconds < timing.realStartSeconds) return workElapsedSeconds;
    const realEndSeconds = timing.realStartSeconds + timing.durationSeconds;
    if (elapsedSeconds < realEndSeconds) {
      return timing.workStartSeconds + Math.max(elapsedSeconds - timing.realStartSeconds, 0);
    }
    workElapsedSeconds = timing.workStartSeconds + timing.durationSeconds;
  }
  return workElapsedSeconds;
}

export function resolveFormalTrainingElapsedSeconds(course: CourseRecord | null, trainingElapsedSeconds: number): number {
  let realTrainingOffsetSeconds = 0;
  let formalTrainingElapsedSeconds = 0;
  for (const pod of scriptOf(course).training?.pods || []) {
    const screen = materializeProgressPodScreen(course, pod);
    const podDuration = getPodScreenDurationSeconds(pod, screen);
    const podEndSeconds = realTrainingOffsetSeconds + podDuration;
    if (trainingElapsedSeconds < podEndSeconds) {
      return formalTrainingElapsedSeconds + Math.max(trainingElapsedSeconds - realTrainingOffsetSeconds, 0);
    }
    formalTrainingElapsedSeconds += podDuration;
    realTrainingOffsetSeconds = podEndSeconds;

    const endingDuration = getPodEndingDurationSeconds(course, pod);
    const endingEndSeconds = realTrainingOffsetSeconds + endingDuration;
    if (trainingElapsedSeconds < endingEndSeconds) {
      return formalTrainingElapsedSeconds;
    }
    realTrainingOffsetSeconds = endingEndSeconds;
  }
  return formalTrainingElapsedSeconds;
}

export function getWarmupState(course: CourseRecord | null, elapsedSeconds: number): WaterfallScreenState {
  return buildWaterfallScreenState(waterfallItems(scriptOf(course).sections?.warmup), scriptOf(course).sections?.warmup?.title || "WARM UP", elapsedSeconds);
}

export function getCooldownState(course: CourseRecord | null, elapsedSeconds: number): WaterfallScreenState {
  return buildWaterfallScreenState(waterfallItems(scriptOf(course).sections?.cooldown), scriptOf(course).sections?.cooldown?.title || "COOL DOWN", elapsedSeconds);
}
