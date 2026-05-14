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

abstract class MainActivityPart16 extends MainActivityPart15 {
  protected void prepareFinishContentLayout() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    if (finishPanel != null) {
      ViewGroup.LayoutParams rawParams = finishPanel.getLayoutParams();
      if (isHorizontalInfoScreen(activeScreenNumber)) {
        rawParams.width = ViewGroup.LayoutParams.MATCH_PARENT;
        rawParams.height = ViewGroup.LayoutParams.MATCH_PARENT;
        finishPanel.setLayoutParams(rawParams);
        finishPanel.setPadding(dp(48), dp(48), dp(48), dp(48));
      }
    }
    if (finishLogoImage != null) {
      finishLogoImage.setMaxWidth(
          isHorizontalInfoScreen(activeScreenNumber)
              ? clamp(Math.round(screenWidth * 0.46f), dp(360), dp(900))
              : clamp(Math.round(shortSide * 0.7f), dp(220), dp(560)));
      finishLogoImage.setMaxHeight(
          isHorizontalInfoScreen(activeScreenNumber)
              ? clamp(Math.round(screenHeight * 0.38f), dp(220), dp(460))
              : clamp(Math.round(shortSide * 0.38f), dp(120), dp(320)));
    }
    if (finishFallbackText != null) {
      finishFallbackText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          isHorizontalInfoScreen(activeScreenNumber)
              ? clampPx(shortSide * 0.09f, sp(46), sp(92))
              : clampPx(shortSide * 0.085f, sp(30), sp(52)));
      finishFallbackText.setGravity(android.view.Gravity.CENTER);
      finishFallbackText.setSingleLine(true);
      finishFallbackText.setMaxLines(1);
    }
  }

  protected int resolveFinishLogoTargetWidth() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    return isHorizontalInfoScreen(activeScreenNumber)
        ? clamp(Math.round(screenWidth * 0.46f), dp(360), dp(900))
        : clamp(Math.round(shortSide * 0.7f), dp(220), dp(560));
  }

  protected int resolveFinishLogoTargetHeight() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    return isHorizontalInfoScreen(activeScreenNumber)
        ? clamp(Math.round(screenHeight * 0.38f), dp(220), dp(460))
        : clamp(Math.round(shortSide * 0.38f), dp(120), dp(320));
  }

  protected void clearWaterfallRows() {
    for (WaterfallRowView row : waterfallRows) {
      stopWaterfallVideo(row);
    }
    waterfallRows.clear();
    warmupRowsContainer.removeAllViews();
    playbackScrollView.scrollTo(0, 0);
  }

  protected void stopPlaybackLoop() {
    playbackLoopRunning = false;
    playbackHandler.removeCallbacks(playbackTicker);
    resetPlaybackStateCaches();
  }

  protected void stopPlayback() {
    cancelFinishReturn();
    stopPlaybackLoop();
    resetAudioCueTracking();
    previewMode = false;
    playbackPaused = false;
    activePlaybackItem = null;
    playbackStartElapsedRealtimeMs = 0L;
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = 0L;
    activePlaybackSessionId = "";
    activePlaybackSessionVersion = 0;
    activePlaybackSessionState = "";
    sessionDrivenPlayback = false;
    clearPlaybackSessionTiming();
    activeBundleChecksum = "";
    currentCourseElapsedSeconds = 0;
    currentCourseTotalSeconds = 0;
    currentTrainingElapsedSeconds = 0;
    currentTrainingTotalSeconds = 0;
    scheduleScrollView.setVisibility(View.VISIBLE);
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    hideFinishPanel();
    playbackScrollView.setVisibility(View.VISIBLE);
    clearWaterfallRows();
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
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
    hideTransitionDesign();
    if (horizontalProgressRow != null) {
      horizontalProgressRow.removeAllViews();
    }
    configureVerticalPlaybackHeader(false);
    dispatchScreenHeartbeat(false);
  }

  protected int getWaterfallTotalSeconds(CourseScript.WaterfallSection section) {
    if (section == null || section.items == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.WaterfallItem item : section.items) {
      total += Math.max(item.seconds, 0);
    }
    return total;
  }

  @Override

  protected void onDestroy() {
    stopChecksumPolling();
    stopScreenHeartbeat();
    stopPairingPresence();
    stopPlayback();
    unregisterNetworkMonitoring();
    if (mqttManager != null) {
      mqttManager.disconnect();
    }
    releaseCueSounds();
    super.onDestroy();
  }

  protected int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
