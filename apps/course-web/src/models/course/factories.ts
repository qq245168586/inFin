import { readNonNegativeNumber } from "../../utils/number.ts";
import { stationInputValue } from "../../utils/station.ts";
import { uid } from "../../utils/uid.ts";
import type {
  CoursePlan,
  CoursePlanItem,
  CoursePlanSection,
  CourseScript,
  Pod,
  PodSetConfig,
  TrainingPanel,
  VideoCard,
  VideoGroup,
  VideoGroupScreen,
  VideoGroupScreenCount,
  WaterfallItem,
  WaterfallSection
} from "./types.ts";

export function createTrainingPanel(overrides: Partial<TrainingPanel> = {}): TrainingPanel {
  return {
    setCount: 1,
    breakCount: 0,
    workSeconds: 0,
    restSeconds: 0,
    ...overrides
  };
}

export function createWaterfallItem(actionId = "", actionName = ""): WaterfallItem {
  return {
    id: uid("waterfall"),
    actionId,
    actionName,
    seconds: 0,
    cue: ""
  };
}

export function createWaterfallSection(title: string): WaterfallSection {
  return {
    id: uid("section"),
    title,
    layout: "WATERFALL",
    items: [createWaterfallItem()]
  };
}

export function createCoursePlanItem(text = ""): CoursePlanItem {
  return {
    id: uid("plan-item"),
    text
  };
}

export function createCoursePlanSection(): CoursePlanSection {
  return {
    id: uid("plan-section"),
    title: "",
    items: [createCoursePlanItem()]
  };
}

export function createCoursePlan(): CoursePlan {
  return {
    sections: []
  };
}

export function createVideoCard(stationNumber = ""): VideoCard {
  return {
    id: uid("video-card"),
    actionId: "",
    actionName: "",
    stationNumber: stationInputValue(stationNumber)
  };
}

export function createVideoGroupScreen(screenIndex: number, screenCount: VideoGroupScreenCount): VideoGroupScreen {
  return {
    id: uid("video-group-screen"),
    screenIndex,
    stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
    layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
    videoCards: [createVideoCard()]
  };
}

export function createVideoGroup(screenCount: VideoGroupScreenCount = 3): VideoGroup {
  return {
    id: uid("video-group"),
    name: screenCount === 1 ? "单屏瀑布组" : "三屏视频组",
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) => createVideoGroupScreen(index + 1, screenCount))
  };
}

export function createPodSetConfig(overrides: Partial<PodSetConfig> = {}): PodSetConfig {
  return {
    id: overrides.id || uid("pod-set"),
    workSeconds: readNonNegativeNumber(overrides.workSeconds, 0),
    restSeconds: readNonNegativeNumber(overrides.restSeconds, 0)
  };
}

export function cloneWaterfallItemForEditor(item?: Partial<WaterfallItem>): WaterfallItem {
  return {
    id: item?.id || uid("waterfall"),
    actionId: String(item?.actionId || ""),
    actionName: String(item?.actionName || ""),
    seconds: readNonNegativeNumber(item?.seconds, 0),
    cue: ""
  };
}

export function cloneWaterfallSectionForEditor(
  section: Partial<WaterfallSection> | null | undefined,
  title: string,
  allowEmpty = false
): WaterfallSection {
  const sourceItems = Array.isArray(section?.items) ? section.items : [];
  const items = sourceItems.length ? sourceItems : allowEmpty ? [] : [createWaterfallItem()];
  return {
    id: section?.id || uid("section"),
    title,
    layout: "WATERFALL",
    items: items.map((item) => cloneWaterfallItemForEditor(item))
  };
}

export function cloneVideoCardForEditor(card?: Partial<VideoCard>, screenCount: VideoGroupScreenCount = 3): VideoCard {
  return {
    id: uid("video-card"),
    actionId: String(card?.actionId || ""),
    actionName: String(card?.actionName || ""),
    stationNumber: screenCount === 1 ? "" : stationInputValue(card?.stationNumber)
  };
}

export function cloneVideoGroupForEditor(group: Partial<VideoGroup> | null | undefined, fallbackName = ""): VideoGroup {
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

export function cloneCoursePlanItemForEditor(item?: Partial<CoursePlanItem>): CoursePlanItem {
  return {
    id: item?.id || uid("plan-item"),
    text: String(item?.text || "")
  };
}

export function cloneCoursePlanSectionForEditor(section?: Partial<CoursePlanSection>): CoursePlanSection {
  const sourceItems = Array.isArray(section?.items) ? section.items : [];
  return {
    id: section?.id || uid("plan-section"),
    title: String(section?.title || ""),
    items: sourceItems.map((item) => cloneCoursePlanItemForEditor(item))
  };
}

export function cloneCoursePlanForEditor(plan?: Partial<CoursePlan> | null): CoursePlan {
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  return {
    sections: sections.map((section) => cloneCoursePlanSectionForEditor(section))
  };
}

export function cloneCourseScriptWithFreshIds(script: CourseScript, metadataId = uid("course")): CourseScript {
  const videoGroupIdMap = new Map<string, string>();
  const videoGroups: VideoGroup[] = (script.training?.videoGroups || []).map((group) => {
    const nextGroupId = uid("video-group");
    videoGroupIdMap.set(group.id, nextGroupId);
    const screenCount = group.screenCount === 1 ? 1 : 3;

    return {
      ...group,
      id: nextGroupId,
      screenCount,
      screens: (group.screens || []).map((screen, screenIndex) => ({
        ...screen,
        id: uid("video-group-screen"),
        screenIndex: screen.screenIndex || screenIndex + 1,
        layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
        videoCards: (screen.videoCards || []).map((card) => ({
          ...card,
          id: uid("video-card"),
          stationNumber: screenCount === 1 ? "" : stationInputValue(card.stationNumber)
        }))
      }))
    };
  });

  const pods: Pod[] = (script.training?.pods || []).map((pod) => ({
    ...pod,
    id: uid("pod"),
    videoGroupId: videoGroupIdMap.get(pod.videoGroupId) || videoGroups[0]?.id || pod.videoGroupId,
    screens: (pod.screens || []).map((screen, screenIndex) => ({
      ...screen,
      id: uid("pod-screen"),
      screenIndex: screen.screenIndex || screenIndex + 1,
      setConfigs: (screen.setConfigs || []).map((setConfig) => ({
        ...setConfig,
        id: uid("pod-set")
      }))
    }))
  }));

  return {
    ...script,
    metadata: {
      ...script.metadata,
      id: metadataId,
      tags: [...(script.metadata?.tags || [])],
      trainingPanel: createTrainingPanel(script.metadata?.trainingPanel)
    },
    sections: {
      warmup: {
        ...script.sections.warmup,
        id: uid("section"),
        title: "热身",
        layout: "WATERFALL",
        items: (script.sections.warmup.items || []).map((item) => ({
          ...item,
          id: uid("waterfall")
        }))
      },
      cooldown: {
        ...script.sections.cooldown,
        id: uid("section"),
        title: "冷身",
        layout: "WATERFALL",
        items: (script.sections.cooldown.items || []).map((item) => ({
          ...item,
          id: uid("waterfall")
        }))
      }
    },
    plan: {
      sections: (script.plan?.sections || []).map((section) => ({
        ...section,
        id: uid("plan-section"),
        items: (section.items || []).map((item) => ({
          ...item,
          id: uid("plan-item")
        }))
      }))
    },
    training: {
      videoGroups,
      pods
    }
  };
}

export function getWaterfallSectionTotal(section: WaterfallSection | null | undefined): number {
  return (section?.items || []).reduce((total, item) => total + Number(item.seconds || 0), 0);
}

export function getVideoGroupCardCount(group: VideoGroup | null | undefined): number {
  return (group?.screens || []).reduce((total, screen) => total + (screen.videoCards || []).length, 0);
}
