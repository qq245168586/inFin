package com.infini.tv.util;

import java.util.ArrayList;
import java.util.List;

public final class TrainingLayoutCalculator {
  private TrainingLayoutCalculator() {}

  public static int calculateWideRowHeight(int contentWidth, int minimumWidth, int minimumHeight) {
    int previewWidth = Math.max(contentWidth, minimumWidth);
    return Math.max(Math.round(previewWidth * 9f / 16f), minimumHeight);
  }

  public static int calculateGridRowHeight(
      int contentWidth,
      int columnGap,
      int minimumColumnWidth,
      int minimumPreviewWidth,
      int minimumHeight) {
    int columnWidth = Math.max((contentWidth - columnGap) / 2, minimumColumnWidth);
    int previewWidth = Math.max(columnWidth, minimumPreviewWidth);
    return Math.max(Math.round(previewWidth * 9f / 16f), minimumHeight);
  }

  public static int calculateFitRowHeight(
      int cardCount,
      int columns,
      int rowCount,
      int rowGap,
      int viewportHeight,
      int extraChromeHeight,
      int minimumAvailableHeight,
      int minimumFitHeight,
      int aspectHeight,
      int minimumResultHeight) {
    int verticalChrome = extraChromeHeight + Math.max(rowCount - 1, 0) * rowGap;
    int availableHeight = Math.max(viewportHeight - verticalChrome, minimumAvailableHeight);
    int fitHeight = Math.max(availableHeight / Math.max(rowCount, 1), minimumFitHeight);
    return Math.max(Math.min(aspectHeight, fitHeight), minimumResultHeight);
  }

  public static int calculateRowGap(int rowCount, int compactGap, int mediumGap, int regularGap) {
    if (rowCount >= 5) {
      return compactGap;
    }
    if (rowCount >= 3) {
      return mediumGap;
    }
    return regularGap;
  }

  public static List<Integer> normalizeRowLayouts(List<Integer> rowLayouts, int cardCount) {
    List<Integer> rows = new ArrayList<>();
    if (cardCount <= 0) {
      return rows;
    }

    if (rowLayouts == null || rowLayouts.isEmpty()) {
      int legacyColumns = cardCount == 1 || cardCount == 3 ? 1 : 2;
      int consumed = 0;
      while (consumed < cardCount) {
        rows.add(legacyColumns);
        consumed += legacyColumns;
      }
      return rows;
    }

    int consumed = 0;
    int rowIndex = 0;
    while (consumed < cardCount) {
      int columns = rowIndex < rowLayouts.size() && rowLayouts.get(rowIndex) == 2 ? 2 : 1;
      rows.add(columns);
      consumed += columns;
      rowIndex += 1;
    }
    return rows;
  }

  public static List<Integer> calculateRowHeights(
      List<Integer> rowLayouts,
      int rowGap,
      int viewportHeight,
      int wideRowHeight,
      int gridRowHeight,
      int viewportPadding,
      int minimumAvailableHeight,
      int minimumScaledHeight,
      int minimumOverflowHeight) {
    List<Integer> heights = new ArrayList<>();
    if (rowLayouts == null || rowLayouts.isEmpty()) {
      return heights;
    }

    int desiredRowsHeight = 0;
    for (int index = 0; index < rowLayouts.size(); index += 1) {
      int height = rowLayouts.get(index) == 1 ? wideRowHeight : gridRowHeight;
      heights.add(height);
      desiredRowsHeight += height;
    }

    int availableRowsHeight =
        Math.max(viewportHeight - viewportPadding - Math.max(rowLayouts.size() - 1, 0) * rowGap, minimumAvailableHeight);
    if (desiredRowsHeight <= availableRowsHeight || desiredRowsHeight <= 0) {
      return heights;
    }

    float scale = availableRowsHeight / (float) desiredRowsHeight;
    int usedHeight = 0;
    for (int index = 0; index < heights.size(); index += 1) {
      int scaled = Math.max(Math.round(heights.get(index) * scale), minimumScaledHeight);
      heights.set(index, scaled);
      usedHeight += scaled;
    }

    int overflow = usedHeight - availableRowsHeight;
    for (int index = heights.size() - 1; overflow > 0 && index >= 0; index -= 1) {
      int current = heights.get(index);
      int next = Math.max(current - overflow, minimumOverflowHeight);
      overflow -= current - next;
      heights.set(index, next);
    }
    return heights;
  }
}
