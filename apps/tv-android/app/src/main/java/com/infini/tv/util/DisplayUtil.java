package com.infini.tv.util;

import android.content.res.Resources;
import android.util.DisplayMetrics;

public final class DisplayUtil {
  private DisplayUtil() {}

  public static boolean isPortrait(Resources resources) {
    if (resources == null) {
      return false;
    }
    DisplayMetrics metrics = resources.getDisplayMetrics();
    return metrics.heightPixels > metrics.widthPixels;
  }

  public static int availableWidth(Resources resources, int horizontalPaddingPx, int minimumWidthPx) {
    if (resources == null) {
      return minimumWidthPx;
    }
    return Math.max(resources.getDisplayMetrics().widthPixels - horizontalPaddingPx, minimumWidthPx);
  }
}
