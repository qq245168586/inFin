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

abstract class MainActivityPart01 extends MainActivityBase {
  @Override

  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    deviceId = ensureDeviceId();
    activeAccountNamespace = readSavedAccountNamespace();
    int initialSavedScreenNumber = readSavedScreenNumber();
    Log.d(
        TAG,
        "Cleartext policy all="
            + NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted()
            + " domain="
            + NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("infintraining.work")
            + " ip="
            + NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("8.130.65.113"));
    repository = new TvScriptRepository(this);
    mqttManager =
        TvMqttManager.getInstance(
            deviceId,
            activeAccountNamespace,
            !TextUtils.isEmpty(activeAccountNamespace)
                && initialSavedScreenNumber >= 1
                && initialSavedScreenNumber <= 5,
            new TvMqttManager.Listener() {
              @Override
              public void onMqttConnected() {
                runOnUiThread(
                    () -> {
                      dispatchScreenHeartbeat(false);
                      if (selectorPanel != null
                          && selectorPanel.getVisibility() != View.VISIBLE
                          && (isVerticalCourseScreen(activeScreenNumber)
                              || isHorizontalInfoScreen(activeScreenNumber))) {
                        requestTodayChecksumCheck(activeScreenNumber);
                        requestCurrentPlaybackSession("mqtt_connected");
                      }
                    });
              }

              @Override
              public void onRefreshRequested() {
                runOnUiThread(
                    () -> {
                      if ((!isVerticalCourseScreen(activeScreenNumber)
                              && !isHorizontalInfoScreen(activeScreenNumber))
                          || selectorPanel == null
                          || selectorPanel.getVisibility() == View.VISIBLE
                          || syncInProgress) {
                        return;
                      }

                      requestTodayChecksumCheck(activeScreenNumber);
                    });
              }

              @Override
              public void onAssignScreenRequested(
                  String targetDeviceId, int screenNumber, String accountNamespace) {
                runOnUiThread(
                    () -> {
                      if (!deviceId.equalsIgnoreCase(targetDeviceId)
                          || screenNumber < 1
                          || screenNumber > 5) {
                        return;
                      }
                      if (!TextUtils.isEmpty(accountNamespace)) {
                        activeAccountNamespace = trimAccountNamespace(accountNamespace);
                        saveAccountNamespace(activeAccountNamespace);
                      } else {
                        activeAccountNamespace = "";
                        clearSavedAccountNamespace();
                      }
                      openScreen(screenNumber, true);
                    });
              }

              @Override
              public void onUnbindScreenRequested(String targetDeviceId) {
                runOnUiThread(
                    () -> {
                      if (!TextUtils.isEmpty(targetDeviceId) && !deviceId.equalsIgnoreCase(targetDeviceId)) {
                        return;
                      }
                      clearCurrentScreenBinding();
                    });
              }

              @Override
              public void onClearCacheRequested(String targetDeviceId) {
                runOnUiThread(() -> clearTvCacheFromRemote(targetDeviceId));
              }

              @Override
              public void onInstallAppUpdateRequested(
                  String targetDeviceId,
                  int screenNumber,
                  String packageId,
                  String version,
                  String downloadUrl,
                  String checksum) {
                runOnUiThread(
                    () ->
                        installAppUpdateFromRemote(
                            targetDeviceId, screenNumber, packageId, version, downloadUrl, checksum));
              }

              @Override
              public void onPreviewCourseRequested(
                  String scheduleId,
                  int courseId,
                  long scheduledStartAtMs,
                  String playbackSessionId,
                  String bundleChecksum) {
                runOnUiThread(
                    () ->
                        previewCourseFromRemote(
                            scheduleId,
                            courseId,
                            scheduledStartAtMs,
                            playbackSessionId,
                            bundleChecksum));
              }

              @Override
              public void onStartCourseRequested(
                  String scheduleId,
                  int courseId,
                  long scheduledStartAtMs,
                  long playbackStartAtMs,
                  String playbackSessionId,
                  String bundleChecksum) {
                runOnUiThread(
                    () ->
                        startCourseFromRemote(
                            scheduleId,
                            courseId,
                            scheduledStartAtMs,
                            playbackStartAtMs,
                            playbackSessionId,
                            bundleChecksum));
              }

              @Override
              public void onPauseCourseRequested(
                  String scheduleId, int courseId, long pausedAtMs, String playbackSessionId) {
                runOnUiThread(
                    () -> pauseCourseFromRemote(scheduleId, courseId, pausedAtMs, playbackSessionId));
              }

              @Override
              public void onResumeCourseRequested(
                  String scheduleId, int courseId, long resumedAtMs, String playbackSessionId) {
                runOnUiThread(
                    () ->
                        resumeCourseFromRemote(
                            scheduleId, courseId, resumedAtMs, playbackSessionId));
              }

              @Override
              public void onTerminateCourseRequested(
                  String scheduleId, int courseId, String playbackSessionId) {
                runOnUiThread(
                    () -> terminateCourseFromRemote(scheduleId, courseId, playbackSessionId));
              }

              @Override
              public void onPlaybackSessionUpdated(
                  String sessionId, int version, String state, long serverNowMs) {
                runOnUiThread(
                    () -> {
                      if (version > 0
                          && activePlaybackSessionVersion > 0
                          && version <= activePlaybackSessionVersion
                          && !TextUtils.isEmpty(sessionId)
                          && TextUtils.equals(sessionId, activePlaybackSessionId)) {
                        return;
                      }
                      requestCurrentPlaybackSession("mqtt_session_updated");
                    });
              }
            });
    mqttManager.connect();
    registerNetworkMonitoring();
    setContentView(R.layout.activity_main);

    selectorPanel = findViewById(R.id.selectorPanel);
    contentPanel = findViewById(R.id.contentPanel);
    contentTopBar = findViewById(R.id.contentTopBar);
    pageDividerRow = findViewById(R.id.pageDividerRow);
    verticalSchedulePanel = findViewById(R.id.verticalSchedulePanel);
    verticalPlaybackPanel = findViewById(R.id.verticalPlaybackPanel);
    horizontalPlaceholderPanel = findViewById(R.id.horizontalPlaceholderPanel);
    horizontalPlaybackPanel = findViewById(R.id.horizontalPlaybackPanel);
    getReadyPanel = findViewById(R.id.getReadyPanel);
    finishPanel = findViewById(R.id.finishPanel);
    updatePanel = findViewById(R.id.updatePanel);
    updateCard = findViewById(R.id.updateCard);
    playbackTimerCard = findViewById(R.id.playbackTimerCard);
    playbackStageCard = findViewById(R.id.playbackStageCard);
    scheduleScrollView = findViewById(R.id.scheduleScrollView);
    playbackScrollView = findViewById(R.id.playbackScrollView);
    playbackStatusGroup = findViewById(R.id.playbackStatusGroup);
    pageTitle = findViewById(R.id.pageTitle);
    pageSubtitle = findViewById(R.id.pageSubtitle);
    screenTag = findViewById(R.id.screenTag);
    screenDeviceMetaText = findViewById(R.id.screenDeviceMetaText);
    selectorDeviceIdText = findViewById(R.id.selectorDeviceIdText);
    selectorPairCodeText = findViewById(R.id.selectorPairCodeText);
    selectorPairHintText = findViewById(R.id.selectorPairHintText);
    selectorQrImage = findViewById(R.id.selectorQrImage);
    horizontalTitle = findViewById(R.id.horizontalTitle);
    horizontalCopy = findViewById(R.id.horizontalCopy);
    horizontalLoadingText = findViewById(R.id.horizontalLoadingText);
    horizontalScheduleScroll = findViewById(R.id.horizontalScheduleScroll);
    horizontalSchedulePanel = findViewById(R.id.horizontalSchedulePanel);
    horizontalScheduleTitle = findViewById(R.id.horizontalScheduleTitle);
    horizontalScheduleSubtitle = findViewById(R.id.horizontalScheduleSubtitle);
    horizontalScheduleList = findViewById(R.id.horizontalScheduleList);
    playbackCountdownText = findViewById(R.id.playbackCountdownText);
    playbackStageLabel = findViewById(R.id.playbackStageLabel);
    playbackStageProgress = findViewById(R.id.playbackStageProgress);
    playbackStageSecondary = findViewById(R.id.playbackStageSecondary);
    playbackStageDotsRow = findViewById(R.id.playbackStageDotsRow);
    horizontalContentPanel = findViewById(R.id.horizontalContentPanel);
    horizontalTransitionPanel = findViewById(R.id.horizontalTransitionPanel);
    transitionDesignPanel = findViewById(R.id.transitionDesignPanel);
    transitionDesignIcon = findViewById(R.id.transitionDesignIcon);
    transitionDesignRingContainer = findViewById(R.id.transitionDesignRingContainer);
    transitionDesignRing = findViewById(R.id.transitionDesignRing);
    transitionDesignCountdown = findViewById(R.id.transitionDesignCountdown);
    transitionDesignTitle = findViewById(R.id.transitionDesignTitle);
    transitionDesignSubtitle = findViewById(R.id.transitionDesignSubtitle);
    transitionDesignLogo = findViewById(R.id.transitionDesignLogo);
    horizontalRingContainer = findViewById(R.id.horizontalRingContainer);
    horizontalStateColumn = findViewById(R.id.horizontalStateColumn);
    horizontalTransitionCircle = findViewById(R.id.horizontalTransitionCircle);
    horizontalCountdownText = findViewById(R.id.horizontalCountdownText);
    horizontalRingProgress = findViewById(R.id.horizontalRingProgress);
    horizontalStateIcon = findViewById(R.id.horizontalStateIcon);
    horizontalStateText = findViewById(R.id.horizontalStateText);
    horizontalStateSecondary = findViewById(R.id.horizontalStateSecondary);
    horizontalStateDotsRow = findViewById(R.id.horizontalStateDotsRow);
    horizontalProgressRow = findViewById(R.id.horizontalProgressRow);
    horizontalLogoText = findViewById(R.id.horizontalLogoText);
    horizontalTransitionCountdownText = findViewById(R.id.horizontalTransitionCountdownText);
    horizontalTransitionTitle = findViewById(R.id.horizontalTransitionTitle);
    horizontalTransitionHint = findViewById(R.id.horizontalTransitionHint);
    horizontalTransitionIcon = findViewById(R.id.horizontalTransitionIcon);
    playbackHint = findViewById(R.id.playbackHint);
    getReadyCountdownText = findViewById(R.id.getReadyCountdownText);
    getReadyLabelText = findViewById(R.id.getReadyLabelText);
    getReadySubtext = findViewById(R.id.getReadySubtext);
    getReadyCircle = findViewById(R.id.getReadyCircle);
    finishFallbackText = findViewById(R.id.finishFallbackText);
    updateTitleText = findViewById(R.id.updateTitleText);
    updateVersionText = findViewById(R.id.updateVersionText);
    updateStatusText = findViewById(R.id.updateStatusText);
    updateProgressText = findViewById(R.id.updateProgressText);
    updateProgressBar = findViewById(R.id.updateProgressBar);
    updateActionRow = findViewById(R.id.updateActionRow);
    updateActionSpacer = findViewById(R.id.updateActionSpacer);
    updatePermissionButton = findViewById(R.id.updatePermissionButton);
    updateManualInstallButton = findViewById(R.id.updateManualInstallButton);
    scheduleStateText = findViewById(R.id.scheduleStateText);
    finishLogoImage = findViewById(R.id.finishLogoImage);
    scheduleList = findViewById(R.id.scheduleList);
    warmupRowsContainer = findViewById(R.id.warmupRowsContainer);
    trainingCardsContainer = findViewById(R.id.trainingCardsContainer);
    initCueSounds();

    View changeScreenButton = findViewById(R.id.changeScreenButton);
    if (changeScreenButton != null) {
      changeScreenButton.setVisibility(View.GONE);
      changeScreenButton.setOnClickListener(v -> showSelector());
    }
    if (updatePermissionButton != null) {
      updatePermissionButton.setOnClickListener(v -> openUnknownAppSourcesSettings());
    }
    if (updatePanel != null) {
      updatePanel.setOnClickListener(v -> tryManualInstallFromUpdateUi("panel"));
    }
    if (updateCard != null) {
      updateCard.setOnClickListener(v -> tryManualInstallFromUpdateUi("card"));
    }
    if (updateManualInstallButton != null) {
      updateManualInstallButton.setOnClickListener(v -> tryManualInstallFromUpdateUi("button"));
    }
    bindPreviewStartTapTargets();
    applyResponsiveLayout();
    updateDeviceMetaViews();

    if (!handleLaunchIntent()) {
      if (!TextUtils.isEmpty(activeAccountNamespace)
          && initialSavedScreenNumber >= 1
          && initialSavedScreenNumber <= 5) {
        openScreen(initialSavedScreenNumber, false);
      } else {
        showSelector();
      }
    }
  }

  @Override

  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleLaunchIntent();
  }

  @Override

  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    applyResponsiveLayout();
    if (activePlaybackItem != null) {
      if (previewMode) {
        renderPreviewState();
      } else {
        refreshPlayback();
      }
    }
  }

  protected boolean handleLaunchIntent() {
    if (getIntent() == null) {
      return false;
    }

    int requestedScreen = getIntent().getIntExtra(EXTRA_SCREEN_NUMBER, 0);
    if (requestedScreen < 1 || requestedScreen > 5) {
      return false;
    }

    launchAutoStartFirstSchedule =
        getIntent().getBooleanExtra(EXTRA_AUTO_START_FIRST_SCHEDULE, false);
    openScreen(requestedScreen, false);
    return true;
  }

  protected void bindScreenButton(int buttonId, int screenNumber) {
    Button button = findViewById(buttonId);
    button.setOnClickListener(v -> openScreen(screenNumber, true));
  }

  protected void bindPreviewStartTapTargets() {
    View.OnClickListener startListener =
        v -> {
          if (previewMode) {
            beginPreviewedCourse();
          }
        };

    contentPanel.setOnClickListener(startListener);
    verticalPlaybackPanel.setOnClickListener(startListener);
    playbackScrollView.setOnClickListener(startListener);
    warmupRowsContainer.setOnClickListener(startListener);
    trainingCardsContainer.setOnClickListener(startListener);
    horizontalPlaybackPanel.setOnClickListener(startListener);
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setOnClickListener(startListener);
    }
  }

  protected void openScreen(int screenNumber, boolean persistSelection) {
    activeScreenNumber = screenNumber;
    if (persistSelection) {
      saveScreenNumber(screenNumber);
    }
    if (mqttManager != null) {
      mqttManager.updateControlRouting(activeAccountNamespace, !TextUtils.isEmpty(activeAccountNamespace));
    }
    applyScreenOrientation(screenNumber);
    screenTag.setText("屏幕 " + screenNumber);
    updateDeviceMetaViews();
    selectorPanel.setVisibility(View.GONE);
    contentPanel.setVisibility(View.VISIBLE);
    contentPanel.post(this::applyResponsiveLayout);
    stopPairingPresence();
    dispatchScreenHeartbeat(true);
    scheduleScreenHeartbeat();

    if (isVerticalCourseScreen(screenNumber)) {
      renderVerticalSchedule(screenNumber);
    } else {
      renderHorizontalScreen(screenNumber);
    }
    requestCurrentPlaybackSession("open_screen");
  }
}
