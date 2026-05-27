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
import android.graphics.Color;
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
import com.infini.tv.component.HorizontalProgressBarComponent;
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

abstract class MainActivityPart11 extends MainActivityPart10 {
  protected void bindTransitionDesignTitle(
      String transitionType, boolean horizontal, int screenWidth, int screenHeight, int shortSide) {
    if (transitionDesignTitle == null) {
      return;
    }
    String title =
        "HYDRATE".equals(transitionType)
            ? "HYDRATE"
            : ("REST".equals(transitionType)
                ? "REST"
                : ("SWITCH".equals(transitionType) ? "SWITCH" : ("MOVE_ZONE".equals(transitionType) ? "MOVE\nZONE" : "MOVE\nSTATION")));
    transitionDesignTitle.setText(title);
    boolean hydrate = "HYDRATE".equals(transitionType);
    boolean rest = "REST".equals(transitionType);
    boolean moveStation = !"HYDRATE".equals(transitionType) && !"REST".equals(transitionType);
    transitionDesignTitle.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        horizontal
            ? clampPx(shortSide * (rest ? 0.15f : 0.13f), sp(92), sp(150))
            : clampPx(
                shortSide * (moveStation ? 0.105f : (rest ? 0.12f : 0.105f)),
                shortSide * 0.075f,
                shortSide * (hydrate ? 0.13f : 0.14f)));
    int width = horizontal ? clamp(Math.round(screenWidth * 0.44f), dp(560), dp(860))
        : FrameLayout.LayoutParams.MATCH_PARENT;
    int height = FrameLayout.LayoutParams.WRAP_CONTENT;
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
    if (horizontal) {
      params.leftMargin = Math.round(screenWidth * 0.51f);
      params.topMargin =
          Math.round(
              screenHeight
                  * (hydrate ? 0.52f : (rest ? 0.56f : 0.48f)));
      transitionDesignTitle.setGravity(android.view.Gravity.CENTER);
    } else {
      params.leftMargin = 0;
      params.rightMargin = 0;
      params.topMargin =
          Math.round(screenHeight * (hydrate ? 0.74f : (rest ? 0.69f : 0.72f)));
      transitionDesignTitle.setGravity(android.view.Gravity.CENTER);
    }
    transitionDesignTitle.setLayoutParams(params);
    transitionDesignTitle.setVisibility(View.VISIBLE);
    transitionDesignTitle.bringToFront();
  }

  protected void bindTransitionDesignSubtitle(
      String subtitle, String transitionType, boolean horizontal, int screenWidth, int screenHeight, int shortSide) {
    if (transitionDesignSubtitle == null) {
      return;
    }
    transitionDesignSubtitle.setVisibility(View.GONE);
    transitionDesignSubtitle.setText("");
  }

  protected void hideTransitionDesign() {
    if (transitionDesignPanel != null) {
      transitionDesignPanel.setVisibility(View.GONE);
    }
    if (transitionDesignCountdown != null) {
      transitionDesignCountdown.setText("");
    }
    if (transitionDesignRingContainer != null) {
      transitionDesignRingContainer.setVisibility(View.GONE);
    }
    if (transitionDesignIcon != null) {
      transitionDesignIcon.setVisibility(View.GONE);
      transitionDesignIcon.setImageDrawable(null);
    }
    if (transitionDesignTitle != null) {
      transitionDesignTitle.setVisibility(View.GONE);
      transitionDesignTitle.setText("");
    }
    if (transitionDesignSubtitle != null) {
      transitionDesignSubtitle.setVisibility(View.GONE);
      transitionDesignSubtitle.setText("");
    }
    if (transitionDesignLogo != null) {
      transitionDesignLogo.setVisibility(View.GONE);
    }
    hideSwitchTransitionDiagram();
    transitionDesignProgressKey = "";
    transitionDesignTotalSeconds = 0;
  }

  protected boolean isSupportedTransitionDesign(String transitionType) {
    return "HYDRATE".equals(transitionType)
        || "REST".equals(transitionType)
        || "MOVE_STATION".equals(transitionType)
        || "SWITCH".equals(transitionType)
        || "MOVE_ZONE".equals(transitionType);
  }

  protected void showHorizontalFinishState() {
    hideTransitionDesign();
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    contentPanel.setPadding(0, 0, 0, 0);
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.VISIBLE);
    if (playbackStatusGroup != null) {
      playbackStatusGroup.setVisibility(View.GONE);
    }
    if (playbackHint != null) {
      playbackHint.setVisibility(View.GONE);
    }
    if (playbackScrollView != null) {
      playbackScrollView.setVisibility(View.GONE);
    }
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
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
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (finishPanel != null) {
      finishPanel.setVisibility(View.VISIBLE);
    }
    bindFinishContent(activePlaybackItem == null ? "" : activePlaybackItem.logoSource);
    lastTrainingSignature = "";
  }

  protected void renderHorizontalDots(int completedDots, int totalDots) {
    if (horizontalStateDotsRow == null) {
      return;
    }
    horizontalStateDotsRow.removeAllViews();
    horizontalStateDotsRow.setVisibility(View.GONE);
  }

  protected void renderHorizontalProgressBar(CourseScript course, int elapsedSeconds, int totalSeconds) {
    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    List<HorizontalProgressBarComponent.WorkSegment> workTimeline =
        buildHorizontalWorkTimeline(course);
    int workElapsedSeconds = resolveHorizontalWorkElapsedSeconds(course, elapsedSeconds);
    int totalWorkSeconds = getHorizontalWorkTotalSeconds(workTimeline);
    HorizontalProgressBarComponent.render(
        horizontalProgressRow,
        workTimeline,
        workElapsedSeconds,
        totalWorkSeconds,
        shortSide);
  }

  protected void configureVerticalPlaybackHeader(boolean previewHeader) {
    if (playbackTimerCard == null || playbackStageCard == null) {
      return;
    }

    LinearLayout.LayoutParams timerParams =
        (LinearLayout.LayoutParams) playbackTimerCard.getLayoutParams();
    LinearLayout.LayoutParams stageParams =
        (LinearLayout.LayoutParams) playbackStageCard.getLayoutParams();
    if (previewHeader) {
      playbackTimerCard.setVisibility(View.GONE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = LinearLayout.LayoutParams.MATCH_PARENT;
        stageParams.weight = 0f;
        stageParams.leftMargin = 0;
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(20), dp(14), dp(20), dp(14));
    } else {
      playbackTimerCard.setVisibility(View.VISIBLE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0.28f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = 0;
        stageParams.weight = 0.72f;
        stageParams.leftMargin = clamp(Math.round(
            Math.min(
                    getResources().getDisplayMetrics().widthPixels,
                    getResources().getDisplayMetrics().heightPixels)
                * 0.02f), dp(8), dp(16));
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(22), dp(14), dp(22), dp(14));
    }
    if (playbackStageCard instanceof LinearLayout) {
      ((LinearLayout) playbackStageCard).setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageLabel != null) {
      playbackStageLabel.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageProgress != null) {
      playbackStageProgress.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageSecondary != null) {
      playbackStageSecondary.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageDotsRow != null) {
      playbackStageDotsRow.setGravity(android.view.Gravity.CENTER);
    }
  }

  protected void configureHorizontalMainLayout(boolean finishMode) {
    if (horizontalCountdownText == null || horizontalStateText == null) {
      return;
    }

    View countdownColumn =
        horizontalRingContainer != null ? horizontalRingContainer : horizontalCountdownText;
    View stateColumn =
        horizontalStateColumn != null
            ? horizontalStateColumn
            : (horizontalStateText.getParent() instanceof View ? (View) horizontalStateText.getParent() : null);
    if (finishMode) {
      countdownColumn.setVisibility(View.GONE);
      if (horizontalLogoText != null) {
        horizontalLogoText.setVisibility(View.GONE);
      }
      if (stateColumn instanceof LinearLayout) {
        ((LinearLayout) stateColumn).setGravity(android.view.Gravity.CENTER);
        ((LinearLayout) stateColumn).setPadding(0, 0, 0, 0);
      }
      ViewGroup.LayoutParams rawStateParams = stateColumn == null ? null : stateColumn.getLayoutParams();
      if (rawStateParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams stateParams = (FrameLayout.LayoutParams) rawStateParams;
        stateParams.width = FrameLayout.LayoutParams.MATCH_PARENT;
        stateParams.height = FrameLayout.LayoutParams.MATCH_PARENT;
        stateParams.gravity = android.view.Gravity.CENTER;
        stateParams.leftMargin = dp(48);
        stateParams.topMargin = 0;
        stateParams.rightMargin = dp(48);
        stateParams.bottomMargin = 0;
        stateColumn.setLayoutParams(stateParams);
      }
      horizontalStateText.setGravity(android.view.Gravity.CENTER);
      horizontalStateText.setSingleLine(false);
      horizontalStateText.setMaxLines(1);
    } else {
      countdownColumn.setVisibility(View.VISIBLE);
      horizontalCountdownText.setVisibility(View.VISIBLE);
      if (horizontalLogoText != null) {
        horizontalLogoText.setVisibility(View.GONE);
      }
      if (stateColumn instanceof LinearLayout) {
        LinearLayout column = (LinearLayout) stateColumn;
        column.setGravity(android.view.Gravity.CENTER);
        column.setPadding(0, 0, 0, 0);
        if (column.getChildCount() > 0 && column.getChildAt(0) instanceof LinearLayout) {
          ((LinearLayout) column.getChildAt(0)).setGravity(android.view.Gravity.CENTER);
        }
      }
      horizontalStateText.setGravity(android.view.Gravity.CENTER);
      horizontalStateText.setSingleLine(false);
      horizontalStateText.setMaxLines(3);
      if (horizontalStateDotsRow != null) {
        horizontalStateDotsRow.removeAllViews();
        horizontalStateDotsRow.setVisibility(View.GONE);
      }
    }
  }

  protected List<HorizontalProgressBarComponent.WorkSegment> buildHorizontalWorkTimeline(CourseScript course) {
    List<HorizontalProgressBarComponent.WorkSegment> segments = new ArrayList<>();
    for (HorizontalWorkTiming timing : buildHorizontalWorkTimings(course)) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.workStartSeconds,
              timing.durationSeconds,
              timing.markerAfter));
    }

    return segments;
  }

  protected int getHorizontalWorkTotalSeconds(
      List<HorizontalProgressBarComponent.WorkSegment> segments) {
    if (segments == null || segments.isEmpty()) {
      return 0;
    }

    int totalSeconds = 0;
    for (HorizontalProgressBarComponent.WorkSegment segment : segments) {
      if (segment != null) {
        totalSeconds += Math.max(segment.durationSeconds, 0);
      }
    }
    return totalSeconds;
  }

  protected int resolveHorizontalWorkElapsedSeconds(CourseScript course, int elapsedSeconds) {
    int safeElapsedSeconds = Math.max(elapsedSeconds, 0);
    int workElapsedSeconds = 0;
    for (HorizontalWorkTiming timing : buildHorizontalWorkTimings(course)) {
      if (timing == null || timing.durationSeconds <= 0) {
        continue;
      }
      if (safeElapsedSeconds < timing.realStartSeconds) {
        return workElapsedSeconds;
      }
      int realEndSeconds = timing.realStartSeconds + timing.durationSeconds;
      if (safeElapsedSeconds < realEndSeconds) {
        return timing.workStartSeconds + Math.max(safeElapsedSeconds - timing.realStartSeconds, 0);
      }
      workElapsedSeconds = timing.workStartSeconds + timing.durationSeconds;
    }
    return workElapsedSeconds;
  }

  protected List<HorizontalWorkTiming> buildHorizontalWorkTimings(CourseScript course) {
    List<HorizontalWorkTiming> timings = new ArrayList<>();
    if (course == null || course.pods == null) {
      return timings;
    }

    int realTrainingOffsetSeconds = 0;
    int workOffsetSeconds = 0;
    for (CourseScript.Pod pod : course.pods) {
      EffectivePodScreen effectiveScreen = materializeProgressPodScreen(course, pod);
      int firstIndex = timings.size();
      workOffsetSeconds =
          addHorizontalWorkTimings(
              timings,
              pod,
              effectiveScreen,
              realTrainingOffsetSeconds,
              workOffsetSeconds);

      int podDurationSeconds = getPodDurationSeconds(pod, effectiveScreen);
      int endingDurationSeconds = getPodEndingDurationSeconds(course, pod);
      if (endingDurationSeconds > 0 && isProgressMarkerPod(pod) && timings.size() > firstIndex) {
        timings.get(timings.size() - 1).markerAfter = true;
      }
      realTrainingOffsetSeconds += podDurationSeconds + endingDurationSeconds;
    }
    return timings;
  }

  protected void addHorizontalWorkSegments(
      List<HorizontalProgressBarComponent.WorkSegment> segments,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int podOffsetSeconds) {
    if (segments == null) {
      return;
    }

    List<HorizontalWorkTiming> timings = new ArrayList<>();
    addHorizontalWorkTimings(timings, pod, effectiveScreen, podOffsetSeconds, podOffsetSeconds);
    for (HorizontalWorkTiming timing : timings) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.workStartSeconds,
              timing.durationSeconds,
              false));
    }
  }

  protected int addHorizontalWorkTimings(
      List<HorizontalWorkTiming> timings,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int realPodOffsetSeconds,
      int workOffsetSeconds) {
    if (timings == null
        || pod == null
        || effectiveScreen == null
        || effectiveScreen.rule == null
        || effectiveScreen.rule.setConfigs == null
        || effectiveScreen.rule.setConfigs.isEmpty()
        || effectiveScreen.videoCards == null
        || effectiveScreen.videoCards.isEmpty()) {
      return workOffsetSeconds;
    }

    if ("SWITCH".equals(pod.stationFlow) && effectiveScreen.videoCards.size() >= 2) {
      return addHorizontalSwitchWorkTimings(timings, effectiveScreen, realPodOffsetSeconds, workOffsetSeconds);
    }

    List<CourseScript.VideoCard> actionSequence = new ArrayList<>();
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      actionSequence.addAll(effectiveScreen.videoCards);
    }

    int screenOffsetSeconds = 0;
    for (int actionIndex = 0; actionIndex < actionSequence.size(); actionIndex += 1) {
      for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
        int workSeconds = Math.max(setConfig == null ? 0 : setConfig.workSeconds, 0);
        if (workSeconds > 0) {
          timings.add(
              new HorizontalWorkTiming(
                  realPodOffsetSeconds + screenOffsetSeconds,
                  workOffsetSeconds,
                  workSeconds));
          workOffsetSeconds += workSeconds;
        }
        screenOffsetSeconds += workSeconds;

        boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
        if (hasNextSet && setConfig != null && setConfig.restSeconds > 0) {
          screenOffsetSeconds += setConfig.restSeconds;
        }
      }

      boolean hasNextAction = actionIndex < actionSequence.size() - 1;
      if (hasNextAction && effectiveScreen.rule.stationRestSeconds > 0) {
        screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
      }
    }
    return workOffsetSeconds;
  }

  protected void addHorizontalSwitchWorkSegments(
      List<HorizontalProgressBarComponent.WorkSegment> segments,
      EffectivePodScreen effectiveScreen,
      int podOffsetSeconds) {
    if (segments == null) {
      return;
    }
    List<HorizontalWorkTiming> timings = new ArrayList<>();
    addHorizontalSwitchWorkTimings(timings, effectiveScreen, podOffsetSeconds, podOffsetSeconds);
    for (HorizontalWorkTiming timing : timings) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.workStartSeconds,
              timing.durationSeconds,
              false));
    }
  }

  protected int addHorizontalSwitchWorkTimings(
      List<HorizontalWorkTiming> timings,
      EffectivePodScreen effectiveScreen,
      int realPodOffsetSeconds,
      int workOffsetSeconds) {
    int screenOffsetSeconds = 0;
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int pairCount = effectiveScreen.videoCards.size() / 2;
    if (pairCount <= 0) {
      return workOffsetSeconds;
    }

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
          int workSeconds = Math.max(setConfig == null ? 0 : setConfig.workSeconds, 0);
          if (workSeconds > 0) {
            timings.add(
                new HorizontalWorkTiming(
                    realPodOffsetSeconds + screenOffsetSeconds,
                    workOffsetSeconds,
                    workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          if (effectiveScreen.rule.stationRestSeconds > 0) {
            screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
          }

          if (workSeconds > 0) {
            timings.add(
                new HorizontalWorkTiming(
                    realPodOffsetSeconds + screenOffsetSeconds,
                    workOffsetSeconds,
                    workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
          if (hasNextSet && setConfig != null && setConfig.restSeconds > 0) {
            screenOffsetSeconds += setConfig.restSeconds;
          }
        }

        boolean hasNextPairRound = pairIndex < pairCount - 1 || loopIndex < safeLoops - 1;
        if (hasNextPairRound && effectiveScreen.rule.stationRestSeconds > 0) {
          screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
        }
      }
    }
    return workOffsetSeconds;
  }

  protected EffectivePodScreen materializeProgressPodScreen(CourseScript course, CourseScript.Pod pod) {
    CourseScript.VideoGroup group = findVideoGroup(course, pod == null ? null : pod.videoGroupId);
    if (group == null) {
      return null;
    }
    if (group.screenCount <= 1) {
      return materializePodScreen(pod, group, 1);
    }

    EffectivePodScreen bestScreen = null;
    int bestWorkSegmentCount = -1;
    for (int screenIndex = 1; screenIndex <= Math.max(group.screenCount, 3); screenIndex += 1) {
      if (findPodScreen(pod, screenIndex) == null || findVideoGroupScreen(group, screenIndex) == null) {
        continue;
      }
      EffectivePodScreen candidate = materializePodScreen(pod, group, screenIndex);
      int workSegmentCount = countHorizontalProgressWorkSegments(pod, candidate);
      if (candidate != null && workSegmentCount > bestWorkSegmentCount) {
        bestScreen = candidate;
        bestWorkSegmentCount = workSegmentCount;
      }
    }
    return bestScreen;
  }

  protected int countHorizontalProgressWorkSegments(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen) {
    if (pod == null
        || effectiveScreen == null
        || effectiveScreen.rule == null
        || effectiveScreen.rule.setConfigs == null
        || effectiveScreen.rule.setConfigs.isEmpty()
        || effectiveScreen.videoCards == null
        || effectiveScreen.videoCards.isEmpty()) {
      return 0;
    }

    int positiveWorkSetCount = 0;
    for (CourseScript.PodSetConfig setConfig : effectiveScreen.rule.setConfigs) {
      if (setConfig != null && setConfig.workSeconds > 0) {
        positiveWorkSetCount += 1;
      }
    }
    if (positiveWorkSetCount <= 0) {
      return 0;
    }

    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    if ("SWITCH".equals(pod.stationFlow) && effectiveScreen.videoCards.size() >= 2) {
      int pairCount = effectiveScreen.videoCards.size() / 2;
      return pairCount * safeLoops * positiveWorkSetCount * 2;
    }
    return effectiveScreen.videoCards.size() * safeLoops * positiveWorkSetCount;
  }

  protected boolean isProgressMarkerPod(CourseScript.Pod pod) {
    return pod != null && ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending));
  }

  protected int getCourseTotalSeconds(CourseScript course) {
    if (course == null) {
      return 0;
    }
    return getWarmupReadySeconds(course)
        + getWaterfallTotalSeconds(course.warmup)
        + getTrainingReadySeconds(course)
        + getTrainingTotalSeconds(course)
        + getCooldownReadySeconds(course)
        + getWaterfallTotalSeconds(course.cooldown);
  }

  protected String resolveHorizontalTransitionHint(TrainingPlaybackState state) {
    return "";
  }

  protected String formatHorizontalStateTitle(String title) {
    if (title == null || title.trim().isEmpty()) {
      return "WAITING";
    }
    return title.toUpperCase(Locale.US);
  }

  protected int resolveHorizontalTransitionIcon(String transitionType) {
    if ("HYDRATE".equals(transitionType)) {
      return R.drawable.icon_water;
    }
    if ("MOVE_STATION".equals(transitionType) || "MOVE_ZONE".equals(transitionType) || "SWITCH".equals(transitionType)) {
      return R.drawable.icon_cicle;
    }
    if ("REST".equals(transitionType)) {
      return R.drawable.icon_heart;
    }
    return 0;
  }

  protected int getHorizontalTransitionBackgroundColor(String transitionType) {
    return getColor(R.color.tv_playback_background);
  }

  protected int parseSafeInt(String value) {
    if (value == null || value.trim().isEmpty()) {
      return 0;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ignored) {
      return 0;
    }
  }

  protected static final class HorizontalWorkTiming {
    final int realStartSeconds;
    final int workStartSeconds;
    final int durationSeconds;
    boolean markerAfter;

    HorizontalWorkTiming(int realStartSeconds, int workStartSeconds, int durationSeconds) {
      this.realStartSeconds = Math.max(realStartSeconds, 0);
      this.workStartSeconds = Math.max(workStartSeconds, 0);
      this.durationSeconds = Math.max(durationSeconds, 0);
      this.markerAfter = false;
    }
  }
}
