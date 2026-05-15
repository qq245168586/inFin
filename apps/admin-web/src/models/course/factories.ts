import { readNonNegativeNumber } from "../../utils/number.ts";
import { stationInputValue } from "../../utils/station.ts";
import { uid } from "../../utils/uid.ts";
import type {
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

export function getWaterfallSectionTotal(section: WaterfallSection | null | undefined): number {
  return (section?.items || []).reduce((total, item) => total + Number(item.seconds || 0), 0);
}

export function getVideoGroupCardCount(group: VideoGroup | null | undefined): number {
  return (group?.screens || []).reduce((total, screen) => total + (screen.videoCards || []).length, 0);
}
