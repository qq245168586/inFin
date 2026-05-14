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

abstract class MainActivityPart13 extends MainActivityPart12 {
  protected PlaybackTheme getThemeForState(TrainingPlaybackState state) {
    if (state == null) {
      return PlaybackTheme.NORMAL;
    }

    String transitionType = state.transitionType == null ? "" : state.transitionType.trim();
    if ("MOVE_STATION".equals(transitionType)) {
      return PlaybackTheme.MOVE_STATION;
    }
    if ("MOVE_ZONE".equals(transitionType)) {
      return PlaybackTheme.MOVE_ZONE;
    }
    if ("HYDRATE".equals(transitionType)) {
      return PlaybackTheme.HYDRATE;
    }
    if ("REST".equals(transitionType)) {
      return PlaybackTheme.READY;
    }

    String stageProgress = state.stageProgress == null ? "" : state.stageProgress.trim().toUpperCase(Locale.US);
    if ("REST".equals(stageProgress)) {
      return PlaybackTheme.READY;
    }
    if ("MOVE STATION".equals(stageProgress) || "MOVE ZONE".equals(stageProgress)) {
      return PlaybackTheme.MOVE_STATION;
    }
    if ("HYDRATE".equals(stageProgress)) {
      return PlaybackTheme.HYDRATE;
    }
    return PlaybackTheme.NORMAL;
  }

  protected int getTransitionBackgroundColor(String transitionType) {
    if ("REST".equals(transitionType)) {
      return getColor(R.color.tv_playback_ready);
    }
    if ("HYDRATE".equals(transitionType)) {
      return getColor(R.color.tv_playback_blue);
    }
    if ("MOVE_STATION".equals(transitionType) || "MOVE_ZONE".equals(transitionType)) {
      return getColor(R.color.tv_playback_move_station);
    }
    return getColor(R.color.tv_playback_background);
  }

  protected int resolvePlaybackStateColor(String primaryText, String secondaryText) {
    String normalized =
        ((primaryText == null ? "" : primaryText) + " " + (secondaryText == null ? "" : secondaryText))
            .trim()
            .toUpperCase(Locale.US);
    if (normalized.contains("REST") || normalized.contains("READY")) {
      return getColor(R.color.tv_playback_ready);
    }
    if (normalized.contains("MOVE")) {
      return getColor(R.color.tv_playback_move_station);
    }
    if (normalized.contains("HYDRATE")) {
      return getColor(R.color.tv_playback_blue);
    }
    return getColor(R.color.tv_playback_blue);
  }

  protected String formatTransitionTitle(String transitionTitle) {
    if (transitionTitle == null || transitionTitle.trim().isEmpty()) {
      return "READY";
    }
    return stripLeadingGet(transitionTitle).replace(" ", "\n");
  }

  protected String stripLeadingGet(String value) {
    if (value == null) {
      return "";
    }
    return value.trim().replaceFirst("(?i)^GET\\s+", "");
  }

  protected void renderStageMeta(String secondaryText, int completedDots, int totalDots) {
    if (playbackStageSecondary != null) {
      if (secondaryText == null || secondaryText.trim().isEmpty()) {
        playbackStageSecondary.setVisibility(View.GONE);
      } else {
        playbackStageSecondary.setVisibility(View.VISIBLE);
        playbackStageSecondary.setText(secondaryText);
      }
    }

    if (playbackStageDotsRow != null) {
      playbackStageDotsRow.removeAllViews();
      if (totalDots <= 0) {
        playbackStageDotsRow.setVisibility(View.GONE);
      } else {
        playbackStageDotsRow.setVisibility(View.VISIBLE);
        for (int index = 0; index < totalDots; index += 1) {
          View dot = new View(this);
          LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(16), dp(16));
          if (index > 0) {
            params.leftMargin = dp(12);
          }
          dot.setLayoutParams(params);
          dot.setBackgroundResource(
              index < Math.max(completedDots, 0)
                  ? R.drawable.bg_stage_dot_filled
                  : R.drawable.bg_stage_dot_hollow);
          playbackStageDotsRow.addView(dot);
        }
      }
    }
  }

  protected void updateTrainingPlayback(CourseScript course, int elapsedSeconds) {
    TrainingPlaybackState state = buildTrainingPlaybackState(course, elapsedSeconds);
    if (state == null) {
      showPlaybackMessage("0", "TRAINING", "当前课程没有正式训练脚本。");
      return;
    }
    maybePlayTrainingCue(state);

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      if (state.transitionType != null && !state.transitionType.trim().isEmpty()) {
        showHorizontalTransitionState(state);
      } else {
        showHorizontalTrainingState(course, state);
      }
      return;
    }

    if (state.fullScreenTransition) {
      showFullScreenTransitionState(state);
      return;
    }

    applyPlaybackTheme(getThemeForState(state));
    playbackCountdownText.setText(String.valueOf(Math.max(state.remainingSeconds, 0)));
    playbackStageLabel.setText(state.stageLabel);
    playbackStageProgress.setText(state.stageProgress);
    renderStageMeta(state.stageSecondaryText, state.completedDots, state.totalDots);
    playbackHint.setText("");
    playbackHint.setVisibility(View.GONE);

    if (state.messageOnly) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
      showPlaybackChrome(true, false);
      showPlaybackScroller();
      clearWaterfallRows();
      warmupRowsContainer.setVisibility(View.GONE);
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.GONE);
      lastTrainingSignature = "";
      return;
    }

    if (state.waterfallLayout) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_black));
      showPlaybackChrome(true, false);
      showPlaybackScroller();
      String waterfallSignature = buildTrainingWaterfallSignature(state.displayCards);
      if (!"TRAINING_WATERFALL".equals(lastPlaybackMode) || !waterfallSignature.equals(lastWaterfallSignature)) {
        lastPlaybackMode = "TRAINING_WATERFALL";
        lastWaterfallSignature = waterfallSignature;
        lastWaterfallIndex = -1;
        lastWaterfallWindowStart = -1;
        lastTrainingSignature = "";
        trainingCardsContainer.removeAllViews();
        trainingCardsContainer.setVisibility(View.GONE);
        warmupRowsContainer.setVisibility(View.VISIBLE);
        buildTrainingWaterfallRows(state.displayCards);
      }

      int maxWindowStart = Math.max(state.displayCards.size() - 3, 0);
      int windowStart = Math.min(Math.max(state.activeCardIndex - 1, 0), maxWindowStart);
      if (state.activeCardIndex != lastWaterfallIndex || windowStart != lastWaterfallWindowStart) {
        lastWaterfallIndex = state.activeCardIndex;
        lastWaterfallWindowStart = windowStart;
        updateWaterfallRows(state.activeCardIndex, windowStart);
        scrollWaterfallToWindowStart(windowStart);
      } else {
        ensureWaterfallRowsPlaying(windowStart);
        updateWaterfallActiveState(state.activeCardIndex);
      }
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    showPlaybackChrome(true, false);
    showPlaybackScroller();
    if (!"TRAINING".equals(lastPlaybackMode)) {
      lastPlaybackMode = "TRAINING";
      clearWaterfallRows();
      warmupRowsContainer.setVisibility(View.GONE);
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.VISIBLE);
      lastTrainingSignature = "";
    }

    String layoutSignature = buildTrainingLayoutSignature(state.displayCards);
    if (!layoutSignature.equals(lastTrainingSignature)) {
      renderTrainingCards(state);
      lastTrainingSignature = layoutSignature;
    }
    ensureTrainingCardVideosPlaying();
  }

  protected TrainingPlaybackState buildTrainingPlaybackState(CourseScript course, int elapsedSeconds) {
    if (course.pods == null || course.pods.isEmpty()) {
      return null;
    }

    int cursor = 0;
    int displayScreenIndex = getDisplayScreenIndex();
    for (int podIndex = 0; podIndex < course.pods.size(); podIndex += 1) {
      CourseScript.Pod pod = course.pods.get(podIndex);
      CourseScript.VideoGroup group = findVideoGroup(course, pod.videoGroupId);
      EffectivePodScreen effectiveScreen = materializePodScreen(pod, group, displayScreenIndex);
      int podDurationSeconds = getPodDurationSeconds(effectiveScreen);
      EffectivePodScreen nextEffectiveScreen = null;
      if (podIndex + 1 < course.pods.size()) {
        CourseScript.Pod nextPod = course.pods.get(podIndex + 1);
        nextEffectiveScreen =
            materializePodScreen(
                nextPod,
                findVideoGroup(course, nextPod.videoGroupId),
                displayScreenIndex);
      }

      if (elapsedSeconds < cursor + podDurationSeconds) {
        return buildPodRunningState(pod, effectiveScreen, elapsedSeconds - cursor);
      }
      cursor += podDurationSeconds;

      int endingDurationSeconds = getPodEndingDurationSeconds(course, pod);
      if (endingDurationSeconds > 0 && elapsedSeconds < cursor + endingDurationSeconds) {
        return buildPodEndingState(
            pod,
            effectiveScreen,
            nextEffectiveScreen,
            elapsedSeconds - cursor,
            endingDurationSeconds);
      }
      cursor += endingDurationSeconds;
    }

    return null;
  }

  protected TrainingPlaybackState buildPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen != null && !effectiveScreen.waterfallLayout) {
      return buildStationPodRunningState(pod, effectiveScreen, podElapsedSeconds);
    }
    return buildWaterfallPodRunningState(pod, effectiveScreen, podElapsedSeconds);
  }

  protected TrainingPlaybackState buildWaterfallPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return new TrainingPlaybackState(
          pod.name + "|empty",
          "TRAINING",
          "",
          "当前屏幕没有可播放的视频组内容。",
          0,
          new ArrayList<>(),
          -1,
          false,
          true,
          false,
          false,
          "");
    }

    List<CourseScript.VideoCard> actionSequence =
        buildActionSequence(effectiveScreen.videoCards, Math.max(effectiveScreen.rule.loopCount, 1));
    int workSeconds =
        effectiveScreen.rule.setConfigs != null && !effectiveScreen.rule.setConfigs.isEmpty()
            ? Math.max(effectiveScreen.rule.setConfigs.get(0).workSeconds, 0)
            : 0;
    int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
    int cursor = 0;
    int actionCountPerLoop = Math.max(effectiveScreen.videoCards.size(), 1);

    for (int actionIndex = 0; actionIndex < actionSequence.size(); actionIndex += 1) {
      CourseScript.VideoCard currentCard = actionSequence.get(actionIndex);
      int roundIndex = actionIndex / actionCountPerLoop + 1;
      if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
        int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
        return new TrainingPlaybackState(
            pod.name + "|wf-work|" + actionIndex,
            "REMAINING",
            "WORK",
            buildTrainingHint(
                pod.name,
                currentCard.actionName,
                currentCard.stationNumber,
                roundIndex,
                Math.max(effectiveScreen.rule.loopCount, 1),
                false,
                false),
            remainingSeconds,
            actionSequence,
            actionIndex,
            true,
            true,
            false,
            false,
            "");
      }
      cursor += workSeconds;

      boolean hasNextAction = actionIndex < actionSequence.size() - 1;
      if (hasNextAction && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        CourseScript.VideoCard nextCard = actionSequence.get(actionIndex + 1);
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        return new TrainingPlaybackState(
            pod.name + "|wf-move|" + actionIndex,
            "REMAINING",
            "REST",
            buildTrainingHint(
                pod.name,
                nextCard.actionName,
                nextCard.stationNumber,
                roundIndex,
                Math.max(effectiveScreen.rule.loopCount, 1),
                true,
                false),
            remainingSeconds,
            actionSequence,
            actionIndex + 1,
            false,
            true,
            false,
            false,
            "");
      }
      if (hasNextAction) {
        cursor += stationRestSeconds;
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|wf-idle",
        "TRAINING",
        "",
        "正式训练准备中",
        0,
        actionSequence,
        actionSequence.isEmpty() ? -1 : actionSequence.size() - 1,
        false,
        true,
        false,
        false,
        "");
  }
}
