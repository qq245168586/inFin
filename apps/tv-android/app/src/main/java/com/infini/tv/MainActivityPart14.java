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
  protected TrainingPlaybackState buildStationPodRunningState(
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
          false);
    }

    List<CourseScript.VideoCard> baseCards = effectiveScreen.videoCards;
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
              0);
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
              buildRestTransitionHint(completedGroups, totalGroups),
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
              totalGroups);
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
            fullScreenTransition ? "" : "准备前往下一个站点。",
            remainingSeconds,
            baseCards,
            -1,
            false,
            false,
            false,
            fullScreenTransition,
            "MOVE_STATION");
      }
      if (hasNextLoop) {
        cursor += stationRestSeconds;
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|station-idle",
        "TRAINING",
        "",
        "正式训练准备中",
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

    if ("MOVE_ZONE".equals(pod.ending)) {
      return new TrainingPlaybackState(
          pod.name + "|move-zone",
          "REMAINING",
          "MOVE ZONE",
          fullScreenTransition ? "" : "准备前往下一个区域。",
          remainingSeconds,
          cards,
          previewWaterfall ? 0 : -1,
          false,
          previewWaterfall,
          false,
          fullScreenTransition,
          "MOVE_ZONE");
    }

    return new TrainingPlaybackState(
        pod.name + "|hydrate",
        "REMAINING",
        "HYDRATE",
        fullScreenTransition ? "" : "补水后继续下一段训练。",
        remainingSeconds,
        cards,
        previewWaterfall ? 0 : -1,
        false,
        previewWaterfall,
        false,
        fullScreenTransition,
        "HYDRATE");
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
    String safeAction = actionName == null || actionName.trim().isEmpty() ? "未命名动作" : actionName;
    String safeStation = stationNumber == null || stationNumber.trim().isEmpty() ? "" : " · 站点 " + stationNumber;
    String prefix = "正式训练";

    if (moveStation) {
      return prefix + safeStation + " · MOVE STATION · " + safeAction;
    }
    if (restPhase) {
      return prefix + safeStation + " · REST · " + safeAction + " · 第 " + roundIndex + "/" + totalRounds + " 轮";
    }
    return prefix + safeStation + " · " + safeAction + " · 第 " + roundIndex + "/" + totalRounds + " 轮";
  }

  protected String buildStationTrainingHint(
      String podName,
      int roundIndex,
      int totalRounds,
      int setIndex,
      int totalSets,
      boolean restPhase,
      boolean moveStation) {
    String prefix = "正式训练";
    if (moveStation) {
      return prefix + " · MOVE STATION · 第 " + roundIndex + "/" + totalRounds + " 轮后换站";
    }
    if (restPhase) {
      return prefix + " · 组间休息 · 第 " + setIndex + "/" + totalSets + " 组";
    }
    return prefix + " · 第 " + roundIndex + "/" + totalRounds + " 轮 · 第 " + setIndex + "/" + totalSets + " 组";
  }

  protected String buildRestTransitionHint(int completedGroups, int totalGroups) {
    int remainingGroups = Math.max(totalGroups - Math.max(completedGroups, 0), 0);
    if (remainingGroups <= 1) {
      return "最后 1 组，加油";
    }
    return "还剩 " + remainingGroups + " 组";
  }

  protected void renderTrainingCards(TrainingPlaybackState state) {
    trainingCardsContainer.removeAllViews();
    if (state.displayCards == null || state.displayCards.isEmpty()) {
      TextView emptyText = new TextView(this);
      emptyText.setText("当前屏幕没有可展示的视频组。");
      emptyText.setTextColor(getColor(R.color.tv_text_subtle));
      emptyText.setTextSize(16f);
      emptyText.setGravity(android.view.Gravity.CENTER);
      emptyText.setPadding(0, dp(30), 0, dp(10));
      trainingCardsContainer.addView(emptyText);
      return;
    }

    int cardCount = state.displayCards.size();
    int columns = cardCount <= 3 ? 1 : 2;
    int rowCount = Math.max((int) Math.ceil(cardCount / (float) columns), 1);
    int rowGap = calculateTrainingRowGap(rowCount);
    int previewHeight = calculateTrainingRowHeight(cardCount, columns, rowCount, rowGap);

    for (int rowStart = 0; rowStart < cardCount; rowStart += columns) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      if (rowStart > 0) {
        rowParams.topMargin = rowGap;
      }
      row.setLayoutParams(rowParams);

      for (int column = 0; column < columns; column += 1) {
        int cardIndex = rowStart + column;
        if (cardIndex >= cardCount) {
          View spacer = new View(this);
          spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 0, 1f));
          row.addView(spacer);
          continue;
        }

        View card =
            columns == 1
                ? createTrainingWideCard(state.displayCards.get(cardIndex), cardIndex, previewHeight)
                : createTrainingGridCard(state.displayCards.get(cardIndex), cardIndex, previewHeight);
        row.addView(card);
      }
      trainingCardsContainer.addView(row);
    }
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  protected View createTrainingWideCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    LinearLayout wrapper = new LinearLayout(this);
    wrapper.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, previewHeight);
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    TextView index = new TextView(this);
    LinearLayout.LayoutParams indexParams =
        new LinearLayout.LayoutParams(dp(88), LinearLayout.LayoutParams.MATCH_PARENT);
    index.setLayoutParams(indexParams);
    index.setBackgroundResource(R.drawable.bg_playback_index_card);
    index.setGravity(android.view.Gravity.CENTER);
    index.setText(safeStationLabel(card.stationNumber, cardIndex + 1));
    index.setTextColor(getColor(R.color.tv_text_main));
    index.setTextSize(34f);
    index.setTypeface(index.getTypeface(), android.graphics.Typeface.BOLD);
    wrapper.addView(index);

    FrameLayout preview = new FrameLayout(this);
    LinearLayout.LayoutParams previewParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
    previewParams.leftMargin = dp(10);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);

    return wrapper;
  }

  protected View createTrainingGridCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    LinearLayout wrapper = new LinearLayout(this);
    wrapper.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, previewHeight, 1f);
    if (cardIndex % 2 == 0) {
      params.rightMargin = dp(7);
    } else {
      params.leftMargin = dp(7);
    }
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    TextView index = new TextView(this);
    LinearLayout.LayoutParams indexParams =
        new LinearLayout.LayoutParams(dp(68), LinearLayout.LayoutParams.MATCH_PARENT);
    index.setLayoutParams(indexParams);
    index.setBackgroundResource(R.drawable.bg_playback_index_card);
    index.setGravity(android.view.Gravity.CENTER);
    index.setText(safeStationLabel(card.stationNumber, cardIndex + 1));
    index.setTextColor(getColor(R.color.tv_text_main));
    index.setTextSize(30f);
    index.setTypeface(index.getTypeface(), android.graphics.Typeface.BOLD);
    wrapper.addView(index);

    FrameLayout preview = new FrameLayout(this);
    LinearLayout.LayoutParams previewParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
    previewParams.leftMargin = dp(8);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);

    return wrapper;
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
      placeholder.setTextSize(34f);
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
