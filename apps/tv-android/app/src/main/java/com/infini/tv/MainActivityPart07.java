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
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = dp(22);
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(30), dp(30), dp(30), dp(30));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    card.addView(row);

    TextView logo = new TextView(this);
    LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(120), dp(120));
    logo.setLayoutParams(logoParams);
    logo.setBackgroundResource(R.drawable.bg_logo_panel);
    logo.setText(item.logoText);
    logo.setTextColor(getColor(R.color.tv_accent_gold_bright));
    logo.setTextSize(17f);
    logo.setLineSpacing(0f, 0.92f);
    logo.setGravity(android.view.Gravity.CENTER);
    row.addView(logo);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(24);
    contentParams.rightMargin = dp(92);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    row.addView(content);

    TextView name = new TextView(this);
    String versionSuffix =
        item.version == null || item.version.trim().isEmpty() ? "" : " (" + item.version + ")";
    name.setText(item.courseName + versionSuffix);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(24f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(2);
    name.setEllipsize(TextUtils.TruncateAt.END);
    content.addView(name);

    TextView time = new TextView(this);
    LinearLayout.LayoutParams timeParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    timeParams.topMargin = dp(12);
    time.setLayoutParams(timeParams);
    time.setText("◷  " + formatTimeRange(item));
    time.setTextColor(getColor(R.color.tv_accent_gold_bright));
    time.setTextSize(19f);
    time.setTypeface(time.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(time);

    TextView footer = new TextView(this);
    LinearLayout.LayoutParams footerParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    footerParams.topMargin = dp(16);
    footer.setLayoutParams(footerParams);
    footer.setText("点击进入课程预览");
    footer.setTextColor(getColor(R.color.tv_text_muted));
    footer.setTextSize(15f);
    footer.setTypeface(footer.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(footer);

    TextView badge = new TextView(this);
    FrameLayout.LayoutParams badgeParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.gravity = android.view.Gravity.END | android.view.Gravity.TOP;
    badge.setLayoutParams(badgeParams);
    applyScheduleBadgeStyle(badge, item, 16f, dp(18), dp(10), dp(112));
    card.addView(badge);

    return card;
  }

  protected View createVerticalScheduleCard(TvScheduleItem item) {
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = dp(20);
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(20), dp(18), dp(18), dp(18));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(android.view.Gravity.CENTER_VERTICAL);
    card.addView(row);

    FrameLayout imageCircle = new FrameLayout(this);
    LinearLayout.LayoutParams imageCircleParams = new LinearLayout.LayoutParams(dp(66), dp(66));
    imageCircle.setLayoutParams(imageCircleParams);
    imageCircle.setBackgroundResource(R.drawable.bg_schedule_course_image_circle);
    imageCircle.setPadding(dp(6), dp(6), dp(6), dp(6));

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
    imageFallback.setTextSize(10f);
    imageFallback.setTypeface(imageFallback.getTypeface(), android.graphics.Typeface.BOLD);
    imageFallback.setMaxLines(2);
    imageCircle.addView(imageFallback);
    row.addView(imageCircle);
    bindScheduleCourseImage(courseImage, imageFallback, item.logoSource);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(18);
    contentParams.rightMargin = dp(78);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    row.addView(content);

    TextView name = new TextView(this);
    name.setText(item.courseName);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(21f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(1);
    name.setEllipsize(TextUtils.TruncateAt.END);
    content.addView(name);

    TextView time = new TextView(this);
    LinearLayout.LayoutParams timeParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    timeParams.topMargin = dp(10);
    time.setLayoutParams(timeParams);
    time.setText("◷  " + formatTimeRange(item));
    time.setTextColor(getColor(R.color.tv_accent_gold_bright));
    time.setTextSize(16f);
    time.setTypeface(time.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(time);

    TextView badge = new TextView(this);
    FrameLayout.LayoutParams badgeParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.gravity = android.view.Gravity.END | android.view.Gravity.TOP;
    badge.setLayoutParams(badgeParams);
    applyScheduleBadgeStyle(badge, item, 12f, dp(14), dp(7), dp(68));
    card.addView(badge);

    return card;
  }

  protected View createHorizontalScheduleCard(TvScheduleItem item) {
    FrameLayout card = new FrameLayout(this);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(28), dp(22), dp(24), dp(22));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    LinearLayout row = new LinearLayout(this);
    FrameLayout.LayoutParams rowParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    row.setLayoutParams(rowParams);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(android.view.Gravity.CENTER_VERTICAL);
    card.addView(row);

    FrameLayout imageCircle = new FrameLayout(this);
    LinearLayout.LayoutParams imageCircleParams = new LinearLayout.LayoutParams(dp(96), dp(96));
    imageCircle.setLayoutParams(imageCircleParams);
    imageCircle.setBackgroundResource(R.drawable.bg_schedule_course_image_circle);
    imageCircle.setPadding(dp(8), dp(8), dp(8), dp(8));

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
    imageFallback.setTextSize(13f);
    imageFallback.setTypeface(imageFallback.getTypeface(), android.graphics.Typeface.BOLD);
    imageFallback.setMaxLines(2);
    imageCircle.addView(imageFallback);
    row.addView(imageCircle);
    bindScheduleCourseImage(courseImage, imageFallback, item.logoSource);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(28);
    contentParams.rightMargin = dp(128);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    row.addView(content);

    TextView name = new TextView(this);
    name.setText(item.courseName);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(34f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(1);
    name.setEllipsize(TextUtils.TruncateAt.END);
    content.addView(name);

    TextView time = new TextView(this);
    LinearLayout.LayoutParams timeParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    timeParams.topMargin = dp(8);
    time.setLayoutParams(timeParams);
    time.setText("◷  " + formatTimeRange(item));
    time.setTextColor(getColor(R.color.tv_accent_gold_bright));
    time.setTextSize(26f);
    time.setTypeface(time.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(time);

    TextView badge = new TextView(this);
    FrameLayout.LayoutParams badgeParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.gravity = android.view.Gravity.END | android.view.Gravity.TOP;
    badge.setLayoutParams(badgeParams);
    applyScheduleBadgeStyle(badge, item, 20f, dp(20), dp(10), dp(124));
    card.addView(badge);

    return card;
  }
}
