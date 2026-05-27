package com.infini.tv.component;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
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
    int segmentHeight = dp(context, 48);
    int markerHeight = clamp(Math.round(shortSide * 0.10f), dp(context, 78), dp(context, 122));
    int markerWidth =
        clamp(Math.round(markerHeight * WATER_ICON_ASPECT_RATIO), dp(context, 42), dp(context, 68));
    int markerMargin = clamp(Math.round(shortSide * 0.032f), dp(context, 34), dp(context, 68));
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
              LinearLayout.LayoutParams.MATCH_PARENT, markerHeight));
    } else {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) progressView.getLayoutParams();
      if (params == null || params.height != markerHeight) {
        progressView.setLayoutParams(
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, markerHeight));
      }
    }
    progressView.setProgressData(
        workSegments,
        safeElapsed,
        segmentHeight,
        markerWidth,
        markerHeight,
        markerMargin);
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
    private final Rect markerBounds = new Rect();
    private final Drawable waterIcon;
    private final int activeColor;
    private final int inactiveColor;
    private final int markerDoneColor;
    private final int markerIdleColor;
    private final List<WorkSegment> workSegments = new ArrayList<>();
    private int elapsedSeconds;
    private int segmentHeight;
    private int markerWidth;
    private int markerHeight;
    private int markerMargin;

    TimelineProgressView(Context context) {
      super(context);
      activeColor = context.getColor(R.color.tv_horizontal_progress_active);
      inactiveColor = context.getColor(R.color.tv_horizontal_progress_inactive);
      markerDoneColor = context.getColor(R.color.tv_horizontal_marker_done);
      markerIdleColor = context.getColor(R.color.tv_horizontal_marker_idle);
      Drawable rawIcon = context.getDrawable(R.drawable.icon_water);
      waterIcon = rawIcon == null ? null : rawIcon.mutate();
      setWillNotDraw(false);
    }

    void setProgressData(
        List<WorkSegment> segments,
        int elapsed,
        int barHeight,
        int waterWidth,
        int waterHeight,
        int waterMargin) {
      workSegments.clear();
      if (segments != null) {
        for (WorkSegment segment : segments) {
          if (segment != null && segment.durationSeconds > 0) {
            workSegments.add(segment);
          }
        }
      }
      elapsedSeconds = Math.max(elapsed, 0);
      segmentHeight = Math.max(barHeight, 1);
      markerWidth = Math.max(waterWidth, 1);
      markerHeight = Math.max(waterHeight, 1);
      markerMargin = Math.max(waterMargin, 0);
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

      int markerCount = 0;
      for (int index = 0; index < workSegments.size() - 1; index += 1) {
        if (workSegments.get(index).markerAfter) {
          markerCount += 1;
        }
      }
      int blockGap = workSegments.size() > 24 ? dp(getContext(), 2) : dp(getContext(), 4);
      int gapCount = Math.max(workSegments.size() - 1 - markerCount, 0);
      float fixedWidth = markerCount * (markerWidth + markerMargin * 2f);
      fixedWidth += gapCount * blockGap;
      float availableSegmentWidth = Math.max(0f, width - fixedWidth);
      int totalDuration = 0;
      for (WorkSegment segment : workSegments) {
        totalDuration += Math.max(segment.durationSeconds, 1);
      }
      if (totalDuration <= 0 || availableSegmentWidth <= 0f) {
        return;
      }

      float x = 0f;
      float centerY = height / 2f;
      for (int index = 0; index < workSegments.size(); index += 1) {
        WorkSegment segment = workSegments.get(index);
        int duration = Math.max(segment.durationSeconds, 1);
        float segmentWidth =
            index == workSegments.size() - 1
                ? Math.max(0f, width - x)
                : availableSegmentWidth * duration / (float) totalDuration;
        if (segmentWidth > 0f) {
          drawSegment(
              canvas,
              x,
              centerY,
              segmentWidth,
              duration,
              elapsedSeconds - segment.startOffsetSeconds);
        }
        x += segmentWidth;

        if (index < workSegments.size() - 1) {
          if (segment.markerAfter) {
            x += markerMargin;
            drawMarker(canvas, x, centerY, elapsedSeconds >= segment.startOffsetSeconds + duration);
            x += markerWidth + markerMargin;
          } else {
            x += blockGap;
          }
        }
      }
    }

    private void drawSegment(
        Canvas canvas, float x, float centerY, float width, int durationSeconds, int elapsedInSegment) {
      float top = centerY - segmentHeight / 2f;
      float bottom = centerY + segmentHeight / 2f;
      float radius = segmentHeight / 2f;
      paint.setColor(inactiveColor);
      rect.set(x, top, x + width, bottom);
      canvas.drawRoundRect(rect, radius, radius, paint);

      int completed = clamp(elapsedInSegment, 0, durationSeconds);
      if (completed <= 0) {
        return;
      }
      float activeWidth = Math.max(1f, width * completed / (float) durationSeconds);
      paint.setColor(activeColor);
      rect.set(x, top, Math.min(x + activeWidth, x + width), bottom);
      canvas.drawRoundRect(rect, radius, radius, paint);
    }

    private void drawMarker(Canvas canvas, float x, float centerY, boolean completed) {
      if (waterIcon == null) {
        return;
      }
      int top = Math.round(centerY - markerHeight / 2f);
      markerBounds.set(
          Math.round(x),
          top,
          Math.round(x + markerWidth),
          top + markerHeight);
      waterIcon.setTint(completed ? markerDoneColor : markerIdleColor);
      waterIcon.setBounds(markerBounds);
      waterIcon.draw(canvas);
    }
  }
}
