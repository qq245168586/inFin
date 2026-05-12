import { readNonNegativeNumber } from "../../utils/number.ts";
import { uid } from "../../utils/uid.ts";
import type { PodSetConfig } from "./types.ts";

export function normalizePodSetConfigs(setConfigs: Partial<PodSetConfig>[] = [], fallbackCount = 1): PodSetConfig[] {
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

export function normalizePodSetConfigsForLayout(
  setConfigs: Partial<PodSetConfig>[] = [],
  isSingleScreen = false,
  fallbackCount = 1
): PodSetConfig[] {
  const source = isSingleScreen ? (setConfigs.length ? [setConfigs[0]] : []) : setConfigs;
  const targetCount = isSingleScreen ? 1 : Math.max(source.length || fallbackCount, 1);
  return normalizePodSetConfigs(source, targetCount).slice(0, targetCount);
}

export function resizePodSetConfigs(setConfigs: PodSetConfig[], nextCount: number): PodSetConfig[] {
  return normalizePodSetConfigs(setConfigs, Math.max(nextCount, 1));
}
