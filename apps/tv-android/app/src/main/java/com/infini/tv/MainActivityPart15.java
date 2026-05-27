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

abstract class MainActivityPart15 extends MainActivityPart14 {
  protected String buildTrainingLayoutSignature(List<CourseScript.VideoCard> cards) {
    if (cards == null || cards.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(cards.size());
    for (int index = 0; index < cards.size(); index += 1) {
      CourseScript.VideoCard card = cards.get(index);
      builder
          .append("|")
          .append(safeStationLabel(card == null ? null : card.stationNumber, index + 1))
          .append(":")
          .append(card == null || card.mediaUrl == null ? "" : card.mediaUrl);
    }
    return builder.toString();
  }

  protected int calculateWideTrainingRowHeight() {
    int contentWidth = getResources().getDisplayMetrics().widthPixels - dp(36);
    int previewWidth = Math.max(contentWidth - dp(98), dp(260));
    return Math.max(Math.round(previewWidth * 9f / 16f), dp(146));
  }

  protected int calculateGridTrainingRowHeight() {
    int contentWidth = getResources().getDisplayMetrics().widthPixels - dp(36);
    int columnWidth = Math.max((contentWidth - dp(28)) / 2, dp(180));
    int previewWidth = Math.max(columnWidth - dp(104), dp(160));
    return Math.max(Math.round(previewWidth * 9f / 16f), dp(90));
  }

  protected int calculateTrainingRowHeight(int cardCount, int columns, int rowCount, int rowGap) {
    int viewportHeight = playbackScrollView == null ? 0 : playbackScrollView.getHeight();
    if (viewportHeight <= 0) {
      viewportHeight = Math.round(getResources().getDisplayMetrics().heightPixels * 0.70f);
    }

    int verticalChrome =
        dp(20)
            + Math.max(rowCount - 1, 0) * rowGap
            + (trainingCardsContainer == null ? 0 : dp(16));
    int availableHeight = Math.max(viewportHeight - verticalChrome, dp(80));
    int fitHeight = Math.max(availableHeight / Math.max(rowCount, 1), dp(80));
    int aspectHeight = columns == 1 ? calculateWideTrainingRowHeight() : calculateGridTrainingRowHeight();

    if (cardCount <= 10) {
      return Math.max(Math.min(aspectHeight, fitHeight), dp(72));
    }
    return Math.max(Math.min(aspectHeight, fitHeight), dp(72));
  }

  protected boolean isPortraitViewport() {
    android.util.DisplayMetrics metrics = getResources().getDisplayMetrics();
    return metrics.heightPixels > metrics.widthPixels;
  }

  protected int calculateTrainingRowGap(int rowCount) {
    if (rowCount >= 5) {
      return dp(6);
    }
    if (rowCount >= 3) {
      return dp(8);
    }
    return dp(12);
  }

  protected String safeStationLabel(String stationNumber, int fallbackIndex) {
    if (stationNumber == null || stationNumber.trim().isEmpty()) {
      return String.valueOf(fallbackIndex);
    }
    return stationNumber;
  }

  protected List<CourseScript.VideoCard> buildActionSequence(
      List<CourseScript.VideoCard> videoCards, int loopCount) {
    List<CourseScript.VideoCard> sequence = new ArrayList<>();
    if (videoCards == null || videoCards.isEmpty()) {
      return sequence;
    }

    int safeLoops = Math.max(loopCount, 1);
    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      sequence.addAll(videoCards);
    }
    return sequence;
  }

  protected List<CourseScript.PodSetConfig> getEffectiveSetConfigs(CourseScript.PodScreen rule) {
    List<CourseScript.PodSetConfig> setConfigs = new ArrayList<>();
    if (rule != null && rule.setConfigs != null && !rule.setConfigs.isEmpty()) {
      setConfigs.addAll(rule.setConfigs);
      return setConfigs;
    }

    setConfigs.add(new CourseScript.PodSetConfig(0, 0));
    return setConfigs;
  }

  protected int getTrainingTotalSeconds(CourseScript course) {
    if (course == null || course.pods == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.Pod pod : course.pods) {
      total += getPodDurationSeconds(pod, materializeProgressPodScreen(course, pod));
      total += getPodEndingDurationSeconds(course, pod);
    }
    return total;
  }

  protected int getPodDurationSeconds(CourseScript.Pod pod, EffectivePodScreen effectiveScreen) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return 0;
    }

    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int duration = 0;
    int loopCount = Math.max(effectiveScreen.rule.loopCount, 1);

    if (!effectiveScreen.waterfallLayout) {
      if (isSwitchPod(pod)) {
        int pairCount = effectiveScreen.videoCards.size() / 2;
        if (pairCount <= 0) {
          return 0;
        }
        int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
        for (int loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
          for (int pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
            for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
              CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
              duration += Math.max(setConfig.workSeconds, 0) * 2;
              duration += stationRestSeconds;
              if (setIndex < setConfigs.size() - 1) {
                duration += Math.max(setConfig.restSeconds, 0);
              }
            }
            boolean hasNextPairRound = pairIndex < pairCount - 1 || loopIndex < loopCount - 1;
            if (hasNextPairRound) {
              duration += stationRestSeconds;
            }
          }
        }
        return duration;
      }
      for (int loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
        for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
          duration += Math.max(setConfig.workSeconds, 0);
          if (setIndex < setConfigs.size() - 1) {
            duration += Math.max(setConfig.restSeconds, 0);
          }
        }
        if (loopIndex < loopCount - 1) {
          duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
        }
      }
      return duration;
    }

    int totalActions = effectiveScreen.videoCards.size() * loopCount;
    for (int actionIndex = 0; actionIndex < totalActions; actionIndex += 1) {
      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        duration += Math.max(setConfig.workSeconds, 0);
        if (setIndex < setConfigs.size() - 1) {
          duration += Math.max(setConfig.restSeconds, 0);
        }
      }
      if (actionIndex < totalActions - 1) {
        duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
      }
    }
    return duration;
  }

  protected int getPodEndingDurationSeconds(CourseScript course, CourseScript.Pod pod) {
    if (course == null || course.metadata == null || pod == null) {
      return 0;
    }

    if ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending)) {
      return Math.max(course.metadata.defaultHydrateSeconds, 0);
    }
    return 0;
  }

  protected CourseScript.VideoGroup findVideoGroup(CourseScript course, String videoGroupId) {
    if (course == null || course.videoGroups == null || videoGroupId == null) {
      return null;
    }

    for (CourseScript.VideoGroup group : course.videoGroups) {
      if (group != null && videoGroupId.equals(group.id)) {
        return group;
      }
    }
    return null;
  }

  protected CourseScript.VideoGroupScreen findVideoGroupScreen(
      CourseScript.VideoGroup group, int screenIndex) {
    if (group == null || group.screens == null) {
      return null;
    }

    for (CourseScript.VideoGroupScreen screen : group.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  protected CourseScript.PodScreen findPodScreen(CourseScript.Pod pod, int screenIndex) {
    if (pod == null || pod.screens == null) {
      return null;
    }

    for (CourseScript.PodScreen screen : pod.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  protected EffectivePodScreen materializePodScreen(
      CourseScript.Pod pod, CourseScript.VideoGroup group, int displayScreenIndex) {
    if (pod == null || group == null || group.screens == null || group.screens.isEmpty()) {
      return null;
    }

    if (group.screenCount <= 1) {
      CourseScript.PodScreen rule =
          pod.screens != null && !pod.screens.isEmpty() ? pod.screens.get(0) : null;
      CourseScript.VideoGroupScreen sourceScreen = group.screens.get(0);
      if (rule == null || sourceScreen == null) {
        return null;
      }
      return new EffectivePodScreen(displayScreenIndex, rule, sourceScreen, true);
    }

    CourseScript.PodScreen rule = findPodScreen(pod, displayScreenIndex);
    CourseScript.VideoGroupScreen sourceScreen = findVideoGroupScreen(group, displayScreenIndex);
    if (rule == null || sourceScreen == null) {
      return null;
    }
    return new EffectivePodScreen(displayScreenIndex, rule, sourceScreen, false);
  }

  protected boolean safeEquals(String left, String right) {
    if (left == null) {
      return right == null;
    }
    return left.equals(right);
  }

  protected void showPlaybackMessage(String countdown, String stageLabel, String hintText) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          activePlaybackItem == null ? null : activePlaybackItem.course,
          parseSafeInt(countdown),
          stageLabel == null || stageLabel.trim().isEmpty() ? "WAITING" : stageLabel,
          hintText,
          0,
          0);
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, true);
    hideFinishPanel();
    showPlaybackScroller();
    playbackCountdownText.setText(countdown);
    playbackStageLabel.setText(stageLabel);
    playbackStageProgress.setText("");
    renderStageMeta("", 0, 0);
    playbackHint.setText(hintText);
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    lastTrainingSignature = "";
  }

  protected void showFinishState() {
    scheduleFinishReturn();
    hideTransitionDesign();
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalFinishState();
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(false, false);
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    playbackScrollView.setVisibility(View.GONE);
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    if (finishPanel != null) {
      finishPanel.setVisibility(View.VISIBLE);
    }
    bindFinishContent(activePlaybackItem == null ? "" : activePlaybackItem.logoSource);
    lastTrainingSignature = "";
  }

  protected void returnToScheduleListAfterFinish() {
    int screenNumber = activeScreenNumber;
    stopPlayback();
    if (screenNumber < 1 || screenNumber > 5) {
      showSelector();
      return;
    }

    applyResponsiveLayout();
    if (isVerticalCourseScreen(screenNumber)) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_schedule_background));
      showScheduleChrome();
      showVerticalScheduleList();
      pageTitle.setText("今日课程表");
      pageSubtitle.setText(LocalDate.now().format(dateFormatter));
      bindScheduleItems(new ArrayList<>(syncedTodaySchedules));
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    contentPanel.setPadding(0, 0, 0, 0);
    showHorizontalChrome();
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.VISIBLE);
    }
    bindHorizontalSchedule(new ArrayList<>(syncedTodaySchedules));
  }

  protected void hideFinishPanel() {
    cancelFinishReturn();
    finishLogoRequestKey = "";
    if (finishPanel != null) {
      finishPanel.setVisibility(View.GONE);
    }
    if (finishLogoImage != null) {
      finishLogoImage.setImageDrawable(null);
      finishLogoImage.setVisibility(View.GONE);
    }
    if (finishFallbackText != null) {
      finishFallbackText.setVisibility(View.GONE);
    }
  }

  protected void bindFinishContent(String logoSource) {
    if (finishFallbackText == null || finishLogoImage == null) {
      return;
    }
    prepareFinishContentLayout();

    if (logoSource == null || logoSource.trim().isEmpty()) {
      showFinishFallback();
      return;
    }

    String requestKey = logoSource.trim();
    finishLogoRequestKey = requestKey;
    finishLogoImage.setImageDrawable(null);
    finishLogoImage.setVisibility(View.GONE);
    finishFallbackText.setVisibility(View.GONE);

    new Thread(
            () -> {
              Bitmap bitmap =
                  ImageLoader.loadBitmap(
                      requestKey,
                      resolveFinishLogoTargetWidth(),
                      resolveFinishLogoTargetHeight());
              runOnUiThread(
                  () -> {
                    if (!safeEquals(finishLogoRequestKey, requestKey)) {
                      return;
                    }

                    if (bitmap != null) {
                      finishLogoImage.setImageBitmap(bitmap);
                      finishLogoImage.setVisibility(View.VISIBLE);
                      setFinishTitleTopMargin(dp(18));
                      finishFallbackText.setVisibility(View.VISIBLE);
                    } else {
                      showFinishFallback();
                    }
                  });
            })
        .start();
  }

  protected void showFinishFallback() {
    prepareFinishContentLayout();
    if (finishLogoImage != null) {
      finishLogoImage.setImageDrawable(null);
      finishLogoImage.setVisibility(View.GONE);
    }
    if (finishFallbackText != null) {
      setFinishTitleTopMargin(0);
      finishFallbackText.setText("CONGRATULATION");
      finishFallbackText.setVisibility(View.VISIBLE);
    }
  }

  protected void setFinishTitleTopMargin(int topMargin) {
    if (finishFallbackText == null) {
      return;
    }

    ViewGroup.LayoutParams rawParams = finishFallbackText.getLayoutParams();
    if (!(rawParams instanceof ViewGroup.MarginLayoutParams)) {
      return;
    }

    ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) rawParams;
    if (params.topMargin == topMargin) {
      return;
    }
    params.topMargin = topMargin;
    finishFallbackText.setLayoutParams(params);
  }
}
