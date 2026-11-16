package com.infini.tv.util;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;

public class TrainingLayoutCalculatorTest {
  @Test
  public void normalizeRowLayouts_usesLegacySingleColumnForThreeCards() {
    assertEquals(
        Arrays.asList(1, 1, 1),
        TrainingLayoutCalculator.normalizeRowLayouts(Collections.emptyList(), 3));
  }

  @Test
  public void normalizeRowLayouts_respectsProvidedSingleAndDoubleRowsUntilCardsConsumed() {
    assertEquals(
        Arrays.asList(2, 1, 2),
        TrainingLayoutCalculator.normalizeRowLayouts(Arrays.asList(2, 0, 2), 5));
  }

  @Test
  public void calculateVideoRowHeights_preservesSixteenByNineForWideAndGridRows() {
    assertEquals(180, TrainingLayoutCalculator.calculateWideRowHeight(320, 260, 146));
    assertEquals(208, TrainingLayoutCalculator.calculateGridRowHeight(760, 20, 180, 160, 90));
  }

  @Test
  public void calculateRowHeights_scalesMixedRowsToFitViewport() {
    List<Integer> heights =
        TrainingLayoutCalculator.calculateRowHeights(
            Arrays.asList(1, 2, 1),
            10,
            500,
            300,
            180,
            40,
            100,
            80,
            72);

    assertEquals(Arrays.asList(169, 102, 169), heights);
  }

  @Test
  public void calculateRowGap_compactsDenseLayouts() {
    assertEquals(6, TrainingLayoutCalculator.calculateRowGap(5, 6, 8, 12));
    assertEquals(8, TrainingLayoutCalculator.calculateRowGap(3, 6, 8, 12));
    assertEquals(12, TrainingLayoutCalculator.calculateRowGap(2, 6, 8, 12));
  }
}
