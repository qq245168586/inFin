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

abstract class MainActivityContract04 extends MainActivityContract03 {
  protected abstract String resolveHorizontalTransitionHint(TrainingPlaybackState state);

  protected abstract String formatHorizontalStateTitle(String title);

  protected abstract int resolveHorizontalTransitionIcon(String transitionType);

  protected abstract int getHorizontalTransitionBackgroundColor(String transitionType);

  protected abstract int parseSafeInt(String value);

  protected abstract void showWarmupReadyState(CourseScript course, int remainingSeconds);

  protected abstract void showWorkoutReadyState(CourseScript course, int remainingSeconds);

  protected abstract void showCooldownReadyState(CourseScript course, int remainingSeconds);

  protected abstract void showFullScreenTransitionState(TrainingPlaybackState state);

  protected abstract int getWarmupReadySeconds(CourseScript course);

  protected abstract int getTrainingReadySeconds(CourseScript course);

  protected abstract int getCooldownReadySeconds(CourseScript course);

  protected abstract void applyResponsiveLayout();

  protected abstract void updateScheduleLayoutBounds(int screenWidth, int screenHeight, int shortSide);

  protected abstract int clamp(int value, int min, int max);

  protected abstract float clampPx(float value, float min, float max);

  protected abstract float sp(int value);

  protected abstract void applyPlaybackTheme(PlaybackTheme theme);

  protected abstract PlaybackTheme getThemeForState(TrainingPlaybackState state);

  protected abstract int getTransitionBackgroundColor(String transitionType);

  protected abstract int resolvePlaybackStateColor(String primaryText, String secondaryText);

  protected abstract String formatTransitionTitle(String transitionTitle);

  protected abstract String stripLeadingGet(String value);

  protected abstract void renderStageMeta(String secondaryText, int completedDots, int totalDots);

  protected abstract void updateTrainingPlayback(CourseScript course, int elapsedSeconds);

  protected abstract TrainingPlaybackState buildTrainingPlaybackState(CourseScript course, int elapsedSeconds);

  protected abstract TrainingPlaybackState buildPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds);

  protected abstract TrainingPlaybackState buildWaterfallPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds);

  protected abstract TrainingPlaybackState buildStationPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds);

  protected abstract TrainingPlaybackState buildSwitchPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds);

  protected abstract boolean isSwitchPod(CourseScript.Pod pod);

  protected abstract TrainingPlaybackState buildPodEndingState(
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      EffectivePodScreen nextEffectiveScreen,
      int endingElapsedSeconds,
      int endingDurationSeconds);

  protected abstract boolean isInFirstTransitionThird(int remainingSeconds, int totalSeconds);

  protected abstract String buildTrainingHint(
      String podName,
      String actionName,
      String stationNumber,
      int roundIndex,
      int totalRounds,
      boolean restPhase,
      boolean moveStation);

  protected abstract String buildStationTrainingHint(
      String podName,
      int roundIndex,
      int totalRounds,
      int setIndex,
      int totalSets,
      boolean restPhase,
      boolean moveStation);

  protected abstract String buildRestTransitionHint(int completedGroups, int totalGroups);

  protected abstract void renderTrainingCards(TrainingPlaybackState state);

  protected abstract View createTrainingWideCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight);

  protected abstract View createTrainingGridCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight);

  protected abstract void bindTrainingPreview(FrameLayout preview, CourseScript.VideoCard card);

  protected abstract void ensureTrainingCardVideosPlaying();

  protected abstract void startChildVideoViews(View view);

  protected abstract void startVideoViewIfNeeded(VideoView videoView);

  protected abstract String buildTrainingLayoutSignature(List<CourseScript.VideoCard> cards);

  protected abstract String buildTrainingLayoutSignature(
      List<CourseScript.VideoCard> cards, List<Integer> rowLayouts);

  protected abstract int calculateWideTrainingRowHeight();

  protected abstract int calculateGridTrainingRowHeight();

  protected abstract int calculateTrainingRowHeight(int cardCount, int columns, int rowCount, int rowGap);

  protected abstract boolean isPortraitViewport();

  protected abstract int calculateTrainingRowGap(int rowCount);

  protected abstract List<Integer> normalizeTrainingRowLayouts(
      List<Integer> rowLayouts, List<CourseScript.VideoCard> cards);

  protected abstract List<Integer> getRowLayoutsForScreen(EffectivePodScreen effectiveScreen);

  protected abstract String safeStationLabel(String stationNumber, int fallbackIndex);

  protected abstract List<CourseScript.VideoCard> buildActionSequence(
      List<CourseScript.VideoCard> videoCards, int loopCount);

  protected abstract List<CourseScript.PodSetConfig> getEffectiveSetConfigs(CourseScript.PodScreen rule);

  protected abstract int getTrainingTotalSeconds(CourseScript course);

  protected abstract int getPodDurationSeconds(CourseScript.Pod pod, EffectivePodScreen effectiveScreen);

  protected abstract int getPodEndingDurationSeconds(CourseScript course, CourseScript.Pod pod);

  protected abstract CourseScript.VideoGroup findVideoGroup(CourseScript course, String videoGroupId);

  protected abstract CourseScript.VideoGroupScreen findVideoGroupScreen(
      CourseScript.VideoGroup group, int screenIndex);
}
