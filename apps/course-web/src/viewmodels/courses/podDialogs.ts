import type { Pod, PodScreen, PodSetConfig } from "../../models/course/types.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { readNonNegativeNumber } from "../../utils/number.ts";
import { uid } from "../../utils/uid.ts";

export interface PodRuleSetDraft {
  id: string;
  workSeconds: string;
  restSeconds: string;
}

export interface PodRuleDialogState {
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

export interface PodCopyDialogState {
  podId: string;
  podName: string;
  targetScreenId: string;
  targetScreenIndex: number;
  targetScreenLabel: string;
  selectedSourceScreenId: string;
}

export interface PodConfigCopyDialogState {
  targetPodId: string;
  targetPodName: string;
  selectedSourcePodId: string;
}

export function createPodRuleSetDraft(
  setConfig?: Partial<PodSetConfig> | Partial<PodRuleSetDraft>,
  isLast = false
): PodRuleSetDraft {
  return {
    id: setConfig?.id || uid("pod-set"),
    workSeconds: String(readNonNegativeNumber((setConfig as Partial<PodSetConfig>)?.workSeconds, 0)),
    restSeconds: String(isLast ? 0 : readNonNegativeNumber((setConfig as Partial<PodSetConfig>)?.restSeconds, 0))
  };
}

export function resizePodRuleSetDrafts(setConfigs: PodRuleSetDraft[], nextCount: number): PodRuleSetDraft[] {
  const safeCount = Math.max(nextCount, 1);
  return Array.from({ length: safeCount }, (_, index) => {
    const existing = setConfigs[index];
    return createPodRuleSetDraft(existing, index === safeCount - 1);
  });
}

export function createPodRuleDialogState(
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

export function hasCustomPodRules(
  screen: Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }
): boolean {
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

export function podHasCustomizedRules(pod: Pod | null | undefined): boolean {
  return Boolean(pod?.screens?.some((screen) => Boolean(screen?.isCustomized)));
}
