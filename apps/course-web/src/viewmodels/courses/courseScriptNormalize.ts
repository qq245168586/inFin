import type {
  CourseRotationType,
  CourseScript,
  StationRuleConfig,
  PodScreen,
  PodStationFlow,
  VideoCard,
  VideoGroup,
  VideoGroupScreenCount,
  VideoRowLayout
} from "../../models/course/types.ts";
import {
  cloneCoursePlanForEditor,
  cloneWaterfallSectionForEditor,
  createCoursePlan,
  createReadyDurations,
  createTrainingPanel,
  createVideoCard,
  createVideoGroup,
  createWaterfallSection
} from "../../models/course/factories.ts";
import { cloneDeep } from "../../utils/cloneDeep.ts";
import { stationInputValue } from "../../utils/station.ts";
import { uid } from "../../utils/uid.ts";
import { readNonNegativeNumber } from "../../utils/number.ts";
import { getVideoRowCapacity, normalizeVideoRowLayouts } from "../../models/course/videoRows.ts";
import { createPod, createPodScreensFromGroup, rebalancePodEndings } from "./podGraph.ts";

function normalizeRotationType(value: unknown): CourseRotationType {
  return value === "LANE" || value === "SNAKE" || value === "REGION" ? value : "REGION";
}

function normalizeStationRuleConfig(value: unknown): StationRuleConfig {
  const source = value && typeof value === "object" ? (value as Partial<StationRuleConfig>) : {};
  return {
    set: typeof source.set === "string" ? source.set : "",
    work: typeof source.work === "string" ? source.work : "",
    rest: typeof source.rest === "string" ? source.rest : "",
    switch: typeof source.switch === "string" ? source.switch : "",
    port: typeof source.port === "string" ? source.port : "",
    leader: typeof source.leader === "string" ? source.leader : ""
  };
}

function hasStationRuleValues(config: StationRuleConfig): boolean {
  return Boolean(config.set || config.work || config.rest || config.switch || config.port || config.leader);
}

function formatSecondsList(values: number[]): string {
  return values.length ? values.map((seconds) => `${seconds}s`).join("/") : "";
}

function addUniquePositiveSeconds(values: number[], value: unknown) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0 && !values.includes(seconds)) {
    values.push(seconds);
  }
}

function deriveSwitchRule(rotationType: CourseRotationType): string {
  if (rotationType === "LANE") {
    return "range";
  }
  if (rotationType === "SNAKE") {
    return "follow the leader";
  }
  return "pod";
}

function deriveStationRuleConfig(script: CourseScript): StationRuleConfig {
  const videoGroupMap = new Map((script.training?.videoGroups || []).map((group) => [group.id, group]));
  const threeScreenPods = (script.training?.pods || []).filter((pod) => videoGroupMap.get(pod.videoGroupId)?.screenCount === 3);
  const workSeconds: number[] = [];
  const restSeconds: number[] = [];

  const setCount = threeScreenPods.reduce((total, pod) => {
    const screens = pod.screens || [];
    const firstScreen = screens.find((screen) => screen.screenIndex === 1) || screens[0];
    for (const screen of screens) {
      addUniquePositiveSeconds(restSeconds, screen.stationRestSeconds);
      for (const setConfig of screen.setConfigs || []) {
        addUniquePositiveSeconds(workSeconds, setConfig.workSeconds);
        addUniquePositiveSeconds(restSeconds, setConfig.restSeconds);
      }
    }
    return total + Math.max(Number(firstScreen?.loopCount) || 0, 0);
  }, 0);

  return {
    set: setCount > 0 ? String(setCount) : "",
    work: formatSecondsList(workSeconds),
    rest: formatSecondsList(restSeconds),
    switch: deriveSwitchRule(normalizeRotationType(script.metadata?.rotationType)),
    port: "",
    leader: ""
  };
}

function normalizeOrDeriveStationRuleConfig(value: unknown, script: CourseScript): StationRuleConfig {
  const config = normalizeStationRuleConfig(value);
  return hasStationRuleValues(config) ? config : deriveStationRuleConfig(script);
}

function fitVideoCardsForRows(
  cards: VideoCard[],
  rowLayouts: VideoRowLayout[],
  screenCount: VideoGroupScreenCount
): VideoCard[] {
  if (screenCount === 1) {
    return cards.length ? cards : [createVideoCard()];
  }

  const capacity = getVideoRowCapacity(rowLayouts);
  const nextCards = cards.slice(0, capacity);
  while (nextCards.length < capacity) {
    nextCards.push(createVideoCard());
  }
  return nextCards;
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

export function createEmptyCourseScript(): CourseScript {
  const defaultGroup = createVideoGroup(3);
  const script: CourseScript = {
    metadata: {
      id: uid("course"),
      name: "",
      version: "",
      creator: "",
      description: "",
      topic: "",
      rotationType: "REGION",
      stationRules: normalizeStationRuleConfig(null),
      tags: [],
      defaultHydrateSeconds: 0,
      readyDurations: createReadyDurations(),
      trainingPanel: createTrainingPanel({
        setCount: 1,
        breakCount: 0
      })
    },
    sections: {
      warmup: createWaterfallSection("热身"),
      cooldown: createWaterfallSection("冷身")
    },
    plan: createCoursePlan(),
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
  script.metadata.stationRules = deriveStationRuleConfig(script);
  return script;
}

export function normalizeCourseScriptLocal(script: CourseScript): CourseScript {
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
      screens: (group.screens || []).map((screen, screenIndex) => {
        const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, resolvedScreenCount);
        const videoCards = fitVideoCardsForRows(
          (screen.videoCards || []).map((card) => ({
            ...card,
            id: card.id || uid("video-card"),
            stationNumber: resolvedScreenCount === 1 ? "" : stationInputValue(card.stationNumber)
          })),
          rowLayouts,
          resolvedScreenCount
        );

        return {
          ...screen,
          id: screen.id || uid("video-group-screen"),
          screenIndex: screen.screenIndex || screenIndex + 1,
          stationLabel:
            screen.stationLabel || (resolvedScreenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screen.screenIndex || screenIndex + 1}`),
          layout: resolvedScreenCount === 1 ? "WATERFALL" : "STATIONS",
          rowLayouts,
          videoCards
        };
      })
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
      stationFlow: (pod.stationFlow === "SWITCH" ? "SWITCH" : "NORMAL") as PodStationFlow,
      ending: pod.ending === "MOVE_ZONE" || pod.ending === "FINISH" || pod.ending === "HYDRATE" ? pod.ending : "HYDRATE",
      screens: createPodScreensFromGroup(
        linkedGroup,
        ((pod.screens as Array<Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }>) || [])
      )
    };
  });

  const normalizedScript = syncTrainingPanelCounters({
    ...cloned,
    sections,
    plan: cloneCoursePlanForEditor(cloned.plan),
    metadata: {
      ...cloneDeep(cloned.metadata),
      description: typeof cloned.metadata?.description === "string" ? cloned.metadata.description : "",
      topic: typeof cloned.metadata?.topic === "string" ? cloned.metadata.topic : "",
      rotationType: normalizeRotationType(cloned.metadata?.rotationType),
      stationRules: normalizeStationRuleConfig(cloned.metadata?.stationRules),
      defaultHydrateSeconds: readNonNegativeNumber(cloned.metadata?.defaultHydrateSeconds, 0),
      readyDurations: createReadyDurations(cloned.metadata?.readyDurations),
      trainingPanel: createTrainingPanel(cloned.metadata?.trainingPanel)
    },
    training: {
      ...cloned.training,
      videoGroups,
      pods: rebalancePodEndings(pods)
    }
  });
  return {
    ...normalizedScript,
    metadata: {
      ...normalizedScript.metadata,
      stationRules: normalizeOrDeriveStationRuleConfig(cloned.metadata?.stationRules, normalizedScript)
    }
  };
}
