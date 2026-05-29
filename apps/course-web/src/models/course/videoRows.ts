import type { VideoCard, VideoGroupScreen, VideoGroupScreenCount, VideoRowLayout } from "./types.ts";

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
  const firstRows: VideoRowLayout[] = [0, 1, 2].map((index) => (Number(source[index]) === 2 ? 2 : 1));
  const shouldExpand = firstRows.every((columns) => columns === 2);

  if (!shouldExpand) return firstRows;

  return [2, 2, 2, 2, 2];
}

export function getVideoRowCapacity(rowLayouts: VideoRowLayout[]): number {
  return rowLayouts.reduce((total, columns) => total + columns, 0);
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
