package com.infini.tv.component;

import android.content.Context;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import com.infini.tv.R;
import java.util.List;

public final class HorizontalProgressBarComponent {
  public static final float WATER_ICON_ASPECT_RATIO = 283f / 452f;

  private HorizontalProgressBarComponent() {}

  public static void render(
      LinearLayout progressRow,
      List<Integer> segmentDurations,
      int elapsedSeconds,
      int totalSeconds,
      int shortSide) {
    if (progressRow == null) {
      return;
    }

    progressRow.removeAllViews();
    if (segmentDurations == null || segmentDurations.isEmpty()) {
      progressRow.setVisibility(View.GONE);
      return;
    }

    Context context = progressRow.getContext();
    progressRow.setVisibility(View.VISIBLE);
    int segmentHeight = clamp(Math.round(shortSide * 0.023f), dp(context, 18), dp(context, 28));
    int markerHeight = clamp(Math.round(shortSide * 0.088f), dp(context, 66), dp(context, 104));
    int markerWidth =
        clamp(Math.round(markerHeight * WATER_ICON_ASPECT_RATIO), dp(context, 36), dp(context, 58));
    int markerMargin = clamp(Math.round(shortSide * 0.028f), dp(context, 28), dp(context, 54));
    int safeElapsed = clamp(Math.max(elapsedSeconds, 0), 0, Math.max(totalSeconds, 0));

    int consumed = 0;
    for (int index = 0; index < segmentDurations.size(); index += 1) {
      int durationSeconds = Math.max(segmentDurations.get(index), 1);
      addSegment(progressRow, durationSeconds, safeElapsed - consumed, segmentHeight);
      consumed += durationSeconds;

      if (index < segmentDurations.size() - 1) {
        addMarker(progressRow, markerWidth, markerHeight, markerMargin);
      }
    }
  }

  private static void addSegment(
      LinearLayout progressRow, int durationSeconds, int elapsedInSegment, int segmentHeight) {
    LinearLayout segmentContainer = new LinearLayout(progressRow.getContext());
    segmentContainer.setOrientation(LinearLayout.HORIZONTAL);
    segmentContainer.setLayoutParams(new LinearLayout.LayoutParams(0, segmentHeight, durationSeconds));

    int completedInSegment = clamp(elapsedInSegment, 0, durationSeconds);
    int remainingInSegment = Math.max(durationSeconds - completedInSegment, 0);
    if (completedInSegment > 0) {
      View fill = new View(progressRow.getContext());
      fill.setBackgroundResource(R.drawable.bg_horizontal_progress_active);
      fill.setLayoutParams(
          new LinearLayout.LayoutParams(
              0, LinearLayout.LayoutParams.MATCH_PARENT, completedInSegment));
      segmentContainer.addView(fill);
    }
    if (remainingInSegment > 0 || completedInSegment <= 0) {
      View empty = new View(progressRow.getContext());
      empty.setBackgroundResource(R.drawable.bg_horizontal_progress_inactive);
      empty.setLayoutParams(
          new LinearLayout.LayoutParams(
              0,
              LinearLayout.LayoutParams.MATCH_PARENT,
              Math.max(remainingInSegment, completedInSegment <= 0 ? durationSeconds : 0)));
      segmentContainer.addView(empty);
    }
    progressRow.addView(segmentContainer);
  }

  private static void addMarker(
      LinearLayout progressRow, int markerWidth, int markerHeight, int markerMargin) {
    ImageView marker = new ImageView(progressRow.getContext());
    LinearLayout.LayoutParams markerParams =
        new LinearLayout.LayoutParams(markerWidth, markerHeight);
    markerParams.leftMargin = markerMargin;
    markerParams.rightMargin = markerMargin;
    marker.setLayoutParams(markerParams);
    marker.setAdjustViewBounds(true);
    marker.setScaleType(ImageView.ScaleType.FIT_CENTER);
    marker.setImageResource(R.drawable.icon_water);
    marker.setColorFilter(progressRow.getContext().getColor(R.color.tv_accent_gold_bright));
    marker.setAlpha(1f);
    progressRow.addView(marker);
  }

  private static int dp(Context context, int value) {
    return Math.round(value * context.getResources().getDisplayMetrics().density);
  }

  private static int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }
}
