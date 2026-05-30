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

abstract class MainActivityPart14 extends MainActivityPart13 {
  protected boolean isSwitchPod(CourseScript.Pod pod) {
    return pod != null && "SWITCH".equals(pod.stationFlow);
  }

  protected TrainingPlaybackState buildSwitchPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.size() < 2) {
      return buildStationPodRunningState(pod, effectiveScreen, podElapsedSeconds);
    }

    List<CourseScript.VideoCard> baseCards = effectiveScreen.videoCards;
    List<Integer> rowLayouts = getRowLayoutsForScreen(effectiveScreen);
    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int pairCount = baseCards.size() / 2;
    int totalSwitchDots = Math.max(setConfigs.size(), 0) * 2;
    int cursor = 0;
    int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      int cardAIndex = pairIndex * 2;
      int cardBIndex = cardAIndex + 1;
      CourseScript.VideoCard cardA = baseCards.get(cardAIndex);
      CourseScript.VideoCard cardB = baseCards.get(cardBIndex);

      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        int workSeconds = Math.max(setConfig.workSeconds, 0);

        if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
          int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
          return new TrainingPlaybackState(
              pod.name + "|switch-work|" + loopIndex + "|" + pairIndex + "|A|" + setIndex,
              "REMAINING",
              "WORK",
              buildSwitchTrainingHint("A", cardA, loopIndex + 1, safeLoops, pairIndex + 1, pairCount, setIndex + 1, setConfigs.size()),
              remainingSeconds,
              baseCards,
              cardAIndex,
              true,
              false,
              false,
              false,
              "",
              "SET " + (setIndex + 1) + "/" + setConfigs.size(),
              setIndex * 2 + 1,
              totalSwitchDots,
              rowLayouts);
        }
        cursor += workSeconds;

        if (stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
          int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
          boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, stationRestSeconds);
          return new TrainingPlaybackState(
              pod.name + "|switch-a-to-b|" + loopIndex + "|" + pairIndex + "|" + setIndex,
              "REMAINING",
              "SWITCH",
              "",
              remainingSeconds,
              baseCards,
              cardBIndex,
              false,
              false,
              false,
              fullScreenTransition,
              "SWITCH",
              "",
              setIndex * 2 + 1,
              totalSwitchDots,
              rowLayouts);
        }
        cursor += stationRestSeconds;

        if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
          int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
          return new TrainingPlaybackState(
              pod.name + "|switch-work|" + loopIndex + "|" + pairIndex + "|B|" + setIndex,
              "REMAINING",
              "WORK",
              buildSwitchTrainingHint("B", cardB, loopIndex + 1, safeLoops, pairIndex + 1, pairCount, setIndex + 1, setConfigs.size()),
              remainingSeconds,
              baseCards,
              cardBIndex,
              true,
              false,
              false,
              false,
              "",
              "SET " + (setIndex + 1) + "/" + setConfigs.size(),
              setIndex * 2 + 2,
              totalSwitchDots,
              rowLayouts);
        }
        cursor += workSeconds;

        boolean hasNextSet = setIndex < setConfigs.size() - 1;
        int setRestSeconds = Math.max(setConfig.restSeconds, 0);
        if (hasNextSet && setRestSeconds > 0 && podElapsedSeconds < cursor + setRestSeconds) {
          int remainingSeconds = Math.max(cursor + setRestSeconds - podElapsedSeconds, 0);
          boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, setRestSeconds);
          return new TrainingPlaybackState(
              pod.name + "|switch-set-rest|" + loopIndex + "|" + pairIndex + "|" + setIndex,
              "REMAINING",
              "SWITCH",
              "",
              remainingSeconds,
              baseCards,
              cardAIndex,
              false,
              false,
              false,
              fullScreenTransition,
              "SWITCH",
              "",
              Math.min(setIndex * 2 + 2, totalSwitchDots),
              totalSwitchDots,
              rowLayouts);
        }
        if (hasNextSet) {
          cursor += setRestSeconds;
        }
      }

      boolean hasNextPairRound = pairIndex < pairCount - 1 || loopIndex < safeLoops - 1;
      if (hasNextPairRound && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        int nextPairIndex = pairIndex < pairCount - 1 ? pairIndex + 1 : 0;
        int nextCardAIndex = nextPairIndex * 2;
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, stationRestSeconds);
        return new TrainingPlaybackState(
            pod.name + "|switch-next-station|" + loopIndex + "|" + pairIndex,
            "REMAINING",
            "SWITCH",
            "",
            remainingSeconds,
            baseCards,
            nextCardAIndex,
            false,
            false,
            false,
            fullScreenTransition,
            "SWITCH",
            "",
            totalSwitchDots,
            totalSwitchDots,
            rowLayouts);
      }
      if (hasNextPairRound) {
        cursor += stationRestSeconds;
      }
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|switch-idle",
        "TRAINING",
        "",
        "",
        0,
        baseCards,
        -1,
        false);
  }

  protected TrainingPlaybackState buildStationPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return new TrainingPlaybackState(
          pod.name + "|empty",
          "TRAINING",
          "",
          "",
          0,
          new ArrayList<>(),
          -1,
          false);
    }

    List<CourseScript.VideoCard> baseCards = effectiveScreen.videoCards;
    List<Integer> rowLayouts = getRowLayoutsForScreen(effectiveScreen);
    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int cursor = 0;

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        int workSeconds = Math.max(setConfig.workSeconds, 0);
        if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
          int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
          return new TrainingPlaybackState(
              pod.name + "|station-work|" + loopIndex + "|" + setIndex,
              "REMAINING",
              "WORK",
              buildStationTrainingHint(pod.name, loopIndex + 1, safeLoops, setIndex + 1, setConfigs.size(), false, false),
              remainingSeconds,
              baseCards,
              -1,
              true,
              false,
              false,
              false,
              "",
              "SET " + (setIndex + 1),
              0,
              0,
              rowLayouts);
        }
        cursor += workSeconds;

        boolean hasNextSet = setIndex < setConfigs.size() - 1;
        int setRestSeconds = Math.max(setConfig.restSeconds, 0);
        if (hasNextSet && setRestSeconds > 0 && podElapsedSeconds < cursor + setRestSeconds) {
          int remainingSeconds = Math.max(cursor + setRestSeconds - podElapsedSeconds, 0);
          int completedGroups = loopIndex * setConfigs.size() + setIndex + 1;
          int totalGroups = safeLoops * setConfigs.size();
          boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, setRestSeconds);
          return new TrainingPlaybackState(
              pod.name + "|station-set-rest|" + loopIndex + "|" + setIndex,
              "REMAINING",
              "REST",
              "",
              remainingSeconds,
              baseCards,
              -1,
              false,
              false,
              false,
              fullScreenTransition,
              "REST",
              "",
              completedGroups,
              totalGroups,
              rowLayouts);
        }
        if (hasNextSet) {
          cursor += setRestSeconds;
        }
      }

      boolean hasNextLoop = loopIndex < safeLoops - 1;
      int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
      if (hasNextLoop && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, stationRestSeconds);
        return new TrainingPlaybackState(
            pod.name + "|station-move|" + loopIndex,
            "REMAINING",
            "MOVE STATION",
            "",
            remainingSeconds,
            baseCards,
            -1,
            false,
            false,
            false,
            fullScreenTransition,
            "MOVE_STATION",
            rowLayouts);
      }
      if (hasNextLoop) {
        cursor += stationRestSeconds;
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|station-idle",
        "TRAINING",
        "",
        "",
        0,
        baseCards,
        -1,
        false);
  }

  protected TrainingPlaybackState buildPodEndingState(
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      EffectivePodScreen nextEffectiveScreen,
      int endingElapsedSeconds,
      int endingDurationSeconds) {
    EffectivePodScreen previewScreen = nextEffectiveScreen != null ? nextEffectiveScreen : effectiveScreen;
    List<CourseScript.VideoCard> cards =
        previewScreen == null || previewScreen.videoCards == null
            ? new ArrayList<>()
            : previewScreen.videoCards;
    int remainingSeconds = Math.max(endingDurationSeconds - endingElapsedSeconds, 0);
    boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, endingDurationSeconds);
    boolean previewWaterfall = previewScreen != null && previewScreen.waterfallLayout;
    List<Integer> rowLayouts = getRowLayoutsForScreen(previewScreen);

    if ("MOVE_ZONE".equals(pod.ending)) {
      return new TrainingPlaybackState(
          pod.name + "|move-zone",
          "REMAINING",
          "MOVE ZONE",
          "",
          remainingSeconds,
          cards,
          previewWaterfall ? 0 : -1,
          false,
          previewWaterfall,
          false,
          fullScreenTransition,
          "MOVE_ZONE",
          rowLayouts);
    }

    return new TrainingPlaybackState(
        pod.name + "|hydrate",
        "REMAINING",
        "HYDRATE",
        "",
        remainingSeconds,
        cards,
        previewWaterfall ? 0 : -1,
        false,
        previewWaterfall,
        false,
        fullScreenTransition,
        "HYDRATE",
        rowLayouts);
  }

  protected boolean isInFirstTransitionThird(int remainingSeconds, int totalSeconds) {
    if (totalSeconds <= 0 || remainingSeconds <= 0) {
      return false;
    }
    return remainingSeconds > Math.max(Math.round(totalSeconds * 2f / 3f), 1);
  }

  protected String buildTrainingHint(
      String podName,
      String actionName,
      String stationNumber,
      int roundIndex,
      int totalRounds,
      boolean restPhase,
      boolean moveStation) {
    String safeAction = actionName == null || actionName.trim().isEmpty() ? "ACTION" : actionName;
    String safeStation = stationNumber == null || stationNumber.trim().isEmpty() ? "" : " · STATION " + stationNumber;
    String prefix = "TRAINING";

    if (moveStation) {
      return prefix + safeStation + " · MOVE STATION · " + safeAction;
    }
    if (restPhase) {
      return prefix + safeStation + " · REST · " + safeAction + " · ROUND " + roundIndex + "/" + totalRounds;
    }
    return prefix + safeStation + " · " + safeAction + " · ROUND " + roundIndex + "/" + totalRounds;
  }

  protected String buildStationTrainingHint(
      String podName,
      int roundIndex,
      int totalRounds,
      int setIndex,
      int totalSets,
      boolean restPhase,
      boolean moveStation) {
    String prefix = "TRAINING";
    if (moveStation) {
      return prefix + " · MOVE STATION";
    }
    if (restPhase) {
      return prefix + " · REST · SET " + setIndex + "/" + totalSets;
    }
    return prefix + " · ROUND " + roundIndex + "/" + totalRounds + " · SET " + setIndex + "/" + totalSets;
  }

  protected String buildRestTransitionHint(int completedGroups, int totalGroups) {
    int remainingGroups = Math.max(totalGroups - Math.max(completedGroups, 0), 0);
    if (remainingGroups <= 1) {
      return "LAST SET";
    }
    return remainingGroups + " SETS LEFT";
  }

  protected String buildSwitchTrainingHint(
      String sideLabel,
      CourseScript.VideoCard activeCard,
      int roundIndex,
      int totalRounds,
      int pairIndex,
      int totalPairs,
      int setIndex,
      int totalSets) {
    String safeAction = activeCard == null || activeCard.actionName == null || activeCard.actionName.trim().isEmpty()
        ? "ACTION"
        : activeCard.actionName;
    return "TRAINING · " + sideLabel + " STATION · " + safeAction + " · SET " + setIndex + "/" + totalSets;
  }

  protected void renderTrainingCards(TrainingPlaybackState state) {
    trainingCardsContainer.removeAllViews();
    if (state.displayCards == null || state.displayCards.isEmpty()) {
      TextView emptyText = new TextView(this);
      emptyText.setText("");
      emptyText.setTextColor(getColor(R.color.tv_text_subtle));
      emptyText.setTextSize(16f);
      emptyText.setGravity(android.view.Gravity.CENTER);
      emptyText.setPadding(0, dp(30), 0, dp(10));
      trainingCardsContainer.addView(emptyText);
      return;
    }

    int cardCount = state.displayCards.size();
    List<Integer> rowLayouts = normalizeTrainingRowLayouts(state.rowLayouts, state.displayCards);
    int rowCount = Math.max(rowLayouts.size(), 1);
    boolean hasWideRow = rowLayouts.contains(1);
    int visibleRowCount = hasWideRow ? Math.min(rowCount, 3) : Math.min(rowCount, 5);
    int rowGap = calculateTrainingRowGap(visibleRowCount);
    int viewportHeight = playbackScrollView == null ? 0 : playbackScrollView.getHeight();
    if (viewportHeight <= 0) {
      viewportHeight = Math.round(getResources().getDisplayMetrics().heightPixels * 0.70f);
    }
    List<Integer> rowHeights = calculateTrainingRowHeights(rowLayouts);
    int totalRowsHeight = 0;
    for (int height : rowHeights) {
      totalRowsHeight += height;
    }
    totalRowsHeight += Math.max(rowCount - 1, 0) * rowGap;
    int verticalSpace = Math.max(viewportHeight - dp(24), 0);
    trainingCardsContainer.setGravity(android.view.Gravity.CENTER_VERTICAL);
    trainingCardsContainer.setMinimumHeight(Math.max(totalRowsHeight, verticalSpace));

    int rowStart = 0;
    for (int rowIndex = 0; rowIndex < rowLayouts.size(); rowIndex += 1) {
      int columns = rowLayouts.get(rowIndex) == 2 ? 2 : 1;
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      row.setGravity(android.view.Gravity.CENTER);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      if (rowIndex > 0) {
        rowParams.topMargin = rowGap;
      }
      row.setLayoutParams(rowParams);

      for (int column = 0; column < columns; column += 1) {
        int cardIndex = rowStart + column;
        if (cardIndex >= cardCount) {
          continue;
        }

        int rowHeight = rowIndex < rowHeights.size() ? rowHeights.get(rowIndex) : calculateGridTrainingRowHeight();
        View card =
            columns == 1
                ? createTrainingWideCard(state.displayCards.get(cardIndex), cardIndex, rowHeight)
                : createTrainingGridCard(state.displayCards.get(cardIndex), cardIndex, rowHeight);
        row.addView(card);
      }
      trainingCardsContainer.addView(row);
      rowStart += columns;
    }
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  protected List<Integer> calculateTrainingRowHeights(List<Integer> rowLayouts) {
    List<Integer> heights = new ArrayList<>();
    if (rowLayouts == null || rowLayouts.isEmpty()) {
      return heights;
    }

    for (int index = 0; index < rowLayouts.size(); index += 1) {
      heights.add(rowLayouts.get(index) == 1 ? calculateWideTrainingRowHeight() : calculateGridTrainingRowHeight());
    }
    return heights;
  }

  protected int getTrainingCardsContentWidth() {
    int measuredWidth = 0;
    if (trainingCardsContainer != null && trainingCardsContainer.getWidth() > 0) {
      measuredWidth =
          trainingCardsContainer.getWidth()
              - trainingCardsContainer.getPaddingLeft()
              - trainingCardsContainer.getPaddingRight();
    } else if (playbackScrollView != null && playbackScrollView.getWidth() > 0) {
      measuredWidth =
          playbackScrollView.getWidth()
              - playbackScrollView.getPaddingLeft()
              - playbackScrollView.getPaddingRight();
    }
    if (measuredWidth <= 0) {
      measuredWidth = getResources().getDisplayMetrics().widthPixels;
    }
    int safeInset = isPortraitViewport() ? dp(160) : dp(96);
    return Math.max(measuredWidth - safeInset, dp(280));
  }

  protected View createTrainingWideCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    FrameLayout wrapper = new FrameLayout(this);
    int contentWidth = getTrainingCardsContentWidth();
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(contentWidth, previewHeight);
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    FrameLayout preview = new FrameLayout(this);
    FrameLayout.LayoutParams previewParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);
    wrapper.addView(
        createTrainingStationBadge(
            safeStationLabel(card == null ? null : card.stationNumber, cardIndex + 1), true));

    return wrapper;
  }

  protected View createTrainingGridCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    FrameLayout wrapper = new FrameLayout(this);
    int contentWidth = getTrainingCardsContentWidth();
    int columnWidth = Math.max((contentWidth - dp(14)) / 2, dp(180));
    int itemWidth = Math.min(columnWidth, Math.max(Math.round(previewHeight * 16f / 9f), dp(160)));
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(itemWidth, previewHeight);
    if (cardIndex % 2 == 0) {
      params.rightMargin = dp(7);
    } else {
      params.leftMargin = dp(7);
    }
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    FrameLayout preview = new FrameLayout(this);
    FrameLayout.LayoutParams previewParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);
    wrapper.addView(
        createTrainingStationBadge(
            safeStationLabel(card == null ? null : card.stationNumber, cardIndex + 1), false));

    return wrapper;
  }

  protected TextView createTrainingStationBadge(String label, boolean isWide) {
    TextView badge = new TextView(this);
    FrameLayout.LayoutParams params =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    params.gravity = android.view.Gravity.TOP | android.view.Gravity.START;
    params.leftMargin = dp(isWide ? 16 : 16);
    params.topMargin = dp(isWide ? 14 : 12);
    badge.setLayoutParams(params);
    badge.setText(label);
    badge.setTextColor(getColor(R.color.tv_accent_gold_bright));
    badge.setTextSize(isWide ? 34f : 30f);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    badge.setGravity(android.view.Gravity.CENTER);
    badge.setSingleLine(true);
    badge.setEllipsize(TextUtils.TruncateAt.END);
    int contentWidth = getTrainingCardsContentWidth();
    int maxBadgeWidth =
        isWide
            ? Math.max(contentWidth - dp(32), dp(180))
            : Math.max((contentWidth - dp(14)) / 2 - dp(28), dp(132));
    badge.setMaxWidth(maxBadgeWidth);
    badge.setPadding(dp(isWide ? 14 : 10), dp(5), dp(isWide ? 14 : 10), dp(6));
    android.graphics.drawable.GradientDrawable background =
        new android.graphics.drawable.GradientDrawable();
    background.setColor(Color.argb(218, 0, 0, 0));
    background.setCornerRadius(dp(8));
    background.setStroke(dp(1), getColor(R.color.tv_accent_gold_bright));
    badge.setBackground(background);
    return badge;
  }

  protected void bindTrainingPreview(FrameLayout preview, CourseScript.VideoCard card) {
    boolean hasMedia = card != null && card.mediaUrl != null && !card.mediaUrl.trim().isEmpty();
    if (hasMedia) {
      VideoView videoView = new VideoView(this);
      videoView.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      preview.addView(videoView);
      videoView.setOnPreparedListener(
          mediaPlayer -> {
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(0f, 0f);
            videoView.start();
          });
      videoView.setOnErrorListener((mediaPlayer, what, extra) -> true);
      videoView.setVideoPath(card.mediaUrl);
      videoView.start();
      preview.post(() -> startVideoViewIfNeeded(videoView));
    } else {
      View dim = new View(this);
      dim.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      dim.setBackgroundColor(getColor(R.color.tv_playback_caption));
      preview.addView(dim);

      TextView placeholder = new TextView(this);
      placeholder.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      placeholder.setGravity(android.view.Gravity.CENTER);
      placeholder.setPadding(dp(16), dp(16), dp(16), dp(16));
      placeholder.setText(safeStationLabel(card == null ? null : card.stationNumber, 1));
      placeholder.setTextColor(getColor(R.color.tv_accent_gold_bright));
      placeholder.setTextSize(46f);
      placeholder.setTypeface(placeholder.getTypeface(), android.graphics.Typeface.BOLD);
      preview.addView(placeholder);
    }
  }

  protected void ensureTrainingCardVideosPlaying() {
    startChildVideoViews(trainingCardsContainer);
  }

  protected void startChildVideoViews(View view) {
    if (view == null || view.getVisibility() != View.VISIBLE) {
      return;
    }
    if (view instanceof VideoView) {
      startVideoViewIfNeeded((VideoView) view);
      return;
    }
    if (!(view instanceof ViewGroup)) {
      return;
    }
    ViewGroup group = (ViewGroup) view;
    for (int index = 0; index < group.getChildCount(); index += 1) {
      startChildVideoViews(group.getChildAt(index));
    }
  }

  protected void startVideoViewIfNeeded(VideoView videoView) {
    if (videoView == null || videoView.getVisibility() != View.VISIBLE || videoView.isPlaying()) {
      return;
    }
    try {
      videoView.start();
    } catch (Exception ignored) {
      // Ignore transient player state while Android prepares/recreates the video surface.
    }
  }
}
