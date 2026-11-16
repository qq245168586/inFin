package com.infini.tv.component.horizontal;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.widget.LinearLayout;
import com.infini.tv.R;
import java.util.ArrayList;
import java.util.List;

public final class HorizontalProgressBarComponent {
  public static final float WATER_ICON_ASPECT_RATIO = 283f / 452f;

  private HorizontalProgressBarComponent() {}

  public static final class WorkSegment {
    public final int startOffsetSeconds;
    public final int durationSeconds;
    public final boolean markerAfter;

    public WorkSegment(int startOffsetSeconds, int durationSeconds, boolean markerAfter) {
      this.startOffsetSeconds = Math.max(startOffsetSeconds, 0);
      this.durationSeconds = Math.max(durationSeconds, 1);
      this.markerAfter = markerAfter;
    }
  }

  public static void render(
      LinearLayout progressRow,
      List<WorkSegment> workSegments,
      int elapsedSeconds,
      int totalSeconds,
      int shortSide) {
    if (progressRow == null) {
      return;
    }

    if (workSegments == null || workSegments.isEmpty()) {
      progressRow.removeAllViews();
      progressRow.setVisibility(View.GONE);
      return;
    }

    Context context = progressRow.getContext();
    progressRow.setVisibility(View.VISIBLE);
    int segmentHeight = clamp(Math.round(shortSide * 0.008f), dp(context, 7), dp(context, 11));
    int safeElapsed = clamp(Math.max(elapsedSeconds, 0), 0, Math.max(totalSeconds, 0));

    TimelineProgressView progressView = null;
    if (progressRow.getChildCount() == 1 && progressRow.getChildAt(0) instanceof TimelineProgressView) {
      progressView = (TimelineProgressView) progressRow.getChildAt(0);
    }
    if (progressView == null) {
      progressRow.removeAllViews();
      progressView = new TimelineProgressView(context);
      progressRow.addView(
          progressView,
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, segmentHeight));
    } else {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) progressView.getLayoutParams();
      if (params == null || params.height != segmentHeight) {
        progressView.setLayoutParams(
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, segmentHeight));
      }
    }
    progressView.setProgressData(
        workSegments,
        safeElapsed,
        Math.max(totalSeconds, 1),
        segmentHeight);
  }

  private static int dp(Context context, int value) {
    return Math.round(value * context.getResources().getDisplayMetrics().density);
  }

  private static int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }

  private static final class TimelineProgressView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final int activeColor;
    private final int inactiveColor;
    private final List<WorkSegment> workSegments = new ArrayList<>();
    private int elapsedSeconds;
    private int totalSeconds;
    private int segmentHeight;

    TimelineProgressView(Context context) {
      super(context);
      activeColor = context.getColor(R.color.tv_horizontal_progress_active);
      inactiveColor = context.getColor(R.color.tv_horizontal_progress_inactive);
      setWillNotDraw(false);
    }

    void setProgressData(
        List<WorkSegment> segments,
        int elapsed,
        int total,
        int barHeight) {
      workSegments.clear();
      if (segments != null) {
        for (WorkSegment segment : segments) {
          if (segment != null && segment.durationSeconds > 0) {
            workSegments.add(segment);
          }
        }
      }
      elapsedSeconds = Math.max(elapsed, 0);
      totalSeconds = Math.max(total, 1);
      segmentHeight = Math.max(barHeight, 1);
      invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      if (workSegments.isEmpty()) {
        return;
      }
      int width = getWidth();
      int height = getHeight();
      if (width <= 0 || height <= 0) {
        return;
      }

      float centerY = height / 2f;
      float top = centerY - segmentHeight / 2f;
      float bottom = centerY + segmentHeight / 2f;
      float radius = segmentHeight / 2f;
      paint.setColor(inactiveColor);
      rect.set(0f, top, width, bottom);
      canvas.drawRoundRect(rect, radius, radius, paint);

      float progress = clamp(elapsedSeconds, 0, totalSeconds) / (float) totalSeconds;
      if (progress > 0f) {
        paint.setColor(activeColor);
        rect.set(0f, top, Math.max(1f, width * progress), bottom);
        canvas.drawRoundRect(rect, radius, radius, paint);
      }
    }

  }
}
