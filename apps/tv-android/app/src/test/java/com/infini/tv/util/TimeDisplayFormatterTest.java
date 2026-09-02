package com.infini.tv.util;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TimeDisplayFormatterTest {
  @Test
  public void formatCountdownSeconds_clampsNegativeAndKeepsSubMinuteCompact() {
    assertEquals("0", TimeDisplayFormatter.formatCountdownSeconds(-4));
    assertEquals("0", TimeDisplayFormatter.formatCountdownSeconds(0));
    assertEquals("59", TimeDisplayFormatter.formatCountdownSeconds(59));
  }

  @Test
  public void formatCountdownSeconds_formatsMinuteBoundaries() {
    assertEquals("1:00", TimeDisplayFormatter.formatCountdownSeconds(60));
    assertEquals("1:01", TimeDisplayFormatter.formatCountdownSeconds(61));
    assertEquals("60:00", TimeDisplayFormatter.formatCountdownSeconds(3600));
  }

  @Test
  public void formatClockCountdown_usesStableMinuteSecondWidth() {
    assertEquals("00:00", TimeDisplayFormatter.formatClockCountdown(-1));
    assertEquals("00:07", TimeDisplayFormatter.formatClockCountdown(7));
    assertEquals("01:01", TimeDisplayFormatter.formatClockCountdown(61));
  }
}
