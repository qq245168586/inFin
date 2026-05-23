import type { VideoGroup } from "../../models/course/types.ts";

export function matchesTypeFilter(sourceIds: number[], selectedIds: number[]): boolean {
  return selectedIds.length === 0 || selectedIds.some((id) => sourceIds.includes(id));
}

export function hasEditedVideoGroup(group: VideoGroup | null | undefined): boolean {
  if (!group) return false;
  const trimmed = String(group.name || "").trim();
  const isDefaultName = trimmed === "" || trimmed === (group.screenCount === 1 ? "单屏瀑布组" : "三屏视频组");
  if (!isDefaultName) return true;

  return group.screens.some((screen) => {
    if (screen.videoCards.length > 1) return true;
    return screen.videoCards.some((card) => Boolean(String(card.actionId || "").trim() || String(card.actionName || "").trim()));
  });
}
