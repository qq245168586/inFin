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

abstract class MainActivityPart07 extends MainActivityPart06 {
  protected void clearTvCacheFromRemote(String targetDeviceId) {
    if (targetDeviceId == null
        || targetDeviceId.trim().isEmpty()
        || !deviceId.equalsIgnoreCase(targetDeviceId)) {
      return;
    }

    if (syncInProgress || !"IDLE".equals(currentPlaybackState())) {
      return;
    }

    new Thread(
            () -> {
              try {
                repository.clearMediaCache();
                runOnUiThread(
                    () -> {
                      resourceCacheDirty = true;
                      dispatchScreenHeartbeat(false);
                    });
              } catch (Exception ignored) {
                // Ignore remote cache clear failures and wait for the next request.
              }
            })
        .start();
  }

  protected void scheduleChecksumPolling() {
    syncHandler.removeCallbacks(checksumTicker);
    syncHandler.postDelayed(checksumTicker, CHECKSUM_POLL_INTERVAL_MS);
  }

  protected void stopChecksumPolling() {
    syncHandler.removeCallbacks(checksumTicker);
  }

  protected boolean shouldApplyScreenUpdate(int screenNumber) {
    return activeScreenNumber == screenNumber && selectorPanel.getVisibility() != View.VISIBLE;
  }

  protected boolean shouldApplyVerticalScreenUpdate(int screenNumber) {
    return shouldApplyScreenUpdate(screenNumber) && isVerticalCourseScreen(screenNumber);
  }

  protected boolean shouldApplyHorizontalScreenUpdate(int screenNumber) {
    return shouldApplyScreenUpdate(screenNumber) && isHorizontalInfoScreen(screenNumber);
  }

  protected void requestNetworkRecoverySync() {
    if (selectorPanel == null || selectorPanel.getVisibility() == View.VISIBLE) {
      return;
    }
    if (syncInProgress || !"IDLE".equals(currentPlaybackState())) {
      return;
    }

    long now = System.currentTimeMillis();
    if (now - lastNetworkRecoverySyncAtMs < 5_000L) {
      return;
    }
    lastNetworkRecoverySyncAtMs = now;

    int screenNumber = activeScreenNumber;
    boolean needsFullSync = lastScheduleSyncFailed || syncedTodaySchedules.isEmpty() || resourceCacheDirty;
    if (needsFullSync) {
      if (isVerticalCourseScreen(screenNumber)) {
        Log.d(TAG, "Network restored, retrying vertical schedule sync for screen " + screenNumber);
        syncTodaySchedule(screenNumber, true);
      } else if (isHorizontalInfoScreen(screenNumber)) {
        Log.d(TAG, "Network restored, retrying horizontal schedule sync for screen " + screenNumber);
        syncHorizontalCourse(screenNumber, true);
      }
      return;
    }

    if (isVerticalCourseScreen(screenNumber) || isHorizontalInfoScreen(screenNumber)) {
      Log.d(TAG, "Network restored, refreshing checksum for screen " + screenNumber);
      requestTodayChecksumCheck(screenNumber);
    }
  }

  protected String buildSyncMessage(String message, int completed, int total) {
    if (total <= 0) {
      return message;
    }

    int percent = Math.round((completed * 100f) / total);
    return message + "\n同步进度 " + completed + "/" + total + " · " + percent + "%";
  }

  protected void showScheduleChrome() {
    contentTopBar.setVisibility(View.VISIBLE);
    pageTitle.setVisibility(View.VISIBLE);
    pageSubtitle.setVisibility(View.VISIBLE);
    pageDividerRow.setVisibility(View.VISIBLE);
  }

  protected void showHorizontalChrome() {
    hideTransitionDesign();
    if (contentPanel != null) {
      contentPanel.setPadding(0, 0, 0, 0);
    }
    contentTopBar.setVisibility(View.GONE);
    pageTitle.setVisibility(View.GONE);
    pageSubtitle.setVisibility(View.GONE);
    pageDividerRow.setVisibility(View.GONE);
    if (playbackStatusGroup != null) {
      playbackStatusGroup.setVisibility(View.GONE);
    }
    if (playbackHint != null) {
      playbackHint.setVisibility(View.GONE);
    }
  }

  protected void showPlaybackChrome(boolean showCountdown, boolean showHint) {
    contentTopBar.setVisibility(View.GONE);
    pageTitle.setVisibility(View.GONE);
    pageSubtitle.setVisibility(View.GONE);
    pageDividerRow.setVisibility(View.GONE);
    playbackStatusGroup.setVisibility(showCountdown ? View.VISIBLE : View.GONE);
    playbackHint.setVisibility(showHint ? View.VISIBLE : View.GONE);
  }

  protected View createScheduleCard(TvScheduleItem item) {
    return createDetailedScheduleCard(item, false);
  }

  protected View createVerticalScheduleCard(TvScheduleItem item) {
    return createDetailedScheduleCard(item, false);
  }

  protected View createHorizontalScheduleCard(TvScheduleItem item) {
    return createDetailedScheduleCard(item, true);
  }

  protected View createDetailedScheduleCard(TvScheduleItem item, boolean compact) {
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = compact ? 0 : dp(24);
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(compact ? 22 : 26), dp(compact ? 18 : 24), dp(compact ? 22 : 26), dp(compact ? 18 : 24));
    card.setMinimumHeight(compact ? dp(178) : dp(268));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    ScheduleCardInfo info = buildScheduleCardInfo(item);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
    card.addView(root);

    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(android.view.Gravity.CENTER_VERTICAL);
    root.addView(header);

    TextView number = new TextView(this);
    LinearLayout.LayoutParams numberParams = new LinearLayout.LayoutParams(dp(62), dp(42));
    number.setLayoutParams(numberParams);
    number.setGravity(android.view.Gravity.CENTER);
    number.setBackgroundResource(R.drawable.bg_schedule_info_chip);
    number.setText(info.number);
    number.setTextColor(getColor(R.color.tv_accent_gold_bright));
    number.setTextSize(compact ? 18f : 20f);
    number.setTypeface(number.getTypeface(), android.graphics.Typeface.BOLD);
    header.addView(number);

    TextView topic = new TextView(this);
    LinearLayout.LayoutParams topicParams =
        new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(42));
    topicParams.leftMargin = dp(16);
    topic.setLayoutParams(topicParams);
    topic.setGravity(android.view.Gravity.CENTER);
    topic.setBackgroundResource(R.drawable.bg_schedule_info_chip);
    topic.setPadding(dp(18), 0, dp(18), 0);
    topic.setText(info.topic);
    topic.setTextColor(getColor(R.color.tv_accent_gold_bright));
    topic.setTextSize(compact ? 16f : 18f);
    topic.setSingleLine(true);
    topic.setEllipsize(TextUtils.TruncateAt.END);
    topic.setTypeface(topic.getTypeface(), android.graphics.Typeface.BOLD);
    topic.setAutoSizeTextTypeUniformWithConfiguration(12, compact ? 16 : 18, 1, TypedValue.COMPLEX_UNIT_SP);
    header.addView(topic);

    LinearLayout body = new LinearLayout(this);
    LinearLayout.LayoutParams bodyParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    bodyParams.topMargin = compact ? dp(18) : dp(28);
    body.setLayoutParams(bodyParams);
    body.setOrientation(LinearLayout.HORIZONTAL);
    body.setGravity(android.view.Gravity.CENTER_VERTICAL);
    root.addView(body);

    FrameLayout imageCircle = new FrameLayout(this);
    int imageSize = compact ? dp(86) : dp(132);
    LinearLayout.LayoutParams imageCircleParams = new LinearLayout.LayoutParams(imageSize, imageSize);
    imageCircle.setLayoutParams(imageCircleParams);
    imageCircle.setBackgroundResource(R.drawable.bg_schedule_course_image_circle);
    imageCircle.setPadding(dp(compact ? 7 : 10), dp(compact ? 7 : 10), dp(compact ? 7 : 10), dp(compact ? 7 : 10));

    ImageView courseImage = new ImageView(this);
    FrameLayout.LayoutParams courseImageParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    courseImage.setLayoutParams(courseImageParams);
    courseImage.setAdjustViewBounds(true);
    courseImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
    imageCircle.addView(courseImage);

    TextView imageFallback = new TextView(this);
    imageFallback.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    imageFallback.setGravity(android.view.Gravity.CENTER);
    imageFallback.setText(item.logoText);
    imageFallback.setTextColor(getColor(R.color.tv_playback_text_dark));
    imageFallback.setTextSize(compact ? 12f : 17f);
    imageFallback.setTypeface(imageFallback.getTypeface(), android.graphics.Typeface.BOLD);
    imageFallback.setMaxLines(3);
    imageFallback.setAutoSizeTextTypeUniformWithConfiguration(8, compact ? 12 : 17, 1, TypedValue.COMPLEX_UNIT_SP);
    imageCircle.addView(imageFallback);
    body.addView(imageCircle);
    bindScheduleCourseImage(courseImage, imageFallback, item.logoSource);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = compact ? dp(22) : dp(32);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    body.addView(content);

    TextView name = new TextView(this);
    name.setText(info.name);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(compact ? 28f : 38f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(compact ? 1 : 2);
    name.setEllipsize(TextUtils.TruncateAt.END);
    name.setAutoSizeTextTypeUniformWithConfiguration(compact ? 18 : 24, compact ? 28 : 38, 1, TypedValue.COMPLEX_UNIT_SP);
    content.addView(name);

    TextView description = new TextView(this);
    LinearLayout.LayoutParams descriptionParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    descriptionParams.topMargin = dp(10);
    description.setLayoutParams(descriptionParams);
    description.setText(info.description);
    description.setTextColor(getColor(R.color.tv_text_subtle));
    description.setTextSize(compact ? 17f : 22f);
    description.setLineSpacing(dp(2), 1.0f);
    description.setMaxLines(compact ? 2 : 3);
    description.setEllipsize(TextUtils.TruncateAt.END);
    description.setAutoSizeTextTypeUniformWithConfiguration(compact ? 12 : 15, compact ? 17 : 22, 1, TypedValue.COMPLEX_UNIT_SP);
    content.addView(description);

    LinearLayout metrics = new LinearLayout(this);
    LinearLayout.LayoutParams metricsParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    metricsParams.topMargin = compact ? dp(16) : dp(22);
    metrics.setLayoutParams(metricsParams);
    metrics.setOrientation(LinearLayout.HORIZONTAL);
    content.addView(metrics);

    addScheduleMetricChip(metrics, "站点", info.stationText, compact);
    addScheduleMetricChip(metrics, "WORK", info.workText, compact);
    addScheduleMetricChip(metrics, "REST", info.restText, compact);
    addScheduleMetricChip(metrics, "换站", info.rotationText, compact);

    return card;
  }

  protected void addScheduleMetricChip(LinearLayout metrics, String label, String value, boolean compact) {
    LinearLayout chip = new LinearLayout(this);
    LinearLayout.LayoutParams chipParams =
        new LinearLayout.LayoutParams(0, compact ? dp(74) : dp(88), 1f);
    if (metrics.getChildCount() > 0) {
      chipParams.leftMargin = compact ? dp(10) : dp(14);
    }
    chip.setLayoutParams(chipParams);
    chip.setOrientation(LinearLayout.VERTICAL);
    chip.setGravity(android.view.Gravity.CENTER_VERTICAL);
    chip.setPadding(dp(14), dp(8), dp(10), dp(8));
    chip.setBackgroundResource(R.drawable.bg_schedule_metric_chip);
    metrics.addView(chip);

    TextView labelView = new TextView(this);
    labelView.setText(label);
    labelView.setTextColor(getColor(R.color.tv_text_muted));
    labelView.setTextSize(compact ? 12f : 15f);
    labelView.setSingleLine(true);
    labelView.setEllipsize(TextUtils.TruncateAt.END);
    chip.addView(labelView);

    TextView valueView = new TextView(this);
    LinearLayout.LayoutParams valueParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
    valueView.setLayoutParams(valueParams);
    valueView.setGravity(android.view.Gravity.CENTER_VERTICAL);
    valueView.setText(value);
    valueView.setTextColor(getColor(R.color.tv_text_main));
    valueView.setTextSize(compact ? 18f : 22f);
    valueView.setTypeface(valueView.getTypeface(), android.graphics.Typeface.BOLD);
    valueView.setSingleLine(true);
    valueView.setEllipsize(TextUtils.TruncateAt.END);
    valueView.setAutoSizeTextTypeUniformWithConfiguration(10, compact ? 18 : 22, 1, TypedValue.COMPLEX_UNIT_SP);
    chip.addView(valueView);
  }

  protected ScheduleCardInfo buildScheduleCardInfo(TvScheduleItem item) {
    CourseScript course = item == null ? null : item.course;
    CourseScript.Metadata metadata = course == null ? null : course.metadata;
    String name =
        firstScheduleText(
            metadata == null ? "" : metadata.name,
            item == null ? "" : item.courseName,
            "未命名课程");
    String topic = firstScheduleText(metadata == null ? "" : metadata.topic, "综合训练");
    String description =
        firstScheduleText(metadata == null ? "" : metadata.description, "按教练编排完成今日训练。");
    String rotationType = metadata == null ? "REGION" : metadata.rotationType;
    CourseScript.Pod pod = findFirstSchedulePod(course);
    CourseScript.PodScreen screen = findFirstScheduleScreen(pod);
    CourseScript.VideoGroup group = findScheduleVideoGroup(course, pod == null ? "" : pod.videoGroupId);
    return new ScheduleCardInfo(
        resolveScheduleNumber(item),
        name,
        topic,
        description,
        buildScheduleStationText(group, rotationType),
        buildScheduleWorkText(screen, metadata),
        buildScheduleRestText(screen, metadata),
        buildRotationText(rotationType));
  }

  protected String resolveScheduleNumber(TvScheduleItem item) {
    int index = syncedTodaySchedules == null ? -1 : syncedTodaySchedules.indexOf(item);
    if (index < 0) {
      return "01";
    }
    return String.format(Locale.US, "%02d", index + 1);
  }

  protected String firstScheduleText(String... values) {
    if (values == null) {
      return "";
    }
    for (String value : values) {
      if (value != null && !value.trim().isEmpty()) {
        return value.trim();
      }
    }
    return "";
  }

  protected CourseScript.Pod findFirstSchedulePod(CourseScript course) {
    if (course == null || course.pods == null) {
      return null;
    }
    for (CourseScript.Pod pod : course.pods) {
      if (pod != null && !TextUtils.isEmpty(pod.videoGroupId)) {
        return pod;
      }
    }
    return course.pods.isEmpty() ? null : course.pods.get(0);
  }

  protected CourseScript.PodScreen findFirstScheduleScreen(CourseScript.Pod pod) {
    if (pod == null || pod.screens == null || pod.screens.isEmpty()) {
      return null;
    }
    for (CourseScript.PodScreen screen : pod.screens) {
      if (screen != null && screen.setConfigs != null && !screen.setConfigs.isEmpty()) {
        return screen;
      }
    }
    return pod.screens.get(0);
  }

  protected CourseScript.VideoGroup findScheduleVideoGroup(CourseScript course, String videoGroupId) {
    if (course == null || course.videoGroups == null || TextUtils.isEmpty(videoGroupId)) {
      return null;
    }
    for (CourseScript.VideoGroup group : course.videoGroups) {
      if (group != null && TextUtils.equals(group.id, videoGroupId)) {
        return group;
      }
    }
    return null;
  }

  protected String buildScheduleStationText(CourseScript.VideoGroup group, String rotationType) {
    if (group == null) {
      return "-";
    }
    String normalized = rotationType == null ? "REGION" : rotationType.trim().toUpperCase(Locale.US);
    int screenCount = group.screenCount > 0 ? group.screenCount : group.screens == null ? 0 : group.screens.size();
    if ("REGION".equals(normalized) && screenCount > 1) {
      return screenCount + " 区域";
    }
    Set<String> stationNumbers = new HashSet<>();
    int cardCount = 0;
    if (group.screens != null) {
      for (CourseScript.VideoGroupScreen screen : group.screens) {
        if (screen == null || screen.videoCards == null) {
          continue;
        }
        for (CourseScript.VideoCard card : screen.videoCards) {
          if (card == null) {
            continue;
          }
          if (!TextUtils.isEmpty(card.actionId) || !TextUtils.isEmpty(card.actionName)) {
            cardCount += 1;
          }
          if (!TextUtils.isEmpty(card.stationNumber)) {
            stationNumbers.add(card.stationNumber.trim());
          }
        }
        if (!stationNumbers.isEmpty() || cardCount > 0) {
          break;
        }
      }
    }
    int stationCount = !stationNumbers.isEmpty() ? stationNumbers.size() : cardCount;
    return stationCount > 0 ? stationCount + " 站" : "-";
  }

  protected String buildScheduleWorkText(CourseScript.PodScreen screen, CourseScript.Metadata metadata) {
    List<Integer> seconds = new ArrayList<>();
    if (screen != null && screen.setConfigs != null) {
      for (CourseScript.PodSetConfig config : screen.setConfigs) {
        if (config != null && config.workSeconds > 0 && !seconds.contains(config.workSeconds)) {
          seconds.add(config.workSeconds);
        }
      }
    }
    if (seconds.isEmpty() && metadata != null && metadata.workSeconds > 0) {
      seconds.add(metadata.workSeconds);
    }
    return formatScheduleSeconds(seconds);
  }

  protected String buildScheduleRestText(CourseScript.PodScreen screen, CourseScript.Metadata metadata) {
    List<Integer> seconds = new ArrayList<>();
    if (screen != null && screen.setConfigs != null) {
      for (CourseScript.PodSetConfig config : screen.setConfigs) {
        if (config != null && config.restSeconds > 0 && !seconds.contains(config.restSeconds)) {
          seconds.add(config.restSeconds);
        }
      }
    }
    if (seconds.isEmpty() && screen != null && screen.stationRestSeconds > 0) {
      seconds.add(screen.stationRestSeconds);
    }
    if (seconds.isEmpty() && metadata != null && metadata.restSeconds > 0) {
      seconds.add(metadata.restSeconds);
    }
    return formatScheduleSeconds(seconds);
  }

  protected String formatScheduleSeconds(List<Integer> seconds) {
    if (seconds == null || seconds.isEmpty()) {
      return "-";
    }
    StringBuilder builder = new StringBuilder();
    for (int index = 0; index < seconds.size(); index += 1) {
      if (index > 0) {
        builder.append("/");
      }
      builder.append(seconds.get(index));
    }
    builder.append("s");
    return builder.toString();
  }

  protected String buildRotationText(String rotationType) {
    String normalized = rotationType == null ? "REGION" : rotationType.trim().toUpperCase(Locale.US);
    if ("LANE".equals(normalized)) {
      return "跑道换站";
    }
    if ("SNAKE".equals(normalized)) {
      return "蛇形换站";
    }
    return "区域轮转";
  }

  protected static class ScheduleCardInfo {
    final String number;
    final String name;
    final String topic;
    final String description;
    final String stationText;
    final String workText;
    final String restText;
    final String rotationText;

    ScheduleCardInfo(
        String number,
        String name,
        String topic,
        String description,
        String stationText,
        String workText,
        String restText,
        String rotationText) {
      this.number = number;
      this.name = name;
      this.topic = topic;
      this.description = description;
      this.stationText = stationText;
      this.workText = workText;
      this.restText = restText;
      this.rotationText = rotationText;
    }
  }
}
