import type {
  CourseScript,
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
  return {
    metadata: {
      id: uid("course"),
      name: "",
      version: "",
      creator: "",
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

  return syncTrainingPanelCounters({
    ...cloned,
    sections,
    plan: cloneCoursePlanForEditor(cloned.plan),
    metadata: {
      ...cloneDeep(cloned.metadata),
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
}
