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
import com.infini.tv.component.horizontal.HorizontalProgressBarComponent;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import com.infini.tv.mqtt.TvMqttManager;
import com.infini.tv.repository.ServerConfig;
import com.infini.tv.repository.TvScriptRepository;
import com.infini.tv.service.ImageLoader;
import com.infini.tv.util.SwitchPodSequence;
import com.infini.tv.util.TrainingLayoutCalculator;
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

abstract class MainActivityTrainingTimelineController extends MainActivityTrainingStateController {
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
    int pairCount = SwitchPodSequence.getPairCount(baseCards.size());
    int totalSwitchDots = 0;
    int cursor = 0;
    int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      int pairIndex = SwitchPodSequence.getPairIndexForRound(loopIndex, pairCount);
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
              -1,
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

      boolean hasNextPairRound = loopIndex < safeLoops - 1;
      if (hasNextPairRound && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        int nextPairIndex = SwitchPodSequence.getPairIndexForRound(loopIndex + 1, pairCount);
        int nextCardAIndex = nextPairIndex * 2;
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        boolean fullScreenTransition = isInFirstTransitionThird(remainingSeconds, stationRestSeconds);
        return new TrainingPlaybackState(
            pod.name + "|switch-next-station|" + loopIndex + "|" + pairIndex,
            "REMAINING",
            "MOVE STATION",
            "",
            remainingSeconds,
            baseCards,
            nextCardAIndex,
            false,
            false,
            false,
            fullScreenTransition,
            "MOVE_STATION",
            "",
            totalSwitchDots,
            totalSwitchDots,
            rowLayouts);
      }
      if (hasNextPairRound) {
        cursor += stationRestSeconds;
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
          int completedGroups = setIndex + 1;
          int totalGroups = setConfigs.size();
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
}
