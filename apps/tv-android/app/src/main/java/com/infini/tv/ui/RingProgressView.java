package com.infini.tv.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

import androidx.annotation.Nullable;

/**
 * Simple deterministic ring progress view for TV horizontal countdown.
 * Keeps allocations minimal (draws from cached Paint/RectF).
 */
public class RingProgressView extends View {
  private final Paint backgroundPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint progressPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint thumbPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final RectF arcBounds = new RectF();

  private float progress = 0f; // 0..1
  private float strokeWidthPx = 56f;
  private int backgroundColor = 0x66ffffff;
  private int progressColor = 0xff23aef4;
  private int thumbColor = 0xffffffff;
  private boolean drawThumb = true;

  public RingProgressView(Context context) {
    super(context);
    init();
  }

  public RingProgressView(Context context, @Nullable AttributeSet attrs) {
    super(context, attrs);
    init();
  }

  public RingProgressView(Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
    super(context, attrs, defStyleAttr);
    init();
  }

  private void init() {
    backgroundPaint.setStyle(Paint.Style.STROKE);
    backgroundPaint.setStrokeCap(Paint.Cap.ROUND);
    backgroundPaint.setColor(backgroundColor);
    backgroundPaint.setStrokeWidth(strokeWidthPx);

    progressPaint.setStyle(Paint.Style.STROKE);
    progressPaint.setStrokeCap(Paint.Cap.ROUND);
    progressPaint.setColor(progressColor);
    progressPaint.setStrokeWidth(strokeWidthPx);

    thumbPaint.setStyle(Paint.Style.FILL);
    thumbPaint.setColor(thumbColor);
  }

  public void setColors(int background, int progress, int thumb) {
    backgroundColor = background;
    progressColor = progress;
    thumbColor = thumb;
    backgroundPaint.setColor(backgroundColor);
    progressPaint.setColor(progressColor);
    thumbPaint.setColor(thumbColor);
    invalidate();
  }

  public void setStrokeWidthPx(float value) {
    strokeWidthPx = Math.max(1f, value);
    backgroundPaint.setStrokeWidth(strokeWidthPx);
    progressPaint.setStrokeWidth(strokeWidthPx);
    invalidate();
  }

  public void setDrawThumb(boolean enabled) {
    drawThumb = enabled;
    invalidate();
  }

  public void setProgress(float value) {
    float next = value;
    if (Float.isNaN(next) || Float.isInfinite(next)) {
      next = 0f;
    }
    next = Math.max(0f, Math.min(1f, next));
    if (Math.abs(next - progress) < 0.0001f) {
      return;
    }
    progress = next;
    invalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    int width = getWidth();
    int height = getHeight();
    if (width <= 0 || height <= 0) {
      return;
    }

    float cx = width / 2f;
    float cy = height / 2f;
    float size = Math.min(width, height);
    float thumbRadius = Math.max(22f, strokeWidthPx * 0.72f);
    float radius = size / 2f - strokeWidthPx / 2f - thumbRadius;
    if (radius <= 0f) {
      return;
    }

    arcBounds.set(cx - radius, cy - radius, cx + radius, cy + radius);
    // Background ring.
    canvas.drawArc(arcBounds, 0f, 360f, false, backgroundPaint);
    // Progress arc starts at top (12 o'clock).
    float sweep = 360f * progress;
    canvas.drawArc(arcBounds, -90f, sweep, false, progressPaint);

    if (drawThumb && sweep > 0.5f) {
      // Thumb at current progress end.
      double angleRad = Math.toRadians(-90f + sweep);
      float tx = (float) (cx + Math.cos(angleRad) * radius);
      float ty = (float) (cy + Math.sin(angleRad) * radius);
      canvas.drawCircle(tx, ty, thumbRadius, thumbPaint);
    }
  }
}
