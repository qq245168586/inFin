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
import com.infini.tv.component.vertical.WaterfallRowView;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import com.infini.tv.mvi.TvIntent;
import com.infini.tv.mvi.TvSurface;
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

abstract class MainActivitySettingsPlanController extends MainActivityCoursePlanController {
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
    hideCoursePlanPanel();
    dispatchIntent(
        new TvIntent.ShowSurface(
            isHorizontalInfoScreen(activeScreenNumber)
                ? TvSurface.HORIZONTAL_SCHEDULE
                : TvSurface.VERTICAL_SCHEDULE));
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

  protected void showSettingsHome() {
    if (settingsPanel == null || settingsContent == null || settingsTitle == null) {
      return;
    }
    dispatchIntent(new TvIntent.ShowSurface(TvSurface.SETTINGS));
    settingsPanel.setTag("home");
    settingsPanel.setVisibility(View.VISIBLE);
    settingsPanel.bringToFront();
    if (settingsButton != null) {
      settingsButton.setVisibility(View.GONE);
    }
    settingsTitle.setText("设置");
    settingsContent.removeAllViews();
    settingsContent.addView(
        createSettingsItem(
            "App 版本信息",
            "查看当前 TV App 版本和设备信息",
            v -> showAppVersionInfo()));
    settingsContent.addView(
        createSettingsItem(
            "App 版本列表",
            "从服务器选择一个版本下载并安装",
            v -> showAppPackageList()));
  }

  protected void handleSettingsBack() {
    if (settingsPanel == null || settingsPanel.getVisibility() != View.VISIBLE) {
      return;
    }
    Object tag = settingsPanel.getTag();
    if ("home".equals(tag)) {
      hideSettingsPanel();
      return;
    }
    showSettingsHome();
  }

  protected void hideSettingsPanel() {
    if (settingsPanel != null) {
      settingsPanel.setVisibility(View.GONE);
    }
    if (settingsButton != null) {
      settingsButton.setVisibility(View.VISIBLE);
      settingsButton.bringToFront();
    }
  }

  protected void showAppVersionInfo() {
    if (settingsPanel == null || settingsContent == null || settingsTitle == null) {
      return;
    }
    settingsPanel.setTag("version");
    settingsTitle.setText("App 版本信息");
    settingsContent.removeAllViews();
    settingsContent.addView(createSettingsInfoBlock("当前版本", resolveAppVersion()));
    settingsContent.addView(createSettingsInfoBlock("设备 ID", TextUtils.isEmpty(deviceId) ? "未生成" : deviceId));
    settingsContent.addView(
        createSettingsInfoBlock("屏幕", activeScreenNumber > 0 ? "屏幕 " + activeScreenNumber : "未绑定屏幕"));
    settingsContent.addView(
        createSettingsInfoBlock(
            "场馆",
            TextUtils.isEmpty(activeAccountNamespace) ? "未绑定场馆" : activeAccountNamespace));
  }

  protected void showAppPackageList() {
    if (settingsPanel == null || settingsContent == null || settingsTitle == null) {
      return;
    }
    settingsPanel.setTag("packages");
    settingsTitle.setText("App 版本列表");
    settingsContent.removeAllViews();
    settingsContent.addView(createSettingsInfoBlock("正在拉取版本列表", "请稍候..."));
    new Thread(
            () -> {
              try {
                List<TvScriptRepository.AppPackageInfo> packages = repository.listAppPackages();
                runOnUiThread(() -> renderAppPackageList(packages, null));
              } catch (Exception error) {
                runOnUiThread(() -> renderAppPackageList(new ArrayList<>(), error));
              }
            })
        .start();
  }

  protected void renderAppPackageList(List<TvScriptRepository.AppPackageInfo> packages, Exception error) {
    if (settingsContent == null) {
      return;
    }
    settingsContent.removeAllViews();
    if (error != null) {
      settingsContent.addView(createSettingsInfoBlock("版本列表加载失败", error.getMessage()));
      settingsContent.addView(createSettingsItem("重试", "重新从服务器拉取版本列表", v -> showAppPackageList()));
      return;
    }
    if (packages == null || packages.isEmpty()) {
      settingsContent.addView(createSettingsInfoBlock("暂无可安装版本", "服务器没有返回 TV App 安装包。"));
      return;
    }

    String currentVersion = resolveAppVersion();
    for (TvScriptRepository.AppPackageInfo appPackage : packages) {
      if (appPackage == null) {
        continue;
      }
      String title =
          (TextUtils.isEmpty(appPackage.label) ? "TV " + appPackage.version : appPackage.label)
              + (TextUtils.equals(currentVersion, appPackage.version) ? "  · 当前版本" : "");
      String subtitle =
          "版本 "
              + appPackage.version
              + "  ·  "
              + formatPackageSize(appPackage.sizeBytes)
              + (TextUtils.isEmpty(appPackage.updateTime) ? "" : "  ·  " + appPackage.updateTime);
      settingsContent.addView(createSettingsItem(title, subtitle, v -> installAppPackageFromSettings(appPackage)));
    }
  }

  protected void installAppPackageFromSettings(TvScriptRepository.AppPackageInfo appPackage) {
    if (appPackage == null || TextUtils.isEmpty(appPackage.downloadPath)) {
      if (settingsContent != null) {
        settingsContent.addView(createSettingsInfoBlock("无法安装", "这个版本没有下载地址。"));
      }
      return;
    }
    hideSettingsPanel();
    installAppUpdateFromRemote(
        deviceId,
        activeScreenNumber,
        appPackage.id,
        appPackage.version,
        appPackage.downloadPath,
        appPackage.checksum);
  }

  protected View createSettingsItem(String title, String subtitle, View.OnClickListener listener) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.VERTICAL);
    row.setClickable(true);
    row.setFocusable(true);
    row.setBackground(createCoursePlanCardBackground(0xCC120A24, 0x33F6D77A));
    row.setPadding(dp(22), dp(18), dp(22), dp(18));
    row.setOnClickListener(listener);
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    params.bottomMargin = dp(14);
    row.setLayoutParams(params);

    TextView titleView = new TextView(this);
    titleView.setText(title == null ? "" : title);
    titleView.setTextColor(getColor(R.color.tv_text_main));
    titleView.setTextSize(22f);
    titleView.setTypeface(titleView.getTypeface(), android.graphics.Typeface.BOLD);
    titleView.setSingleLine(true);
    titleView.setEllipsize(TextUtils.TruncateAt.END);
    row.addView(titleView);

    TextView subtitleView = new TextView(this);
    subtitleView.setText(subtitle == null ? "" : subtitle);
    subtitleView.setTextColor(getColor(R.color.tv_text_subtle));
    subtitleView.setTextSize(15f);
    subtitleView.setSingleLine(true);
    subtitleView.setEllipsize(TextUtils.TruncateAt.END);
    LinearLayout.LayoutParams subtitleParams =
        new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    subtitleParams.topMargin = dp(8);
    row.addView(subtitleView, subtitleParams);
    return row;
  }

  protected View createSettingsInfoBlock(String title, String value) {
    return createSettingsItem(title, value, v -> {});
  }

  protected String formatPackageSize(long sizeBytes) {
    if (sizeBytes <= 0L) {
      return "未知大小";
    }
    double megabytes = sizeBytes / 1024d / 1024d;
    return String.format(Locale.US, "%.1f MB", megabytes);
  }

  @Override
  public void onBackPressed() {
    if (settingsPanel != null && settingsPanel.getVisibility() == View.VISIBLE) {
      handleSettingsBack();
      return;
    }
    super.onBackPressed();
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
