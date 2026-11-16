package com.infini.tv.util;

public final class SwitchPodSequence {
  private SwitchPodSequence() {}

  public static int getPairCount(int cardCount) {
    return Math.max(cardCount, 0) / 2;
  }

  public static int getPairIndexForRound(int roundIndex, int pairCount) {
    if (pairCount <= 0) {
      return -1;
    }
    return Math.max(roundIndex, 0) % pairCount;
  }
}
