package com.infini.tv.util;

import java.util.Locale;

public final class TimeDisplayFormatter {
  private TimeDisplayFormatter() {}

  public static String formatCountdownSeconds(int seconds) {
    int safeSeconds = Math.max(seconds, 0);
    if (safeSeconds < 60) {
      return String.valueOf(safeSeconds);
    }
    return String.format(Locale.US, "%d:%02d", safeSeconds / 60, safeSeconds % 60);
  }
}
