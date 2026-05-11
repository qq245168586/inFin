package com.infini.tv.component;

import android.content.Context;
import android.view.View;
import android.widget.FrameLayout;
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
    int segmentHeight = clamp(Math.round(shortSide * 0.027f), dp(context, 22), dp(context, 36));
    int markerHeight = clamp(Math.round(shortSide * 0.10f), dp(context, 78), dp(context, 122));
    int markerWidth =
        clamp(Math.round(markerHeight * WATER_ICON_ASPECT_RATIO), dp(context, 42), dp(context, 68));
    int markerMargin = clamp(Math.round(shortSide * 0.032f), dp(context, 34), dp(context, 68));
    int safeElapsed = clamp(Math.max(elapsedSeconds, 0), 0, Math.max(totalSeconds, 0));

    int consumed = 0;
    for (int index = 0; index < segmentDurations.size(); index += 1) {
      int durationSeconds = Math.max(segmentDurations.get(index), 1);
      addSegment(progressRow, durationSeconds, safeElapsed - consumed, segmentHeight);
      consumed += durationSeconds;

      if (index < segmentDurations.size() - 1) {
        addMarker(progressRow, markerWidth, markerHeight, markerMargin, safeElapsed >= consumed);
      }
    }
  }

  private static void addSegment(
      LinearLayout progressRow, int durationSeconds, int elapsedInSegment, int segmentHeight) {
    FrameLayout segmentContainer = new FrameLayout(progressRow.getContext());
    segmentContainer.setLayoutParams(new LinearLayout.LayoutParams(0, segmentHeight, durationSeconds));

    int completedInSegment = clamp(elapsedInSegment, 0, durationSeconds);
    if (completedInSegment >= durationSeconds) {
      segmentContainer.setBackgroundResource(R.drawable.bg_horizontal_progress_active);
    } else {
      segmentContainer.setBackgroundResource(R.drawable.bg_horizontal_progress_inactive);
      if (completedInSegment > 0) {
        View fill = new View(progressRow.getContext());
        fill.setBackgroundResource(R.drawable.bg_horizontal_progress_active);
        segmentContainer.addView(
            fill,
            new FrameLayout.LayoutParams(0, FrameLayout.LayoutParams.MATCH_PARENT));
        segmentContainer.post(
            () -> {
              int width = segmentContainer.getWidth();
              if (width <= 0) {
                return;
              }
              FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) fill.getLayoutParams();
              params.width = Math.max(1, Math.round(width * completedInSegment / (float) durationSeconds));
              fill.setLayoutParams(params);
            });
      }
    }
    progressRow.addView(segmentContainer);
  }

  private static void addMarker(
      LinearLayout progressRow, int markerWidth, int markerHeight, int markerMargin, boolean completed) {
    ImageView marker = new ImageView(progressRow.getContext());
    LinearLayout.LayoutParams markerParams =
        new LinearLayout.LayoutParams(markerWidth, markerHeight);
    markerParams.leftMargin = markerMargin;
    markerParams.rightMargin = markerMargin;
    marker.setLayoutParams(markerParams);
    marker.setAdjustViewBounds(true);
    marker.setScaleType(ImageView.ScaleType.FIT_CENTER);
    marker.setImageResource(R.drawable.icon_water);
    marker.setColorFilter(
        progressRow
            .getContext()
            .getColor(completed ? R.color.tv_horizontal_marker_done : R.color.tv_horizontal_marker_idle));
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
