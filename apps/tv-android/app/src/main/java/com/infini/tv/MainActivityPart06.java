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

abstract class MainActivityPart06 extends MainActivityPart05 {
  protected void startCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      long playbackStartAtMs,
      long serverNowMs,
      String playbackSessionId,
      String bundleChecksum) {
    Log.d(
        TAG,
        "Remote start requested scheduleId="
            + scheduleId
            + " courseId="
            + courseId
            + " session="
            + playbackSessionId
            + " checksum="
            + bundleChecksum
            + " playbackStartAtMs="
            + playbackStartAtMs
            + " serverNowMs="
            + serverNowMs
            + " preview="
            + previewMode
            + " active="
            + (activePlaybackItem == null ? "" : activePlaybackItem.id)
            + " sync="
            + syncInProgress);
    bringPlaybackUiToFront();
    hideCoursePlanPanel();
    if (!TextUtils.isEmpty(playbackSessionId)) {
      Log.d(TAG, "Remote start resolved by authoritative session id=" + playbackSessionId);
      requestCurrentPlaybackSession("start_course_session_authoritative");
      return;
    }
    if (syncInProgress) {
      requestCurrentPlaybackSession("start_course_while_syncing");
      return;
    }

    if (canStartActivePreviewFromRemote(scheduleId, courseId, playbackSessionId, bundleChecksum)) {
      beginRemoteCoursePlayback(
          activePlaybackItem, playbackStartAtMs, serverNowMs, playbackSessionId, bundleChecksum);
      return;
    }

    resolveRemoteSchedule(
        scheduleId,
        courseId,
        scheduledStartAtMs,
        bundleChecksum,
        item -> {
          if (item != null) {
            beginRemoteCoursePlayback(item, playbackStartAtMs, serverNowMs, playbackSessionId, bundleChecksum);
          } else {
            requestCurrentPlaybackSession("start_course_missing_schedule");
          }
        });
  }

  protected boolean canStartActivePreviewFromRemote(
      String scheduleId, int courseId, String playbackSessionId, String bundleChecksum) {
    if (!previewMode || activePlaybackItem == null) {
      return false;
    }

    boolean hasScheduleIdentity = !TextUtils.isEmpty(scheduleId) || courseId > 0;
    boolean scheduleMatches = !hasScheduleIdentity || matchesActiveSchedule(scheduleId, courseId);
    boolean sessionMatches =
        TextUtils.isEmpty(playbackSessionId)
            || TextUtils.isEmpty(activePlaybackSessionId)
            || TextUtils.equals(playbackSessionId, activePlaybackSessionId);
    boolean checksumMatches =
        TextUtils.isEmpty(bundleChecksum)
            || TextUtils.equals(bundleChecksum, activeBundleChecksum)
            || TextUtils.equals(bundleChecksum, activePlaybackItem.contentChecksum);
    return scheduleMatches && sessionMatches && checksumMatches;
  }

  protected void beginRemoteCoursePlayback(
      TvScheduleItem item,
      long playbackStartAtMs,
      long serverNowMs,
      String playbackSessionId,
      String bundleChecksum) {
    if (item == null) {
      return;
    }
    activePlaybackItem = item;
    activePlaybackSessionId = playbackSessionId == null ? "" : playbackSessionId;
    activePlaybackSessionVersion = 0;
    activePlaybackSessionState = "RUNNING";
    sessionDrivenPlayback = false;
    clearPlaybackSessionTiming();
    activeBundleChecksum =
        !TextUtils.isEmpty(bundleChecksum) ? bundleChecksum : item.contentChecksum;
    previewMode = false;
    playbackPaused = false;
    resetAudioCueTracking();
    long effectiveServerNowMs =
        sessionServerNowBaseMs > 0L ? correctedServerNowMs() : Math.max(serverNowMs, 0L);
    playbackStartElapsedRealtimeMs =
        resolveElapsedRealtimeForServerWallClock(
            playbackStartAtMs > 0 ? playbackStartAtMs : correctedServerNowMs(),
            effectiveServerNowMs);
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = 0L;
    resetPlaybackStateCaches();
    refreshPlayback();
    playbackLoopRunning = true;
    playbackHandler.removeCallbacks(playbackTicker);
    playbackHandler.postDelayed(playbackTicker, nextPlaybackTickDelayMs());
    dispatchScreenHeartbeat(false);
  }

  protected void bringPlaybackUiToFront() {
    try {
      Intent intent = new Intent(this, MainActivity.class);
      intent.addFlags(
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
              | Intent.FLAG_ACTIVITY_CLEAR_TOP
              | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      startActivity(intent);
    } catch (Exception error) {
      Log.w(TAG, "Unable to bring TV activity to foreground", error);
    }
  }

  protected void pauseCourseFromRemote(
      String scheduleId, int courseId, long pausedAtMs, String playbackSessionId) {
    bringPlaybackUiToFront();
    hideCoursePlanPanel();
    requestCurrentPlaybackSession("pause_course");
  }

  protected void resumeCourseFromRemote(
      String scheduleId, int courseId, long resumedAtMs, String playbackSessionId) {
    bringPlaybackUiToFront();
    hideCoursePlanPanel();
    requestCurrentPlaybackSession("resume_course");
  }

  protected void terminateCourseFromRemote(
      String scheduleId, int courseId, String playbackSessionId) {
    bringPlaybackUiToFront();
    hideCoursePlanPanel();
    if (TextUtils.isEmpty(playbackSessionId) || TextUtils.equals(playbackSessionId, activePlaybackSessionId)) {
      returnToScheduleListAfterFinish();
      return;
    }
    requestCurrentPlaybackSession("terminate_course");
  }

  protected TvScheduleItem findSyncedSchedule(String scheduleId, int courseId, long scheduledStartAtMs) {
    if (syncedTodaySchedules.isEmpty()) {
      return null;
    }

    for (TvScheduleItem item : syncedTodaySchedules) {
      if (item == null) {
        continue;
      }
      if (scheduleId != null && !scheduleId.trim().isEmpty() && scheduleId.equals(item.id)) {
        return item;
      }
    }

    for (TvScheduleItem item : syncedTodaySchedules) {
      if (item == null) {
        continue;
      }
      if (courseId > 0 && item.courseId == courseId) {
        if (scheduledStartAtMs <= 0 || toEpochMs(item.startTime) == scheduledStartAtMs) {
          return item;
        }
      }
    }
    return null;
  }

  protected void resolveRemoteSchedule(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      String requiredBundleChecksum,
      RemoteScheduleAction action) {
    TvScheduleItem localItem =
        resourceCacheDirty ? null : findSyncedSchedule(scheduleId, courseId, scheduledStartAtMs);
    if (localItem != null
        && (TextUtils.isEmpty(requiredBundleChecksum)
            || TextUtils.equals(requiredBundleChecksum, localItem.contentChecksum))) {
      action.apply(localItem);
      return;
    }

    if (scheduleId == null || scheduleId.trim().isEmpty()) {
      Log.w(
          TAG,
          "Remote schedule resolve skipped because scheduleId is empty courseId="
              + courseId
              + " scheduledStartAt="
              + scheduledStartAtMs);
      return;
    }

    new Thread(
            () -> {
              try {
                TvScheduleItem remoteItem = repository.loadScheduleById(scheduleId);
                if (remoteItem == null) {
                  Log.w(TAG, "Remote schedule resolve returned empty scheduleId=" + scheduleId);
                  return;
                }

                runOnUiThread(
                    () -> {
                      upsertSyncedSchedule(remoteItem);
                      resourceCacheDirty = false;
                      action.apply(remoteItem);
                    });
              } catch (Exception ignored) {
                Log.w(TAG, "Remote schedule resolve failed scheduleId=" + scheduleId, ignored);
                // Keep the current screen unchanged if remote schedule fetch fails.
              }
            })
        .start();
  }

  protected void upsertSyncedSchedule(TvScheduleItem item) {
    if (item == null) {
      return;
    }

    for (int index = 0; index < syncedTodaySchedules.size(); index += 1) {
      TvScheduleItem current = syncedTodaySchedules.get(index);
      if (current != null && item.id.equals(current.id)) {
        syncedTodaySchedules.set(index, item);
        return;
      }
    }

    syncedTodaySchedules.add(item);
  }

  protected boolean matchesActiveSchedule(String scheduleId, int courseId) {
    if (activePlaybackItem == null) {
      return false;
    }
    if (scheduleId != null && !scheduleId.trim().isEmpty()) {
      return scheduleId.equals(activePlaybackItem.id);
    }
    return courseId > 0 && activePlaybackItem.courseId == courseId;
  }

  protected boolean matchesActiveSession(String playbackSessionId) {
    return TextUtils.isEmpty(playbackSessionId)
        || TextUtils.equals(playbackSessionId, activePlaybackSessionId);
  }

  protected long toEpochMs(java.time.LocalDateTime localDateTime) {
    if (localDateTime == null) {
      return 0L;
    }
    return localDateTime
        .atZone(java.time.ZoneId.of(ServerConfig.COURSE_TIME_ZONE))
        .toInstant()
        .toEpochMilli();
  }

  protected void renderPreviewState() {
    if (!previewMode || activePlaybackItem == null) {
      return;
    }

    CourseScript course = activePlaybackItem.course;
    if (course == null) {
      showPlaybackMessage("--", "PREVIEW", "当前课程没有可预览的课程脚本。");
      return;
    }

    currentCourseElapsedSeconds = 0;
    currentCourseTotalSeconds = Math.max(getCourseTotalSeconds(course), 0);
    currentTrainingElapsedSeconds = 0;
    currentTrainingTotalSeconds = Math.max(getTrainingTotalSeconds(course), 0);

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalPreviewState(course);
      return;
    }

    showVerticalPreviewState(course);
  }

  protected TrainingPlaybackState buildPreviewTrainingState(CourseScript course) {
    if (course == null || course.pods == null || course.pods.isEmpty()) {
      return null;
    }

    for (CourseScript.Pod pod : course.pods) {
      EffectivePodScreen effectiveScreen =
          materializePodScreen(pod, findVideoGroup(course, pod.videoGroupId), getDisplayScreenIndex());
      if (effectiveScreen == null
          || effectiveScreen.videoCards == null
          || effectiveScreen.videoCards.isEmpty()) {
        continue;
      }
      return buildPodRunningState(pod, effectiveScreen, 0);
    }
    return null;
  }

  protected long resolvePlaybackStartTime(TvScheduleItem item) {
    long nowElapsed = SystemClock.elapsedRealtime();
    if (item == null || item.startTime == null) {
      return nowElapsed;
    }

    // Horizontal info screens and future/past previews should start from 0s.
    if (!item.isLive) {
      return nowElapsed;
    }

    java.time.ZonedDateTime scheduledStart =
        item.startTime.atZone(java.time.ZoneId.of(ServerConfig.COURSE_TIME_ZONE));
    long scheduledEpochMs = scheduledStart.toInstant().toEpochMilli();
    long nowEpochMs = System.currentTimeMillis();
    if (scheduledEpochMs >= nowEpochMs) {
      return nowElapsed;
    }

    long deltaMs = nowEpochMs - scheduledEpochMs;
    return Math.max(nowElapsed - deltaMs, 0L);
  }

  protected void resetPlaybackStateCaches() {
    lastWaterfallIndex = -1;
    lastWaterfallWindowStart = -1;
    lastPlaybackMode = "";
    lastTrainingSignature = "";
    lastWaterfallSignature = "";
    horizontalRingProgressKey = "";
    horizontalRingTotalSeconds = 0;
  }

  protected void syncTodaySchedule(int screenNumber, boolean immediate) {
    if (syncInProgress) {
      return;
    }

    syncInProgress = true;
    scheduleList.removeAllViews();
    scheduleStateText.setVisibility(View.VISIBLE);
    scheduleStateText.setText(immediate ? "正在同步今日课程资源..." : "检测到课程更新，正在重新同步资源...");
    dispatchScreenHeartbeat(false);

    new Thread(
            () -> {
              try {
                TvScriptRepository.SyncResult result =
                    repository.syncTodayBundle(
                        (message, completed, total) ->
                            runOnUiThread(
                                () -> {
                                  if (!shouldApplyVerticalScreenUpdate(screenNumber)) {
                                    return;
                                  }
                                  scheduleStateText.setVisibility(View.VISIBLE);
                                  scheduleStateText.setText(buildSyncMessage(message, completed, total));
                                }));

                runOnUiThread(
                    () -> {
                      if (!shouldApplyVerticalScreenUpdate(screenNumber)) {
                        syncInProgress = false;
                        return;
                      }

                      syncInProgress = false;
                      currentBundleChecksum = result.checksum;
                      resourceCacheDirty = false;
                      lastScheduleSyncFailed = false;
                      bindScheduleItems(result.schedules);
                      dispatchScreenHeartbeat(false);
                      scheduleChecksumPolling();
                      requestCurrentPlaybackSession("vertical_sync_complete");
                    });
              } catch (Exception error) {
                Log.e(TAG, "Vertical schedule sync failed for screen " + screenNumber, error);
                runOnUiThread(
                    () -> {
                      if (!shouldApplyVerticalScreenUpdate(screenNumber)) {
                        syncInProgress = false;
                        return;
                      }

                      syncInProgress = false;
                      lastScheduleSyncFailed = true;
                      scheduleList.removeAllViews();
                      scheduleStateText.setVisibility(View.VISIBLE);
                      scheduleStateText.setText("同步课程资源失败，请检查网络后重试。");
                      dispatchScreenHeartbeat(false);
                      scheduleChecksumPolling();
                    });
              }
            })
        .start();
  }

  protected void requestTodayChecksumCheck(int screenNumber) {
    new Thread(
            () -> {
              try {
                TvScriptRepository.DailyChecksum checksum = repository.loadTodayChecksum();
                runOnUiThread(
                    () -> {
                      if (!shouldApplyScreenUpdate(screenNumber) || syncInProgress) {
                        scheduleChecksumPolling();
                        return;
                      }

                      if (currentBundleChecksum == null
                          || currentBundleChecksum.trim().isEmpty()
                          || !currentBundleChecksum.equals(checksum.checksum)) {
                        if (isVerticalCourseScreen(screenNumber)) {
                          syncTodaySchedule(screenNumber, false);
                        } else {
                          syncHorizontalCourse(screenNumber, false);
                        }
                        return;
                      }

                      scheduleChecksumPolling();
                    });
              } catch (Exception error) {
                runOnUiThread(
                    () -> {
                      if (!shouldApplyScreenUpdate(screenNumber)) {
                        return;
                      }
                      scheduleChecksumPolling();
                    });
              }
            })
        .start();
  }
}
