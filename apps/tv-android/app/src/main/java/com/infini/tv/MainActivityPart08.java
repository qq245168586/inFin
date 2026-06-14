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

abstract class MainActivityPart08 extends MainActivityPart07 {
  protected void bindScheduleCourseImage(ImageView imageView, TextView fallbackView, String source) {
    if (imageView == null || fallbackView == null) {
      return;
    }
    String requestKey = source == null ? "" : source.trim();
    imageView.setTag(requestKey);
    imageView.setImageDrawable(null);
    imageView.setVisibility(View.GONE);
    fallbackView.setVisibility(View.VISIBLE);
    if (requestKey.isEmpty()) {
      return;
    }

    new Thread(
            () -> {
              Bitmap bitmap = ImageLoader.loadBitmap(requestKey, dp(180), dp(180));
              runOnUiThread(
                  () -> {
                    Object latestTag = imageView.getTag();
                    if (!(latestTag instanceof String) || !requestKey.equals(latestTag)) {
                      return;
                    }
                    if (bitmap == null) {
                      imageView.setVisibility(View.GONE);
                      fallbackView.setVisibility(View.VISIBLE);
                      return;
                    }
                    imageView.setImageBitmap(bitmap);
                    imageView.setVisibility(View.VISIBLE);
                    fallbackView.setVisibility(View.GONE);
                  });
            })
        .start();
  }

  protected String resolveScheduleBadgeText(TvScheduleItem item) {
    if (item == null || item.startTime == null || item.endTime == null) {
      return "即将开始";
    }
    java.time.LocalDateTime now =
        java.time.LocalDateTime.now(java.time.ZoneId.of(ServerConfig.COURSE_TIME_ZONE));
    if (now.isAfter(item.endTime)) {
      return "已结束";
    }
    if (now.isBefore(item.startTime)) {
      return "即将开始";
    }
    return "进行中";
  }

  protected void applyScheduleBadgeStyle(
      TextView badge,
      TvScheduleItem item,
      float textSize,
      int horizontalPadding,
      int verticalPadding,
      int minWidth) {
    if (badge == null) {
      return;
    }
    String status = resolveScheduleBadgeText(item);
    badge.setText(status);
    if ("进行中".equals(status)) {
      badge.setTextColor(getColor(R.color.tv_playback_text_dark));
    } else if ("已结束".equals(status)) {
      badge.setTextColor(getColor(R.color.tv_text_subtle));
    } else {
      badge.setTextColor(getColor(R.color.tv_text_main));
    }
    badge.setTextSize(textSize);
    badge.setGravity(android.view.Gravity.CENTER);
    badge.setMinWidth(minWidth);
    badge.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    if ("已结束".equals(status)) {
      badge.setBackgroundResource(R.drawable.bg_schedule_badge_ended);
      return;
    }
    if ("进行中".equals(status)) {
      badge.setBackgroundResource(R.drawable.bg_schedule_badge_live);
      return;
    }
    badge.setBackgroundResource(R.drawable.bg_schedule_badge_upcoming);
  }

  protected void syncHorizontalCourse(int screenNumber, boolean immediate) {
    if (syncInProgress) {
      return;
    }

    setScheduleSyncState(true, false);
    boolean cacheResources = shouldCacheHorizontalResources(screenNumber);
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.VISIBLE);
      if (cacheResources) {
        horizontalLoadingText.setText(immediate ? "正在同步今日课程资源..." : "检测到课程更新，正在重新同步资源...");
      } else {
        horizontalLoadingText.setText(immediate ? "正在同步今日课程数据..." : "检测到课程更新，正在同步课程数据...");
      }
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    dispatchScreenHeartbeat(false);

    new Thread(
            () -> {
              try {
                TvScriptRepository.SyncResult result =
                    repository.syncTodayBundle(
                        (message, completed, total) ->
                            runOnUiThread(
                                () -> {
                                  if (!shouldApplyHorizontalScreenUpdate(screenNumber)) {
                                    return;
                                  }
                                  if (horizontalLoadingText != null) {
                                    horizontalLoadingText.setVisibility(View.VISIBLE);
                                    horizontalLoadingText.setText(buildSyncMessage(message, completed, total));
                                  }
                                }),
                        cacheResources);

                runOnUiThread(
                    () -> {
                      if (!shouldApplyHorizontalScreenUpdate(screenNumber)) {
                        setScheduleSyncState(false, lastScheduleSyncFailed);
                        return;
                      }

                      setScheduleSyncState(false, false);
                      currentBundleChecksum = result.checksum;
                      currentBundleScheduleCount = result.schedules == null ? 0 : result.schedules.size();
                      resourceCacheDirty = !result.resourcesCached;
                      Log.i(
                          TAG,
                          "Horizontal schedule sync applied screen="
                              + screenNumber
                              + " checksum="
                              + result.checksum
                              + " schedules="
                              + currentBundleScheduleCount
                              + " resourcesCached="
                              + result.resourcesCached
                              + " cacheResources="
                              + cacheResources);
                      bindHorizontalSchedule(result.schedules);
                      dispatchScreenHeartbeat(false);
                      scheduleChecksumPolling();
                      requestCurrentPlaybackSession("horizontal_sync_complete");
                    });
              } catch (Exception error) {
                Log.e(TAG, "Horizontal schedule sync failed for screen " + screenNumber, error);
                runOnUiThread(
                    () -> {
                      if (!shouldApplyHorizontalScreenUpdate(screenNumber)) {
                        setScheduleSyncState(false, lastScheduleSyncFailed);
                        return;
                      }
                      setScheduleSyncState(false, true);
                      if (horizontalLoadingText != null) {
                        horizontalLoadingText.setVisibility(View.VISIBLE);
                        horizontalLoadingText.setText("同步横屏课程资源失败，请检查网络后重试。");
                      }
                      dispatchScreenHeartbeat(false);
                      scheduleChecksumPolling();
                    });
              }
            })
        .start();
  }

  protected boolean shouldCacheHorizontalResources(int screenNumber) {
    return screenNumber != 2 && screenNumber != 4;
  }

  protected void bindHorizontalSchedule(List<TvScheduleItem> scheduleItems) {
    syncedTodaySchedules.clear();
    if (scheduleItems != null) {
      syncedTodaySchedules.addAll(limitScheduleCards(scheduleItems));
    }
    if (horizontalScheduleList != null) {
      horizontalScheduleList.removeAllViews();
    }

    List<TvScheduleItem> displayItems = limitScheduleCards(scheduleItems);
    if (displayItems.isEmpty()) {
      activePlaybackItem = null;
      if (horizontalLoadingText != null) {
        horizontalLoadingText.setVisibility(View.VISIBLE);
        horizontalLoadingText.setText("今天还没有排课。");
      }
      if (horizontalScheduleScroll != null) {
        horizontalScheduleScroll.setVisibility(View.GONE);
      }
      if (horizontalContentPanel != null) {
        horizontalContentPanel.setVisibility(View.GONE);
      }
      if (horizontalTransitionPanel != null) {
        horizontalTransitionPanel.setVisibility(View.GONE);
      }
      dispatchScreenHeartbeat(false);
      return;
    }

    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalScheduleSubtitle != null) {
      horizontalScheduleSubtitle.setText("");
      horizontalScheduleSubtitle.setVisibility(View.GONE);
    }
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.VISIBLE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    dispatchScreenHeartbeat(false);

    if (isPortraitViewport()) {
      for (TvScheduleItem item : displayItems) {
        if (horizontalScheduleList != null) {
          horizontalScheduleList.addView(createVerticalScheduleCard(item));
        }
      }
      return;
    }

    for (int index = 0; index < displayItems.size(); index += 1) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, calculateHorizontalScheduleRowHeight());
      if (index > 0) {
        rowParams.topMargin = dp(8);
      }
      row.setLayoutParams(rowParams);

      View firstCard = createHorizontalScheduleCard(displayItems.get(index));
      LinearLayout.LayoutParams firstParams =
          new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
      firstCard.setLayoutParams(firstParams);
      row.addView(firstCard);

      if (horizontalScheduleList != null) {
        horizontalScheduleList.addView(row);
      }
    }
  }

  protected int calculateHorizontalScheduleRowHeight() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    return clamp(Math.round(shortSide * 0.2f), dp(178), dp(226));
  }

  protected TvScheduleItem selectHorizontalSchedule(List<TvScheduleItem> scheduleItems) {
    if (scheduleItems == null || scheduleItems.isEmpty()) {
      return null;
    }

    java.time.LocalDateTime now =
        java.time.LocalDateTime.now(java.time.ZoneId.of(ServerConfig.COURSE_TIME_ZONE));
    TvScheduleItem latestPastItem = null;
    for (TvScheduleItem item : scheduleItems) {
      if (item != null && item.isLive) {
        return item;
      }
    }

    TvScheduleItem nextItem = null;
    for (TvScheduleItem item : scheduleItems) {
      if (item == null || item.startTime == null) {
        continue;
      }
      if (item.startTime.isBefore(now)) {
        continue;
      }
      if (nextItem == null || item.startTime.isBefore(nextItem.startTime)) {
        nextItem = item;
      }
    }

    if (nextItem != null) {
      return nextItem;
    }

    for (TvScheduleItem item : scheduleItems) {
      if (item == null || item.startTime == null || item.startTime.isAfter(now)) {
        continue;
      }
      if (latestPastItem == null || item.startTime.isAfter(latestPastItem.startTime)) {
        latestPastItem = item;
      }
    }
    return latestPastItem;
  }

  protected String formatTimeRange(TvScheduleItem item) {
    return item.startTime.format(timeFormatter) + " - " + item.endTime.format(timeFormatter);
  }

  protected void refreshPlayback() {
    if (activePlaybackItem == null || activePlaybackItem.course == null) {
      return;
    }

    if (previewMode) {
      renderPreviewState();
      return;
    }

    CourseScript course = activePlaybackItem.course;
    int elapsedSeconds = (int) (currentPlaybackElapsedMs() / 1000L);
    int totalCourseSeconds = getCourseTotalSeconds(course);
    int trainingTotalSeconds = getTrainingTotalSeconds(course);
    currentCourseTotalSeconds = Math.max(totalCourseSeconds, 0);
    currentCourseElapsedSeconds =
        clamp(Math.max(elapsedSeconds, 0), 0, Math.max(currentCourseTotalSeconds, 0));
    currentTrainingTotalSeconds = Math.max(trainingTotalSeconds, 0);
    currentTrainingElapsedSeconds = 0;

    if (!isHorizontalInfoScreen(activeScreenNumber)) {
      configureVerticalPlaybackHeader(false);
    }

    int warmupReadySeconds = getWarmupReadySeconds(course);
    if (elapsedSeconds < warmupReadySeconds) {
      showWarmupReadyState(course, warmupReadySeconds - elapsedSeconds);
      return;
    }

    elapsedSeconds -= warmupReadySeconds;
    int warmupTotalSeconds = getWaterfallTotalSeconds(course.warmup);
    if (elapsedSeconds < warmupTotalSeconds) {
      updateWaterfallPlayback(course.warmup, elapsedSeconds, "WARM UP", "WARMUP", "热身进行中");
      return;
    }

    elapsedSeconds -= warmupTotalSeconds;
    int trainingReadySeconds = getTrainingReadySeconds(course);
    if (trainingReadySeconds > 0 && elapsedSeconds < trainingReadySeconds) {
      showWorkoutReadyState(course, trainingReadySeconds - elapsedSeconds);
      return;
    }

    elapsedSeconds -= trainingReadySeconds;
    if (elapsedSeconds < trainingTotalSeconds) {
      currentTrainingElapsedSeconds = clamp(Math.max(elapsedSeconds, 0), 0, currentTrainingTotalSeconds);
      updateTrainingPlayback(course, elapsedSeconds);
      return;
    }

    elapsedSeconds -= trainingTotalSeconds;
    currentTrainingElapsedSeconds = currentTrainingTotalSeconds;
    int cooldownReadySeconds = getCooldownReadySeconds(course);
    if (cooldownReadySeconds > 0 && elapsedSeconds < cooldownReadySeconds) {
      showCooldownReadyState(course, cooldownReadySeconds - elapsedSeconds);
      return;
    }

    elapsedSeconds -= cooldownReadySeconds;
    int cooldownTotalSeconds = getWaterfallTotalSeconds(course.cooldown);
    if (elapsedSeconds < cooldownTotalSeconds) {
      updateWaterfallPlayback(course.cooldown, elapsedSeconds, "COOL DOWN", "COOLDOWN", "冷身进行中");
      return;
    }

    showFinishState();
    stopPlaybackLoop();
  }
}
