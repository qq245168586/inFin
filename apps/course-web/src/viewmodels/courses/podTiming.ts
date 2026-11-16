import type { Pod, PodScreen, VideoGroup, VideoGroupScreen } from "../../models/course/types.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { formatSecondsLabel } from "../../utils/datetime.ts";

export function getPodScreenTotal(screen: PodScreen, linkedScreen: VideoGroupScreen | null): number {
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
    const transitionSeconds = Math.max(actionCount - 1, 0) * Math.max(Number(screen.stationRestSeconds) || 0, 0);
    return actionCount * perLoopSeconds + transitionSeconds;
  }

  const transitionSeconds = Math.max(loopCount - 1, 0) * Math.max(Number(screen.stationRestSeconds) || 0, 0);
  return loopCount * perLoopSeconds + transitionSeconds;
}

export function getSwitchPodScreenTotal(screen: PodScreen, linkedScreen: VideoGroupScreen | null): number {
  const cardCount = linkedScreen?.videoCards?.length || 0;
  if (!cardCount) {
    return 0;
  }

  const setConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, false, 1);
  const pairCount = Math.floor(cardCount / 2);
  const loopCount = Math.max(Number(screen.loopCount) || 0, 0);
  if (!pairCount || !loopCount) {
    return 0;
  }

  const stationRestSeconds = Math.max(Number(screen.stationRestSeconds) || 0, 0);
  const perRoundSeconds = setConfigs.reduce((total, setConfig, index) => {
    const workSeconds = Math.max(Number(setConfig.workSeconds) || 0, 0);
    const groupRestSeconds = index < setConfigs.length - 1 ? Math.max(Number(setConfig.restSeconds) || 0, 0) : 0;
    return total + workSeconds * 2 + stationRestSeconds + groupRestSeconds;
  }, 0);
  return loopCount * perRoundSeconds + Math.max(loopCount - 1, 0) * stationRestSeconds;
}

export function getPodScreenTotalForFlow(pod: Pod, screen: PodScreen, linkedScreen: VideoGroupScreen | null): number {
  return pod.stationFlow === "SWITCH" ? getSwitchPodScreenTotal(screen, linkedScreen) : getPodScreenTotal(screen, linkedScreen);
}

export function formatPodTimingMismatch(pod: Pod, linkedGroup: VideoGroup | null): string {
  const details = pod.screens.map((screen) => {
    const linkedScreen = linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
    const actionCount = linkedScreen?.videoCards.length || 0;
    const total = getPodScreenTotalForFlow(pod, screen, linkedScreen);
    return `屏幕 ${screen.screenIndex}：${actionCount} 个动作，${formatSecondsLabel(total)}`;
  });

  return `当前 Pod 各屏总时长不一致。${details.join("；")}。通常是视频组动作数量或屏幕规则不同导致的。`;
}
