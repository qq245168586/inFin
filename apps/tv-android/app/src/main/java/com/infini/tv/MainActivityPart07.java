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
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
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
    return createVerticalScheduleCard(item);
  }

  protected View createVerticalScheduleCard(TvScheduleItem item) {
    FrameLayout card = createScheduleCardContainer(item, dp(24), dp(26), dp(24), dp(268));
    ScheduleCardInfo info = buildScheduleCardInfo(item);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
    card.addView(root);

    root.addView(createScheduleHeader(info, false));

    LinearLayout body = new LinearLayout(this);
    LinearLayout.LayoutParams bodyParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    bodyParams.topMargin = dp(28);
    body.setLayoutParams(bodyParams);
    body.setOrientation(LinearLayout.HORIZONTAL);
    body.setGravity(android.view.Gravity.CENTER_VERTICAL);
    root.addView(body);

    body.addView(createScheduleCourseIcon(item, dp(132), 17f));

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(32);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    body.addView(content);

    content.addView(createScheduleNameText(createCourseTitleWithVersion(info.name, info.version, 0.56f), 38f, 24, 38, 2));
    content.addView(createScheduleDescriptionText(info.description, 22f, 15, 22, 3, dp(10)));

    LinearLayout metrics = createScheduleMetricRow(dp(22));
    content.addView(metrics);
    addScheduleMetricChip(metrics, "Set", info.setText, false, 0);
    addScheduleMetricChip(metrics, "Work", info.workText, false, 0);
    addScheduleMetricChip(metrics, "Rest", info.restText, false, 0);
    addScheduleMetricChip(metrics, "Switch", info.switchText, false, 0);

    return card;
  }

  protected View createHorizontalScheduleCard(TvScheduleItem item) {
    FrameLayout card = createScheduleCardContainer(item, 0, dp(18), dp(16), dp(168));
    ScheduleCardInfo info = buildScheduleCardInfo(item);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    card.addView(root);

    root.addView(createScheduleHeader(info, true));

    LinearLayout body = new LinearLayout(this);
    LinearLayout.LayoutParams bodyParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
    bodyParams.topMargin = dp(10);
    body.setLayoutParams(bodyParams);
    body.setOrientation(LinearLayout.HORIZONTAL);
    body.setGravity(android.view.Gravity.CENTER_VERTICAL);
    root.addView(body);

    body.addView(createScheduleCourseIcon(item, dp(76), 11f));

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(18);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    body.addView(content);

    LinearLayout titleRow = new LinearLayout(this);
    titleRow.setOrientation(LinearLayout.HORIZONTAL);
    titleRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    content.addView(titleRow);

    LinearLayout titleColumn = new LinearLayout(this);
    titleColumn.setOrientation(LinearLayout.VERTICAL);
    titleColumn.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    titleRow.addView(titleColumn);
    titleColumn.addView(createScheduleNameText(createCourseTitleWithVersion(info.name, info.version, 0.58f), 26f, 16, 26, 1));
    titleColumn.addView(createScheduleDescriptionText(info.description, 15f, 10, 15, 1, dp(4)));

    LinearLayout metrics = createScheduleMetricRow(0);
    LinearLayout.LayoutParams metricsParams =
        new LinearLayout.LayoutParams(dp(390), dp(58));
    metricsParams.leftMargin = dp(18);
    metrics.setLayoutParams(metricsParams);
    titleRow.addView(metrics);
    addScheduleMetricChip(metrics, "Set", info.setText, true, dp(88));
    addScheduleMetricChip(metrics, "Work", info.workText, true, dp(92));
    addScheduleMetricChip(metrics, "Rest", info.restText, true, dp(92));
    addScheduleMetricChip(metrics, "Switch", info.compactSwitchText, true, dp(104));

    return card;
  }

  protected FrameLayout createScheduleCardContainer(
      TvScheduleItem item, int topMargin, int horizontalPadding, int verticalPadding, int minHeight) {
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = topMargin;
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
    card.setMinimumHeight(minHeight);
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));
    return card;
  }

  protected LinearLayout createScheduleHeader(ScheduleCardInfo info, boolean compact) {
    LinearLayout header = new LinearLayout(this);
    header.setOrientation(LinearLayout.HORIZONTAL);
    header.setGravity(android.view.Gravity.CENTER_VERTICAL);

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

    return header;
  }

  protected FrameLayout createScheduleCourseIcon(TvScheduleItem item, int imageSize, float fallbackTextSize) {
    FrameLayout iconFrame = new FrameLayout(this);
    LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(imageSize, imageSize);
    iconFrame.setLayoutParams(iconParams);

    ImageView courseImage = new ImageView(this);
    FrameLayout.LayoutParams courseImageParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    courseImage.setLayoutParams(courseImageParams);
    courseImage.setAdjustViewBounds(true);
    courseImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
    iconFrame.addView(courseImage);

    TextView imageFallback = new TextView(this);
    imageFallback.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    imageFallback.setGravity(android.view.Gravity.CENTER);
    imageFallback.setText(item == null ? "" : item.logoText);
    imageFallback.setTextColor(getColor(R.color.tv_text_main));
    imageFallback.setTextSize(fallbackTextSize);
    imageFallback.setTypeface(imageFallback.getTypeface(), android.graphics.Typeface.BOLD);
    imageFallback.setMaxLines(3);
    imageFallback.setAutoSizeTextTypeUniformWithConfiguration(8, Math.round(fallbackTextSize), 1, TypedValue.COMPLEX_UNIT_SP);
    iconFrame.addView(imageFallback);
    bindScheduleCourseImage(courseImage, imageFallback, item == null ? "" : item.logoSource);
    return iconFrame;
  }

  protected TextView createScheduleNameText(
      CharSequence text, float textSize, int minTextSize, int maxTextSize, int maxLines) {
    TextView name = new TextView(this);
    name.setText(text);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(textSize);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(maxLines);
    name.setEllipsize(TextUtils.TruncateAt.END);
    name.setAutoSizeTextTypeUniformWithConfiguration(minTextSize, maxTextSize, 1, TypedValue.COMPLEX_UNIT_SP);
    return name;
  }

  protected CharSequence createCourseTitleWithVersion(String courseName, String version, float versionScale) {
    String name = firstScheduleText(courseName, "未命名课程");
    String rawVersion = firstScheduleText(version, "").trim();
    if (rawVersion.isEmpty()) {
      return name;
    }
    String normalizedVersion = rawVersion.toLowerCase(Locale.ROOT).startsWith("v") ? rawVersion : "v" + rawVersion;
    String suffix = "  " + normalizedVersion;
    SpannableString title = new SpannableString(name + suffix);
    int start = name.length() + 2;
    title.setSpan(new RelativeSizeSpan(versionScale), start, title.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    title.setSpan(new ForegroundColorSpan(0x99f5d56e), start, title.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    return title;
  }

  protected TextView createScheduleDescriptionText(
      String text, float textSize, int minTextSize, int maxTextSize, int maxLines, int topMargin) {
    TextView description = new TextView(this);
    LinearLayout.LayoutParams descriptionParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    descriptionParams.topMargin = topMargin;
    description.setLayoutParams(descriptionParams);
    description.setText(text);
    description.setTextColor(getColor(R.color.tv_text_subtle));
    description.setTextSize(textSize);
    description.setLineSpacing(dp(2), 1.0f);
    description.setMaxLines(maxLines);
    description.setEllipsize(TextUtils.TruncateAt.END);
    description.setAutoSizeTextTypeUniformWithConfiguration(minTextSize, maxTextSize, 1, TypedValue.COMPLEX_UNIT_SP);
    return description;
  }

  protected LinearLayout createScheduleMetricRow(int topMargin) {
    LinearLayout metrics = new LinearLayout(this);
    LinearLayout.LayoutParams metricsParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    metricsParams.topMargin = topMargin;
    metrics.setLayoutParams(metricsParams);
    metrics.setOrientation(LinearLayout.HORIZONTAL);
    return metrics;
  }

  protected void addScheduleMetricChip(
      LinearLayout metrics, String label, String value, boolean compact, int fixedWidth) {
    LinearLayout chip = new LinearLayout(this);
    LinearLayout.LayoutParams chipParams =
        fixedWidth > 0
            ? new LinearLayout.LayoutParams(fixedWidth, LinearLayout.LayoutParams.MATCH_PARENT)
            : new LinearLayout.LayoutParams(0, compact ? dp(58) : dp(88), 1f);
    if (metrics.getChildCount() > 0) {
      chipParams.leftMargin = compact ? dp(6) : dp(14);
    }
    chip.setLayoutParams(chipParams);
    chip.setOrientation(LinearLayout.VERTICAL);
    chip.setGravity(android.view.Gravity.CENTER_VERTICAL);
    chip.setPadding(dp(compact ? 8 : 14), dp(compact ? 5 : 8), dp(compact ? 7 : 10), dp(compact ? 5 : 8));
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
    valueView.setText(value == null ? "" : value);
    valueView.setTextColor(getColor(R.color.tv_text_main));
    valueView.setTextSize(compact ? 15f : 22f);
    valueView.setTypeface(valueView.getTypeface(), android.graphics.Typeface.BOLD);
    valueView.setSingleLine(true);
    valueView.setEllipsize(TextUtils.TruncateAt.END);
    valueView.setAutoSizeTextTypeUniformWithConfiguration(9, compact ? 15 : 22, 1, TypedValue.COMPLEX_UNIT_SP);
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
    TvScheduleItem.ScheduleDisplayFields displayFields =
        item == null ? TvScheduleItem.ScheduleDisplayFields.EMPTY : item.displayFields;
    String setText = firstScheduleText(displayFields.setText, buildScheduleSetText(screen, metadata));
    if (isRegionCountText(setText)) {
      setText = buildScheduleStationText(group);
    }
    return new ScheduleCardInfo(
        resolveScheduleNumber(item),
        name,
        firstScheduleText(metadata == null ? "" : metadata.version, item == null ? "" : item.version, "--"),
        topic,
        description,
        setText,
        firstScheduleText(displayFields.workText, buildScheduleWorkText(screen, metadata)),
        firstScheduleText(displayFields.restText, buildScheduleRestText(screen, metadata)),
        buildScheduleSwitchText(displayFields, rotationType, false),
        buildScheduleSwitchText(displayFields, rotationType, true));
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

  protected boolean isRegionCountText(String text) {
    if (TextUtils.isEmpty(text)) {
      return false;
    }
    String normalized = text.trim().toLowerCase(Locale.US);
    return normalized.contains("区域") || normalized.contains("region");
  }

  protected String buildScheduleStationText(CourseScript.VideoGroup group) {
    if (group == null) {
      return "-";
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

  protected String buildScheduleSetText(CourseScript.PodScreen screen, CourseScript.Metadata metadata) {
    if (screen != null && screen.setConfigs != null && !screen.setConfigs.isEmpty()) {
      return String.valueOf(screen.setConfigs.size());
    }
    if (metadata != null && metadata.setCount > 0) {
      return String.valueOf(metadata.setCount);
    }
    return "";
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
      return "";
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

  protected String buildScheduleSwitchText(
      TvScheduleItem.ScheduleDisplayFields displayFields, String rotationType, boolean compact) {
    if (displayFields != null && !TextUtils.isEmpty(displayFields.switchText)) {
      return displayFields.switchText;
    }
    String normalized = rotationType == null ? "REGION" : rotationType.trim().toUpperCase(Locale.US);
    if ("SNAKE".equals(normalized)) {
      return firstScheduleText(
          displayFields == null ? "" : displayFields.leaderText,
          compact ? "leader" : "follow the leader");
    }
    return firstScheduleText(displayFields == null ? "" : displayFields.portText, "pod");
  }

  protected static class ScheduleCardInfo {
    final String number;
    final String name;
    final String version;
    final String topic;
    final String description;
    final String setText;
    final String workText;
    final String restText;
    final String switchText;
    final String compactSwitchText;

    ScheduleCardInfo(
        String number,
        String name,
        String version,
        String topic,
        String description,
        String setText,
        String workText,
        String restText,
        String switchText,
        String compactSwitchText) {
      this.number = number;
      this.name = name;
      this.version = version;
      this.topic = topic;
      this.description = description;
      this.setText = setText;
      this.workText = workText;
      this.restText = restText;
      this.switchText = switchText;
      this.compactSwitchText = compactSwitchText;
    }
  }
}
