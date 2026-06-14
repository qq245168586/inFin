package com.infini.tv;

import android.content.ComponentName;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.security.NetworkSecurityPolicy;
import android.text.TextUtils;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.VideoView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import com.infini.tv.component.horizontal.HorizontalProgressBarComponent;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import com.infini.tv.mqtt.TvMqttManager;
import com.infini.tv.repository.ServerConfig;
import com.infini.tv.repository.TvScriptRepository;
import com.infini.tv.service.ImageLoader;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

abstract class MainActivityPart10 extends MainActivityPart09 {
  protected void showVerticalPreviewState(CourseScript course) {
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, false);
    configureVerticalPlaybackHeader(true);
    hideFinishPanel();
    showPlaybackScroller();
    playbackCountdownText.setText("");
    playbackStageLabel.setText("");
    playbackStageProgress.setText("PREVIEW");
    renderStageMeta("", 0, 0);
    playbackHint.setVisibility(View.GONE);

    CourseScript.Pod firstPod =
        course == null || course.pods == null || course.pods.isEmpty() ? null : course.pods.get(0);
    EffectivePodScreen previewScreen =
        materializePodScreen(
            firstPod,
            findVideoGroup(course, firstPod == null ? null : firstPod.videoGroupId),
            getDisplayScreenIndex());

    if (previewScreen == null || previewScreen.videoCards == null || previewScreen.videoCards.isEmpty()) {
      showPlaybackMessage("", "PREVIEW", "");
      return;
    }

    if (previewScreen.waterfallLayout) {
      String waterfallSignature = buildTrainingWaterfallSignature(previewScreen.videoCards);
      if (!"PREVIEW_WATERFALL".equals(lastPlaybackMode)
          || !waterfallSignature.equals(lastWaterfallSignature)) {
        lastPlaybackMode = "PREVIEW_WATERFALL";
        lastWaterfallSignature = waterfallSignature;
        lastTrainingSignature = "";
        lastWaterfallIndex = -1;
        lastWaterfallWindowStart = -1;
        trainingCardsContainer.removeAllViews();
        trainingCardsContainer.setVisibility(View.GONE);
        warmupRowsContainer.setVisibility(View.VISIBLE);
        buildTrainingWaterfallRows(previewScreen.videoCards);
      }
      updateWaterfallRows(0, 0);
      scrollWaterfallToWindowStart(0);
      return;
    }

    lastPlaybackMode = "PREVIEW_TRAINING";
    lastWaterfallSignature = "";
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.setVisibility(View.VISIBLE);
    List<Integer> rowLayouts = getRowLayoutsForScreen(previewScreen);
    String layoutSignature = buildTrainingLayoutSignature(previewScreen.videoCards, rowLayouts);
    if (!layoutSignature.equals(lastTrainingSignature)) {
      renderTrainingCards(
          new TrainingPlaybackState(
              "preview|" + layoutSignature,
              "",
              "PREVIEW",
              "",
              0,
              previewScreen.videoCards,
              -1,
              false,
              false,
              false,
              false,
              "",
              rowLayouts));
      lastTrainingSignature = layoutSignature;
    }
  }

  protected void showHorizontalPreviewState(CourseScript course) {
    TrainingPlaybackState previewState = buildPreviewTrainingState(course);
    if (previewState == null) {
      showHorizontalMainState(course, 0, "PREVIEW", "", 0, 0);
      return;
    }

    showHorizontalMainState(
        course,
        Math.max(previewState.remainingSeconds, 0),
        previewState.stageProgress == null || previewState.stageProgress.trim().isEmpty()
            ? "WORK"
            : previewState.stageProgress,
        previewState.stageSecondaryText,
        previewState.completedDots,
        previewState.totalDots);
  }

  protected void showHorizontalMainState(
      CourseScript course,
      int remainingSeconds,
      String primaryText,
      String secondaryText,
      int completedDots,
      int totalDots) {
    configureHorizontalMainLayout(false);
    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    contentPanel.setPadding(0, 0, 0, 0);
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.VISIBLE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.VISIBLE);
    }
    hideTransitionDesign();
    if (horizontalCountdownText != null) {
      horizontalCountdownText.setText(formatCountdownSeconds(remainingSeconds));
    }
    String safePrimary = primaryText == null || primaryText.trim().isEmpty() ? "WAITING" : primaryText;
    if (horizontalRingProgress != null) {
      horizontalRingProgress.setColors(
          getColor(R.color.tv_horizontal_progress_inactive),
          resolvePlaybackStateColor(safePrimary, secondaryText),
          0x00ffffff);
      horizontalRingProgress.setDrawThumb(false);
      int safeRemaining = Math.max(remainingSeconds, 0);
      String ringKey =
          safePrimary
              + "|"
              + (secondaryText == null ? "" : secondaryText)
              + "|"
              + completedDots
              + "|"
              + totalDots;
      if (!ringKey.equals(horizontalRingProgressKey)
          || safeRemaining > horizontalRingTotalSeconds
          || horizontalRingTotalSeconds <= 0) {
        horizontalRingProgressKey = ringKey;
        horizontalRingTotalSeconds = Math.max(safeRemaining, 1);
      }
      float p = safeRemaining <= 0 ? 0f : (safeRemaining / (float) Math.max(horizontalRingTotalSeconds, 1));
      horizontalRingProgress.setProgress(p);
    }
    if (horizontalStateText != null) {
      horizontalStateText.setText(safePrimary);
      applyHorizontalStateTextSize(safePrimary);
      horizontalStateText.setMaxLines(totalDots > 0 ? 2 : 3);
      if (horizontalStateIcon != null) {
        horizontalStateIcon.setVisibility("WORK".equalsIgnoreCase(safePrimary.trim()) ? View.VISIBLE : View.GONE);
      }
    }
    if (horizontalStateSecondary != null) {
      if (secondaryText == null || secondaryText.trim().isEmpty() || totalDots > 0) {
        horizontalStateSecondary.setVisibility(View.GONE);
      } else {
        horizontalStateSecondary.setVisibility(View.VISIBLE);
        horizontalStateSecondary.setText(secondaryText);
        horizontalStateSecondary.setGravity(android.view.Gravity.CENTER);
      }
    }
    renderHorizontalDots(completedDots, totalDots);
    renderHorizontalProgressBar(course, currentTrainingElapsedSeconds, currentTrainingTotalSeconds);
  }

  protected void applyHorizontalStateTextSize(String stateText) {
    if (horizontalStateText == null) {
      return;
    }
    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    String normalized = stateText == null ? "" : stateText.trim().toUpperCase(Locale.US);
    boolean compact = normalized.contains("COOL DOWN");
    boolean ready = normalized.replaceAll("\\s+", " ").contains("READY FOR");
    horizontalStateText.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        ready
            ? clampPx(shortSide * 0.118f, sp(82), sp(132))
            : compact
            ? clampPx(shortSide * 0.068f, sp(42), sp(74))
            : clampPx(shortSide * 0.112f, sp(72), sp(124)));
  }

  protected boolean isHorizontalReadyRingState(String primaryText) {
    String normalized =
        primaryText == null
            ? ""
            : primaryText.trim().toUpperCase(Locale.US).replaceAll("\\s+", " ");
    return "READY FOR WARM UP".equals(normalized) || "READY FOR WORKOUT".equals(normalized);
  }

  protected void showHorizontalTrainingState(CourseScript course, TrainingPlaybackState state) {
    if (state == null) {
      showHorizontalMainState(course, 0, "WAITING", "", 0, 0);
      return;
    }

    String primaryText =
        state.stageProgress == null || state.stageProgress.trim().isEmpty()
            ? "TRAINING"
            : state.stageProgress;
    showHorizontalMainState(
        course,
        Math.max(state.remainingSeconds, 0),
        primaryText,
        state.stageSecondaryText,
        state.completedDots,
        state.totalDots);
  }

  protected void showHorizontalTransitionState(TrainingPlaybackState state) {
    renderHorizontalProgressBar(
        activePlaybackItem == null ? null : activePlaybackItem.course,
        currentTrainingElapsedSeconds,
        currentTrainingTotalSeconds);
    showTransitionDesignState(state, true);
  }

  protected void showTransitionDesignState(TrainingPlaybackState state, boolean horizontal) {
    if (!isSupportedTransitionDesign(state == null ? "" : state.transitionType) || transitionDesignPanel == null) {
      showHorizontalMainState(
          activePlaybackItem == null ? null : activePlaybackItem.course,
          Math.max(state == null ? 0 : state.remainingSeconds, 0),
          formatHorizontalStateTitle(state == null ? "" : state.stageProgress),
          "",
          0,
          0);
      return;
    }

    String transitionType = state == null ? "" : state.transitionType;
    hideFinishPanel();
    transitionDesignPanel.setBackgroundColor(getTransitionBackgroundColor(transitionType));
    transitionDesignPanel.setVisibility(View.VISIBLE);
    transitionDesignPanel.bringToFront();
    updateTransitionDesignControls(
        Math.max(state == null ? 0 : state.remainingSeconds, 0),
        transitionType,
        state == null ? "" : state.renderKey,
        state == null ? "" : state.hintText,
        horizontal);
  }

  protected void updateTransitionDesignControls(
      int remainingSeconds, String transitionType, String renderKey, String subtitle, boolean horizontal) {
    if (transitionDesignCountdown == null || transitionDesignRingContainer == null || transitionDesignPanel == null) {
      return;
    }
    View parentView = transitionDesignPanel;
    int screenWidth =
        parentView != null && parentView.getWidth() > 0
            ? parentView.getWidth()
            : getResources().getDisplayMetrics().widthPixels;
    int screenHeight =
        parentView != null && parentView.getHeight() > 0
            ? parentView.getHeight()
            : getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    boolean hydrate = "HYDRATE".equals(transitionType);
    boolean rest = "REST".equals(transitionType);
    boolean finish = "FINISH".equals(transitionType);
    boolean work = "WORK".equals(transitionType);
    int ringSize =
        horizontal
            ? clamp(Math.round(shortSide * 0.62f), dp(500), dp(760))
            : clamp(
                Math.round(shortSide * (hydrate || finish || work ? 0.66f : 0.68f)),
                Math.round(shortSide * 0.54f),
                Math.round(shortSide * 0.76f));
    float centerX = horizontal ? 0.30f : 0.5f;
    float centerY =
        horizontal
            ? 0.50f
            : (hydrate || finish || work ? 0.48f : (rest ? 0.47f : 0.46f));
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(ringSize, ringSize);
    params.leftMargin = Math.round(screenWidth * centerX - ringSize / 2f);
    params.topMargin = Math.round(screenHeight * centerY - ringSize / 2f);
    transitionDesignRingContainer.setLayoutParams(params);
    transitionDesignRingContainer.setVisibility(View.VISIBLE);
    if (transitionDesignRing != null) {
      transitionDesignRing.setStrokeWidthPx(
          horizontal
              ? clampPx(shortSide * 0.06f, dp(44), dp(74))
              : clampPx(shortSide * 0.065f, shortSide * 0.048f, shortSide * 0.08f));
      transitionDesignRing.setColors(
          0x66ffffff,
          getColor(R.color.tv_text_main),
          0x00ffffff);
      transitionDesignRing.setDrawThumb(false);
      String progressKey = transitionType + "|" + renderKey;
      if (!progressKey.equals(transitionDesignProgressKey)
          || remainingSeconds > transitionDesignTotalSeconds
          || transitionDesignTotalSeconds <= 0) {
        transitionDesignProgressKey = progressKey;
        transitionDesignTotalSeconds = Math.max(remainingSeconds, 1);
      }
      float progress =
          remainingSeconds <= 0
              ? 0f
              : remainingSeconds / (float) Math.max(transitionDesignTotalSeconds, 1);
      transitionDesignRing.setProgress(progress);
    }
    transitionDesignCountdown.setText(formatCountdownSeconds(remainingSeconds));
    transitionDesignCountdown.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        horizontal
            ? clampPx(shortSide * 0.22f, sp(150), sp(280))
            : clampPx(shortSide * 0.30f, shortSide * 0.20f, shortSide * 0.34f));
    if ("SWITCH".equals(transitionType)) {
      float flowProgress =
          transitionDesignTotalSeconds <= 0
              ? 0f
              : 1f - (Math.max(remainingSeconds, 0) / (float) Math.max(transitionDesignTotalSeconds, 1));
      bindSwitchTransitionDiagram(horizontal, screenWidth, screenHeight, shortSide, flowProgress);
      if (transitionDesignIcon != null) {
        transitionDesignIcon.setVisibility(View.GONE);
        transitionDesignIcon.setImageDrawable(null);
      }
      bindTransitionDesignTitle(transitionType, horizontal, screenWidth, screenHeight, shortSide);
      bindTransitionDesignSubtitle(subtitle, transitionType, horizontal, screenWidth, screenHeight, shortSide);
      if (transitionDesignLogo != null) {
        transitionDesignLogo.setVisibility(View.GONE);
      }
      return;
    }
    hideSwitchTransitionDiagram();
    bindTransitionDesignIcon(transitionType, horizontal, screenWidth, screenHeight, shortSide);
    bindTransitionDesignTitle(transitionType, horizontal, screenWidth, screenHeight, shortSide);
    bindTransitionDesignSubtitle(subtitle, transitionType, horizontal, screenWidth, screenHeight, shortSide);
    if (transitionDesignLogo != null) {
      transitionDesignLogo.setVisibility(View.GONE);
    }
  }

  protected void bindTransitionDesignIcon(
      String transitionType, boolean horizontal, int screenWidth, int screenHeight, int shortSide) {
    if (transitionDesignIcon == null) {
      return;
    }
    if ("FINISH".equals(transitionType) || "WORK".equals(transitionType)) {
      transitionDesignIcon.setVisibility(View.GONE);
      transitionDesignIcon.setImageDrawable(null);
      return;
    }
    int iconRes =
        "HYDRATE".equals(transitionType)
            ? R.drawable.icon_water
            : ("REST".equals(transitionType) ? R.drawable.icon_heart : R.drawable.icon_cicle);
    transitionDesignIcon.setImageResource(iconRes);
    transitionDesignIcon.setColorFilter(getColor(R.color.tv_text_main));
    int width;
    int height;
    float centerX;
    float centerY;
    if ("HYDRATE".equals(transitionType)) {
      width = horizontal ? clamp(Math.round(shortSide * 0.16f), dp(128), dp(200))
          : clamp(
              Math.round(shortSide * 0.15f),
              Math.round(shortSide * 0.11f),
              Math.round(shortSide * 0.18f));
      height = Math.round(width * (450f / 282f));
      centerX = horizontal ? 0.72f : 0.5f;
      centerY = horizontal ? 0.28f : 0.16f;
    } else if ("REST".equals(transitionType)) {
      width =
          horizontal
              ? clamp(Math.round(shortSide * 0.22f), dp(180), dp(260))
              : clamp(Math.round(shortSide * 0.28f), Math.round(shortSide * 0.20f), Math.round(shortSide * 0.34f));
      height = Math.round(width * (338f / 360f));
      centerX = horizontal ? 0.72f : 0.5f;
      centerY = horizontal ? 0.23f : 0.18f;
    } else {
      width = horizontal ? clamp(Math.round(screenWidth * 0.34f), dp(520), dp(740))
          : clamp(
              Math.round(shortSide * 0.58f),
              Math.round(shortSide * 0.46f),
              Math.round(shortSide * 0.70f));
      height = Math.round(width * (476f / 1050f));
      centerX = horizontal ? 0.72f : 0.5f;
      centerY = horizontal ? 0.30f : 0.16f;
    }
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
    params.leftMargin = Math.round(screenWidth * centerX - width / 2f);
    params.topMargin = Math.round(screenHeight * centerY - height / 2f);
    transitionDesignIcon.setLayoutParams(params);
    transitionDesignIcon.setVisibility(View.VISIBLE);
    transitionDesignIcon.bringToFront();
  }

  protected void bindSwitchTransitionDiagram(
      boolean horizontal, int screenWidth, int screenHeight, int shortSide, float flowProgress) {
    if (!(transitionDesignPanel instanceof FrameLayout)) {
      return;
    }
    FrameLayout panel = (FrameLayout) transitionDesignPanel;
    if (switchTransitionDiagram == null) {
      switchTransitionDiagram = new FrameLayout(this);
      panel.addView(switchTransitionDiagram);
    }
    switchTransitionDiagram.removeAllViews();

    int width =
        horizontal
            ? clamp(Math.round(screenWidth * 0.54f), dp(760), dp(1120))
            : clamp(Math.round(shortSide * 0.92f), Math.round(shortSide * 0.82f), Math.round(shortSide * 0.98f));
    int height =
        horizontal
            ? clamp(Math.round(shortSide * 0.42f), dp(320), dp(500))
            : clamp(Math.round(shortSide * 0.40f), Math.round(shortSide * 0.32f), Math.round(shortSide * 0.50f));
    float centerX = horizontal ? 0.72f : 0.5f;
    float centerY = horizontal ? 0.25f : 0.16f;
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
    params.leftMargin = Math.round(screenWidth * centerX - width / 2f);
    params.topMargin = Math.round(screenHeight * centerY - height / 2f);
    switchTransitionDiagram.setLayoutParams(params);
    switchTransitionDiagram.setVisibility(View.VISIBLE);

    int nodeSize = clamp(Math.round(height * 0.58f), dp(138), dp(230));
    int lineHeight = clamp(Math.round(height * 0.064f), dp(18), dp(32));
    int nodeGap = clamp(Math.round(nodeSize * 0.07f), dp(8), dp(18));
    int lineLeft = nodeSize + nodeGap;
    int lineRight = width - nodeSize - nodeGap;
    int lineWidth = Math.max(lineRight - lineLeft, dp(220));
    int topCenterY = Math.round(height * 0.32f);
    int bottomCenterY = Math.round(height * 0.66f);

    int railHeight = lineHeight * 3;
    SwitchFlowLineView topLine = new SwitchFlowLineView(this);
    topLine.bind(flowProgress, true, true, lineHeight);
    FrameLayout.LayoutParams topLineParams = new FrameLayout.LayoutParams(lineWidth, railHeight);
    topLineParams.leftMargin = lineLeft;
    topLineParams.topMargin = topCenterY - railHeight / 2;
    switchTransitionDiagram.addView(topLine, topLineParams);

    SwitchFlowLineView bottomLine = new SwitchFlowLineView(this);
    bottomLine.bind(flowProgress, false, false, lineHeight);
    FrameLayout.LayoutParams bottomLineParams = new FrameLayout.LayoutParams(lineWidth, railHeight);
    bottomLineParams.leftMargin = lineLeft;
    bottomLineParams.topMargin = bottomCenterY - railHeight / 2;
    switchTransitionDiagram.addView(bottomLine, bottomLineParams);

    TextView leftNode = createSwitchNode("A", nodeSize);
    FrameLayout.LayoutParams leftParams = new FrameLayout.LayoutParams(nodeSize, nodeSize);
    leftParams.leftMargin = 0;
    leftParams.topMargin = Math.round(height * 0.48f - nodeSize / 2f);
    switchTransitionDiagram.addView(leftNode, leftParams);

    TextView rightNode = createSwitchNode("B", nodeSize);
    FrameLayout.LayoutParams rightParams = new FrameLayout.LayoutParams(nodeSize, nodeSize);
    rightParams.leftMargin = width - nodeSize;
    rightParams.topMargin = leftParams.topMargin;
    switchTransitionDiagram.addView(rightNode, rightParams);

    switchTransitionDiagram.bringToFront();
  }

  protected void addSwitchFlowSegments(
      FrameLayout diagram,
      int left,
      int top,
      int width,
      int height,
      float progress,
      boolean primary,
      boolean leftToRight) {
    int segmentCount = 8;
    int gap = dp(10);
    int segmentWidth = Math.max((width - gap * (segmentCount - 1)) / segmentCount, dp(34));
    float normalizedProgress = Math.max(0f, Math.min(1f, progress));
    int activeIndex =
        Math.max(0, Math.min(segmentCount - 1, Math.round(normalizedProgress * (segmentCount - 1))));
    if (!leftToRight) {
      activeIndex = segmentCount - 1 - activeIndex;
    }
    for (int index = 0; index < segmentCount; index += 1) {
      View segment = new View(this);
      int distance = Math.abs(index - activeIndex);
      float alpha;
      if (!primary) {
        alpha = distance == 0 ? 0.88f : distance == 1 ? 0.56f : distance == 2 ? 0.30f : 0.14f;
      } else if (distance == 0) {
        alpha = 1f;
      } else if (distance == 1) {
        alpha = 0.72f;
      } else if (distance == 2) {
        alpha = 0.40f;
      } else {
        alpha = 0.18f;
      }
      segment.setAlpha(alpha);
      segment.setBackground(roundedRect(0xffffffff, height / 2));
      FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(segmentWidth, height);
      params.leftMargin = left + index * (segmentWidth + gap);
      params.topMargin = top;
      diagram.addView(segment, params);
    }
  }

  protected static class SwitchFlowLineView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private float progress = 0f;
    private boolean primary = true;
    private boolean leftToRight = true;
    private int segmentHeight = 20;

    public SwitchFlowLineView(android.content.Context context) {
      super(context);
      setWillNotDraw(false);
    }

    public void bind(float progress, boolean primary, boolean leftToRight, int segmentHeight) {
      this.progress = Math.max(0f, Math.min(1f, progress));
      this.primary = primary;
      this.leftToRight = leftToRight;
      this.segmentHeight = Math.max(segmentHeight, 1);
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
      int arrowLength = Math.round(segmentHeight * 2.15f);
      int arrowInset = Math.max(2, Math.round(segmentHeight * 0.12f));
      int arrowSpace = arrowLength + Math.round(segmentHeight * 0.45f);
      int railStart = leftToRight ? 0 : arrowSpace;
      int railEnd = leftToRight ? width - arrowSpace : width;
      int railWidth = Math.max(railEnd - railStart, segmentHeight * 4);
      int segmentCount = 9;
      int gap = Math.max(4, Math.round(segmentHeight * 0.46f));
      int segmentWidth = Math.max(6, (railWidth - gap * (segmentCount - 1)) / segmentCount);
      float centerY = height / 2f;
      float top = centerY - segmentHeight / 2f;
      float radius = segmentHeight / 2f;
      int activeIndex = Math.round(progress * (segmentCount - 1));
      if (!leftToRight) {
        activeIndex = segmentCount - 1 - activeIndex;
      }

      for (int index = 0; index < segmentCount; index += 1) {
        int distance = Math.abs(index - activeIndex);
        float alpha = distance == 0 ? 1f : distance == 1 ? 0.58f : distance == 2 ? 0.34f : 0.18f;
        if (!primary) {
          alpha *= 0.84f;
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.WHITE);
        paint.setAlpha(Math.round(255 * alpha));
        int x = railStart + index * (segmentWidth + gap);
        rect.set(x, top, x + segmentWidth, top + segmentHeight);
        canvas.drawRoundRect(rect, radius, radius, paint);
      }

      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
      paint.setStrokeWidth(Math.max(6f, segmentHeight * 0.36f));
      paint.setColor(Color.WHITE);
      paint.setAlpha(Math.round(255 * (primary ? 0.96f : 0.82f)));

      float arrowTip = leftToRight ? width - arrowInset : arrowInset;
      float arrowBase = leftToRight ? arrowTip - arrowLength : arrowTip + arrowLength;
      float wing = Math.max(segmentHeight * 0.74f, 10f);
      canvas.drawLine(arrowBase, centerY - wing, arrowTip, centerY, paint);
      canvas.drawLine(arrowBase, centerY + wing, arrowTip, centerY, paint);
    }
  }

  protected void hideSwitchTransitionDiagram() {
    if (switchTransitionDiagram != null) {
      switchTransitionDiagram.setVisibility(View.GONE);
      switchTransitionDiagram.removeAllViews();
    }
  }

  protected TextView createSwitchNode(String text, int size) {
    TextView node = createSwitchText(text, Math.round(size * 0.46f), true);
    node.setBackground(ovalBackground(0x30ffffff, 0xffffffff, Math.max(dp(4), Math.round(size * 0.045f))));
    return node;
  }

  protected TextView createSwitchText(String text, int textSizePx, boolean bold) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextColor(getColor(R.color.tv_text_main));
    view.setGravity(android.view.Gravity.CENTER);
    view.setTextSize(TypedValue.COMPLEX_UNIT_PX, textSizePx);
    view.setIncludeFontPadding(false);
    if (bold) {
      view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
    }
    return view;
  }

  protected GradientDrawable ovalBackground(int fillColor, int strokeColor, int strokeWidth) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setShape(GradientDrawable.OVAL);
    drawable.setColor(fillColor);
    drawable.setStroke(strokeWidth, strokeColor);
    return drawable;
  }

  protected GradientDrawable roundedRect(int fillColor, int radius) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setShape(GradientDrawable.RECTANGLE);
    drawable.setColor(fillColor);
    drawable.setCornerRadius(radius);
    return drawable;
  }
}
