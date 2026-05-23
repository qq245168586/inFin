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

abstract class MainActivityPart05 extends MainActivityPart04 {
  protected void applyCurrentPlaybackSession(
      TvScriptRepository.CurrentPlaybackSession result, String reason) {
    if (result == null || result.session == null) {
      return;
    }
    TvScriptRepository.PlaybackSessionSnapshot session = result.session;
    if (TextUtils.isEmpty(session.id)) {
      return;
    }
    if (activePlaybackSessionVersion > 0
        && session.version > 0
        && session.version <= activePlaybackSessionVersion
        && TextUtils.equals(session.id, activePlaybackSessionId)) {
      updateSessionClock(
          result.serverNowMs,
          result.requestStartedElapsedRealtimeMs,
          result.responseReceivedElapsedRealtimeMs);
      return;
    }

    Log.d(
        TAG,
        "Applying playback session reason="
            + reason
            + " id="
            + session.id
            + " version="
            + session.version
            + " state="
            + session.state);

    updateSessionClock(
        result.serverNowMs,
        result.requestStartedElapsedRealtimeMs,
        result.responseReceivedElapsedRealtimeMs);
    String state = session.state == null ? "" : session.state.toUpperCase(Locale.US);
    if ("PREVIEW".equals(state)
        && !previewMode
        && activePlaybackItem != null
        && TextUtils.equals(session.id, activePlaybackSessionId)
        && ("RUNNING".equals(activePlaybackSessionState) || "PAUSED".equals(activePlaybackSessionState))) {
      Log.d(TAG, "Ignoring stale PREVIEW session after active playback started id=" + session.id);
      return;
    }

    if ("TERMINATED".equals(state)) {
      if (TextUtils.equals(session.id, activePlaybackSessionId) || TextUtils.isEmpty(activePlaybackSessionId)) {
        applyPlaybackSessionFields(session);
        returnToScheduleListAfterFinish();
      }
      return;
    }

    if ("ENDED".equals(state)) {
      if (TextUtils.equals(session.id, activePlaybackSessionId) && activePlaybackItem != null) {
        applyPlaybackSessionFields(session);
        showFinishState();
        stopPlaybackLoop();
      }
      return;
    }

    resolveRemoteSchedule(
        session.scheduleId,
        session.courseId,
        0L,
        session.bundleChecksum,
        item -> applyPlaybackSessionToSchedule(item, session, result.serverNowMs));
  }

  protected void applyPlaybackSessionToSchedule(
      TvScheduleItem item, TvScriptRepository.PlaybackSessionSnapshot session, long serverNowMs) {
    if (item == null || session == null) {
      return;
    }
    hideCoursePlanPanel();
    if (sessionServerNowBaseMs <= 0L || sessionServerNowBaseElapsedRealtimeMs <= 0L) {
      updateSessionClock(serverNowMs);
    }
    applyPlaybackSessionFields(session);
    activePlaybackItem = item;
    activeBundleChecksum =
        !TextUtils.isEmpty(session.bundleChecksum) ? session.bundleChecksum : item.contentChecksum;
    resetAudioCueTracking();
    resetPlaybackStateCaches();

    String state = activePlaybackSessionState.toUpperCase(Locale.US);
    if ("PREVIEW".equals(state)) {
      previewMode = true;
      playbackPaused = false;
      playbackLoopRunning = false;
      playbackHandler.removeCallbacks(playbackTicker);
      renderPreviewState();
      dispatchScreenHeartbeat(false);
      return;
    }

    previewMode = false;
    playbackPaused = "PAUSED".equals(state);
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = currentSessionPlaybackElapsedMs();
    refreshPlayback();
    playbackHandler.removeCallbacks(playbackTicker);
    playbackLoopRunning = !playbackPaused;
    if (playbackLoopRunning) {
      playbackHandler.postDelayed(playbackTicker, nextPlaybackTickDelayMs());
    }
    dispatchScreenHeartbeat(false);
  }

  protected void updateSessionClock(long serverNowMs) {
    updateSessionClock(serverNowMs, 0L, 0L);
  }

  protected void updateSessionClock(
      long serverNowMs, long requestStartedElapsedRealtimeMs, long responseReceivedElapsedRealtimeMs) {
    if (serverNowMs <= 0L) {
      return;
    }
    long baseElapsedRealtimeMs = SystemClock.elapsedRealtime();
    if (responseReceivedElapsedRealtimeMs > 0L) {
      baseElapsedRealtimeMs = responseReceivedElapsedRealtimeMs;
      if (requestStartedElapsedRealtimeMs > 0L
          && responseReceivedElapsedRealtimeMs >= requestStartedElapsedRealtimeMs) {
        long roundTripMs = responseReceivedElapsedRealtimeMs - requestStartedElapsedRealtimeMs;
        long halfRoundTripMs = Math.min(Math.max(roundTripMs / 2L, 0L), 750L);
        baseElapsedRealtimeMs = responseReceivedElapsedRealtimeMs - halfRoundTripMs;
      }
    }
    sessionServerNowBaseMs = serverNowMs;
    sessionServerNowBaseElapsedRealtimeMs = baseElapsedRealtimeMs;
  }

  protected void applyPlaybackSessionFields(TvScriptRepository.PlaybackSessionSnapshot session) {
    activePlaybackSessionId = session.id;
    activePlaybackSessionVersion = Math.max(session.version, 0);
    activePlaybackSessionState = session.state == null ? "" : session.state.toUpperCase(Locale.US);
    sessionDrivenPlayback = true;
    sessionServerStartAtMs = Math.max(session.serverStartAtMs, 0L);
    sessionPausedAccumulatedMs = Math.max(session.pausedAccumulatedMs, 0L);
    sessionPausedAtMs = Math.max(session.pausedAtMs, 0L);
    sessionEndedAtMs = Math.max(session.endedAtMs, 0L);
    sessionTerminatedAtMs = Math.max(session.terminatedAtMs, 0L);
  }

  protected void clearPlaybackSessionTiming() {
    sessionServerNowBaseMs = 0L;
    sessionServerNowBaseElapsedRealtimeMs = 0L;
    sessionServerStartAtMs = 0L;
    sessionPausedAccumulatedMs = 0L;
    sessionPausedAtMs = 0L;
    sessionEndedAtMs = 0L;
    sessionTerminatedAtMs = 0L;
  }

  protected void stopScreenHeartbeat() {
    screenHeartbeatHandler.removeCallbacks(screenHeartbeatTicker);
  }

  protected void startPairingPresence() {
    stopPairingPresence();
    pairingPresenceHandler.post(pairingPresenceTicker);
  }

  protected void stopPairingPresence() {
    pairingPresenceHandler.removeCallbacks(pairingPresenceTicker);
  }

  protected String resolveAppVersion() {
    try {
      return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
    } catch (Exception ignored) {
      return "1.0.0";
    }
  }

  protected boolean isVerticalCourseScreen(int screenNumber) {
    return screenNumber == 1 || screenNumber == 3 || screenNumber == 5;
  }

  protected boolean isHorizontalInfoScreen(int screenNumber) {
    return screenNumber == 2 || screenNumber == 4;
  }

  protected void applyScreenOrientation(int screenNumber) {
    if (isVerticalCourseScreen(screenNumber)) {
      // Some TV boxes do not honor sensor-based orientation properly (especially when the
      // physical display is rotated). Force a deterministic orientation per "screen".
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
      return;
    }
    if (isHorizontalInfoScreen(screenNumber)) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
      return;
    }
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
  }

  protected int getDisplayScreenIndex() {
    if (activeScreenNumber == 1) {
      return 1;
    }
    if (activeScreenNumber == 3) {
      return 2;
    }
    if (activeScreenNumber == 5) {
      return 3;
    }
    return 1;
  }

  protected void renderVerticalSchedule(int screenNumber) {
    stopPlayback();
    applyResponsiveLayout();
    contentPanel.setBackgroundColor(getColor(R.color.tv_schedule_background));
    showScheduleChrome();
    showVerticalScheduleList();

    pageTitle.setText("今日课程表");
    pageSubtitle.setText(LocalDate.now().format(dateFormatter));
    scheduleStateText.setVisibility(View.VISIBLE);
    scheduleStateText.setText("正在同步今日课程资源...");
    scheduleList.removeAllViews();
    syncTodaySchedule(screenNumber, true);
  }

  protected void renderHorizontalScreen(int screenNumber) {
    stopChecksumPolling();
    stopPlayback();
    applyResponsiveLayout();
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    contentPanel.setPadding(0, 0, 0, 0);
    showHorizontalChrome();
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.VISIBLE);
      horizontalLoadingText.setText("正在同步今日课程资源...");
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
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    horizontalPlaybackPanel.setVisibility(View.VISIBLE);
    syncHorizontalCourse(screenNumber, true);
  }

  protected void showVerticalScheduleList() {
    scheduleScrollView.setVisibility(View.VISIBLE);
    verticalSchedulePanel.setVisibility(View.VISIBLE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
  }

  protected void bindScheduleItems(List<TvScheduleItem> scheduleItems) {
    scheduleList.removeAllViews();
    syncedTodaySchedules.clear();
    if (scheduleItems == null || scheduleItems.isEmpty()) {
      scheduleStateText.setVisibility(View.VISIBLE);
      scheduleStateText.setText("今天还没有排课。");
      launchAutoStartFirstSchedule = false;
      dispatchScreenHeartbeat(false);
      return;
    }
    syncedTodaySchedules.addAll(scheduleItems);

    if (launchAutoStartFirstSchedule) {
      launchAutoStartFirstSchedule = false;
      startCourse(scheduleItems.get(0));
      return;
    }

    scheduleStateText.setVisibility(View.GONE);
    dispatchScreenHeartbeat(false);
    for (TvScheduleItem item : scheduleItems) {
      scheduleList.addView(createVerticalScheduleCard(item));
    }
  }

  protected void startCourse(TvScheduleItem item) {
    startCourse(item, "", item == null ? "" : item.contentChecksum);
  }

  protected void startCourse(TvScheduleItem item, String playbackSessionId, String bundleChecksum) {
    if (syncInProgress) {
      if (isVerticalCourseScreen(activeScreenNumber)) {
        scheduleStateText.setVisibility(View.VISIBLE);
        scheduleStateText.setText("正在下载今日课程资源，请稍候进入课程。");
      } else if (horizontalLoadingText != null) {
        horizontalLoadingText.setVisibility(View.VISIBLE);
        horizontalLoadingText.setText("正在下载今日课程资源，请稍候进入课程。");
      }
      return;
    }

    stopPlayback();
    activePlaybackItem = item;
    previewMode = true;
    playbackPaused = false;
    playbackStartElapsedRealtimeMs = 0L;
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = 0L;
    activePlaybackSessionId = playbackSessionId == null ? "" : playbackSessionId;
    activePlaybackSessionVersion = 0;
    activePlaybackSessionState = "PREVIEW";
    sessionDrivenPlayback = false;
    clearPlaybackSessionTiming();
    activeBundleChecksum =
        !TextUtils.isEmpty(bundleChecksum)
            ? bundleChecksum
            : (item == null ? "" : item.contentChecksum);
    resetPlaybackStateCaches();

    if (isVerticalCourseScreen(activeScreenNumber)) {
      scheduleScrollView.setVisibility(View.GONE);
      verticalSchedulePanel.setVisibility(View.GONE);
      verticalPlaybackPanel.setVisibility(View.VISIBLE);
      horizontalPlaceholderPanel.setVisibility(View.GONE);
      if (horizontalPlaybackPanel != null) {
        horizontalPlaybackPanel.setVisibility(View.GONE);
      }
      contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
      showPlaybackChrome(true, false);
    } else {
      scheduleScrollView.setVisibility(View.GONE);
      verticalSchedulePanel.setVisibility(View.GONE);
      verticalPlaybackPanel.setVisibility(View.GONE);
      horizontalPlaceholderPanel.setVisibility(View.GONE);
      if (horizontalPlaybackPanel != null) {
        horizontalPlaybackPanel.setVisibility(View.VISIBLE);
      }
      showHorizontalChrome();
    }

    if (item.course == null) {
      showPlaybackMessage("--", "SCRIPT", "当前课程没有可播放的课程脚本。");
      return;
    }

    renderPreviewState();
    dispatchScreenHeartbeat(false);
  }

  protected void beginPreviewedCourse() {
    if (!previewMode || activePlaybackItem == null) {
      return;
    }

    if (TextUtils.isEmpty(activePlaybackSessionId)) {
      activePlaybackSessionId = "local-" + activePlaybackItem.id + "-" + System.currentTimeMillis();
    }
    if (TextUtils.isEmpty(activeBundleChecksum)) {
      activeBundleChecksum = activePlaybackItem.contentChecksum;
    }
    previewMode = false;
    playbackPaused = false;
    sessionDrivenPlayback = false;
    activePlaybackSessionVersion = 0;
    activePlaybackSessionState = "RUNNING";
    clearPlaybackSessionTiming();
    resetAudioCueTracking();
    playbackStartElapsedRealtimeMs = SystemClock.elapsedRealtime();
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

  protected void previewCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      String playbackSessionId,
      String bundleChecksum) {
    Log.d(
        TAG,
        "Remote preview requested scheduleId="
            + scheduleId
            + " courseId="
            + courseId
            + " session="
            + playbackSessionId
            + " checksum="
            + bundleChecksum
            + " sync="
            + syncInProgress);
    bringPlaybackUiToFront();
    hideCoursePlanPanel();
    if (syncInProgress) {
      requestCurrentPlaybackSession("preview_while_syncing");
      return;
    }
    resolveRemoteSchedule(
        scheduleId,
        courseId,
        scheduledStartAtMs,
        bundleChecksum,
        item -> {
          if (item != null) {
            startCourse(item, playbackSessionId, bundleChecksum);
          }
        });
  }
}
