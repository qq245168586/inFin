package com.infini.tv.util;

import com.infini.tv.repository.MediaResourcePolicy;

/** Maps physical TV screens to their course media responsibilities. */
public final class ScreenMediaResourcePolicy {
  private ScreenMediaResourcePolicy() {}

  public static MediaResourcePolicy forScreen(int screenNumber) {
    return screenNumber == 2 || screenNumber == 4
        ? MediaResourcePolicy.METADATA_ONLY
        : MediaResourcePolicy.CACHE_REQUIRED;
  }
}
