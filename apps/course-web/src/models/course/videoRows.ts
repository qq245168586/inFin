import type { VideoCard, VideoGroupScreen, VideoGroupScreenCount, VideoRowLayout } from "./types.ts";

export interface VideoRow {
  index: number;
  columns: VideoRowLayout;
  cards: VideoCard[];
}

export function normalizeVideoRowLayouts(
  rowLayouts: unknown,
  videoCards: VideoCard[] = [],
  screenCount: VideoGroupScreenCount = 3
): VideoRowLayout[] {
  if (screenCount === 1) return [];

  const source = Array.isArray(rowLayouts) ? rowLayouts : [];
  const rows: VideoRowLayout[] = [];
  let cardIndex = 0;
  let rowIndex = 0;

  while (cardIndex < Math.max(videoCards.length, 1)) {
    const columns: VideoRowLayout = Number(source[rowIndex]) === 2 ? 2 : 1;
    rows.push(columns);
    cardIndex += columns;
    rowIndex += 1;
  }

  return rows;
}

export function buildVideoRows(screen: VideoGroupScreen, screenCount: VideoGroupScreenCount = 3): VideoRow[] {
  const videoCards = screen.videoCards || [];
  const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, videoCards, screenCount);
  const rows: VideoRow[] = [];
  let cardIndex = 0;

  for (let rowIndex = 0; cardIndex < videoCards.length; rowIndex += 1) {
    const columns = rowLayouts[rowIndex] || 1;
    rows.push({
      index: rowIndex,
      columns,
      cards: videoCards.slice(cardIndex, cardIndex + columns)
    });
    cardIndex += columns;
  }

  return rows.length ? rows : [{ index: 0, columns: 1, cards: [] }];
}
