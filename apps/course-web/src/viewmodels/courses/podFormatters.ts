import type { PodScreen } from "../../models/course/types.ts";

export function formatSecondsStrategy(values: number[]): string {
  if (!values.length) {
    return "0s";
  }
  return values.map((value) => `${Math.max(Number(value) || 0, 0)}s`).join(" / ");
}

export function formatRestStrategy(screen: PodScreen, isSingleScreen = false): string {
  if (isSingleScreen) {
    return `${Math.max(Number(screen.stationRestSeconds) || 0, 0)}s`;
  }
  const groupRestValues = screen.setConfigs.slice(0, -1).map((setConfig) => setConfig.restSeconds);
  return [
    ...groupRestValues.map((value) => `${Math.max(Number(value) || 0, 0)}s`),
    `换站 ${Math.max(Number(screen.stationRestSeconds) || 0, 0)}s`
  ].join(" / ");
}
