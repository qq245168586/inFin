import type { VideoCard, VideoGroupScreen, VideoGroupScreenCount, VideoRowLayout } from "./types.ts";
import { stationCode } from "../../utils/station.ts";

export interface VideoRow {
  index: number;
  columns: VideoRowLayout;
  cards: VideoCard[];
}

export function getDefaultVideoRowLayouts(screenCount: VideoGroupScreenCount = 3): VideoRowLayout[] {
  return screenCount === 1 ? [] : [1, 1, 1];
}

export function normalizeVideoRowLayouts(
  rowLayouts: unknown,
  screenCount: VideoGroupScreenCount = 3
): VideoRowLayout[] {
  if (screenCount === 1) return [];

  const source = Array.isArray(rowLayouts) ? rowLayouts : [];
  if (!source.length) return getDefaultVideoRowLayouts(screenCount);

  const rows = source.map((columns) => (Number(columns) === 2 ? 2 : 1)) as VideoRowLayout[];
  const shouldExpand = rows.length === 3 && rows.every((columns) => columns === 2);

  return shouldExpand ? [2, 2, 2, 2, 2] : rows.slice(0, 5);
}

export function getVideoRowCapacity(rowLayouts: VideoRowLayout[]): number {
  return rowLayouts.reduce((total, columns) => total + columns, 0);
}

export function isFilledVideoCard(card: Partial<VideoCard> | null | undefined): boolean {
  return Boolean(card?.actionId || card?.actionName || stationCode(card?.stationNumber));
}

export function getFilledVideoCards(cards: VideoCard[] = []): VideoCard[] {
  return cards.filter((card) => isFilledVideoCard(card));
}

export function buildVideoRows(screen: VideoGroupScreen, screenCount: VideoGroupScreenCount = 3): VideoRow[] {
  const videoCards = screen.videoCards || [];
  const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, screenCount);
  const rows: VideoRow[] = [];
  let cardIndex = 0;

  for (let rowIndex = 0; rowIndex < rowLayouts.length; rowIndex += 1) {
    const columns = rowLayouts[rowIndex];
    rows.push({
      index: rowIndex,
      columns,
      cards: videoCards.slice(cardIndex, cardIndex + columns)
    });
    cardIndex += columns;
  }

  return rows.length ? rows : [{ index: 0, columns: 1, cards: videoCards }];
}
