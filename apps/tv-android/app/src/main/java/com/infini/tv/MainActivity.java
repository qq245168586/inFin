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
import android.graphics.BitmapFactory;
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
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import com.infini.tv.mqtt.TvMqttManager;
import com.infini.tv.repository.ServerConfig;
import com.infini.tv.repository.TvScriptRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
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

public class MainActivity extends AppCompatActivity {
  private static final String TAG = "InfiniTv";
  private static final String EXTRA_SCREEN_NUMBER = "screenNumber";
  private static final String EXTRA_AUTO_START_FIRST_SCHEDULE = "autoStartFirstSchedule";
  private static final long CHECKSUM_POLL_INTERVAL_MS = 5 * 60 * 1000L;
  private static final long SCREEN_HEARTBEAT_INTERVAL_MS = 15 * 1000L;
  private static final long FINISH_RETURN_DELAY_MS = 15 * 1000L;
  private static final int WARMUP_READY_SECONDS = 15;
  private static final int TRAINING_READY_SECONDS = 15;
  private static final int COOLDOWN_READY_SECONDS = 10;
  private static final float WATER_ICON_ASPECT_RATIO = 282f / 450f;
  private static final String PREFS_NAME = "infini_tv_app";
  private static final String PREF_DEVICE_ID = "device_id";
  private static final String PREF_SCREEN_NUMBER = "screen_number";
  private static final String PREF_ACCOUNT_NAMESPACE = "account_namespace";
  private static final String PREF_PAIR_TOKEN = "pair_token";
  private TvScriptRepository repository;
  private TvMqttManager mqttManager;
  private final DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
  private final DateTimeFormatter dateFormatter =
      DateTimeFormatter.ofPattern("yyyy.MM.dd  EEEE", Locale.CHINA);
  private final Handler playbackHandler = new Handler(Looper.getMainLooper());
  private final Handler syncHandler = new Handler(Looper.getMainLooper());
  private final Handler screenHeartbeatHandler = new Handler(Looper.getMainLooper());
  private ConnectivityManager connectivityManager;
  private ConnectivityManager.NetworkCallback networkCallback;
  private final Runnable playbackTicker =
      new Runnable() {
        @Override
        public void run() {
          if (!playbackLoopRunning) {
            return;
          }
          refreshPlayback();
          if (playbackLoopRunning) {
            playbackHandler.postDelayed(this, 400L);
          }
        }
      };
  private final Runnable finishReturnTicker =
      new Runnable() {
        @Override
        public void run() {
          returnToScheduleListAfterFinish();
        }
      };
  private final Runnable checksumTicker =
      new Runnable() {
        @Override
        public void run() {
          int screenNumber = activeScreenNumber;
          if ((!isVerticalCourseScreen(screenNumber) && !isHorizontalInfoScreen(screenNumber))
              || selectorPanel == null
              || selectorPanel.getVisibility() == View.VISIBLE) {
            return;
          }

          if (syncInProgress) {
            scheduleChecksumPolling();
            return;
          }

          requestTodayChecksumCheck(screenNumber);
        }
      };
  private final Runnable screenHeartbeatTicker =
      new Runnable() {
        @Override
        public void run() {
          dispatchScreenHeartbeat(false);
          scheduleScreenHeartbeat();
        }
      };

  private View selectorPanel;
  private LinearLayout contentPanel;
  private View contentTopBar;
  private View pageDividerRow;
  private View verticalSchedulePanel;
  private View verticalPlaybackPanel;
  private View horizontalPlaceholderPanel;
  private View horizontalPlaybackPanel;
  private View getReadyPanel;
  private View finishPanel;
  private View updatePanel;
  private View updateCard;
  private View playbackTimerCard;
  private View playbackStageCard;
  private ScrollView scheduleScrollView;
  private ScrollView playbackScrollView;
  private View playbackStatusGroup;
  private TextView pageTitle;
  private TextView pageSubtitle;
  private TextView screenTag;
  private TextView screenDeviceMetaText;
  private TextView selectorDeviceIdText;
  private TextView selectorPairCodeText;
  private TextView selectorPairHintText;
  private ImageView selectorQrImage;
  private TextView horizontalTitle;
  private TextView horizontalCopy;
  private TextView horizontalLoadingText;
  private ScrollView horizontalScheduleScroll;
  private View horizontalSchedulePanel;
  private TextView horizontalScheduleTitle;
  private TextView horizontalScheduleSubtitle;
  private LinearLayout horizontalScheduleList;
  private TextView playbackCountdownText;
  private TextView playbackStageLabel;
  private TextView playbackStageProgress;
  private TextView playbackStageSecondary;
  private LinearLayout playbackStageDotsRow;
  private View horizontalContentPanel;
  private View horizontalTransitionPanel;
  private TextView horizontalCountdownText;
  private TextView horizontalStateText;
  private TextView horizontalStateSecondary;
  private LinearLayout horizontalStateDotsRow;
  private LinearLayout horizontalProgressRow;
  private TextView horizontalTransitionCountdownText;
  private TextView horizontalTransitionTitle;
  private TextView horizontalTransitionHint;
  private ImageView horizontalTransitionIcon;
  private TextView playbackHint;
  private TextView getReadyCountdownText;
  private TextView getReadyLabelText;
  private TextView getReadySubtext;
  private TextView finishFallbackText;
  private TextView updateTitleText;
  private TextView updateVersionText;
  private TextView updateStatusText;
  private TextView updateProgressText;
  private TextView scheduleStateText;
  private ImageView finishLogoImage;
  private ProgressBar updateProgressBar;
  private View updateActionRow;
  private View updateActionSpacer;
  private Button updatePermissionButton;
  private Button updateManualInstallButton;
  private LinearLayout scheduleList;
  private LinearLayout warmupRowsContainer;
  private LinearLayout trainingCardsContainer;
  private final List<WaterfallRowView> waterfallRows = new ArrayList<>();
  private int activeScreenNumber = 0;
  private boolean launchAutoStartFirstSchedule = false;
  private TvScheduleItem activePlaybackItem;
  private int lastWaterfallIndex = -1;
  private int lastWaterfallWindowStart = -1;
  private String lastPlaybackMode = "";
  private String lastTrainingSignature = "";
  private String lastWaterfallSignature = "";
  private String finishLogoRequestKey = "";
  private String currentBundleChecksum = "";
  private String deviceId = "";
  private String activeAccountNamespace = "";
  private String currentPairToken = "";
  private boolean syncInProgress = false;
  private boolean lastScheduleSyncFailed = false;
  private boolean resourceCacheDirty = false;
  private long lastNetworkRecoverySyncAtMs = 0L;
  private volatile boolean screenHeartbeatInFlight = false;
  private boolean previewMode = false;
  private boolean playbackPaused = false;
  private long playbackStartElapsedRealtimeMs = 0L;
  private long accumulatedPauseElapsedRealtimeMs = 0L;
  private long pauseStartedElapsedRealtimeMs = 0L;
  private long frozenElapsedMs = 0L;
  private String activePlaybackSessionId = "";
  private String activeBundleChecksum = "";
  private String currentUpdateState = "IDLE";
  private String currentUpdateTargetVersion = "";
  private int currentUpdateProgressPercent = 0;
  private String currentUpdateMessage = "";
  private File lastDownloadedUpdateApkFile;
  private String lastDownloadedUpdateVersion = "";
  private int currentCourseElapsedSeconds = 0;
  private int currentCourseTotalSeconds = 0;
  private int currentTrainingElapsedSeconds = 0;
  private int currentTrainingTotalSeconds = 0;
  private boolean playbackLoopRunning = false;
  private final List<TvScheduleItem> syncedTodaySchedules = new ArrayList<>();
  private SoundPool cueSoundPool;
  private final Set<Integer> loadedCueSoundIds = new HashSet<>();
  private int warmCueSoundId = 0;
  private int coolCueSoundId = 0;
  private int dingCueSoundId = 0;
  private int endCueSoundId = 0;
  private String lastWaterfallAudioMode = "";
  private int lastWaterfallAudioIndex = -1;
  private String lastTrainingAudioRenderKey = "";
  private String lastTrainingAudioPhase = "";
  private boolean finishCuePlayed = false;

  private interface RemoteScheduleAction {
    void apply(TvScheduleItem item);
  }

  private static class SilentInstallResult {
    final boolean success;
    final String commandLabel;
    final int exitCode;
    final String output;

    SilentInstallResult(boolean success, String commandLabel, int exitCode, String output) {
      this.success = success;
      this.commandLabel = commandLabel == null ? "" : commandLabel;
      this.exitCode = exitCode;
      this.output = output == null ? "" : output;
    }
  }

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
        new TvMqttManager(
            buildMqttClientId(deviceId),
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
                      if (!deviceId.equalsIgnoreCase(targetDeviceId)) {
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
    horizontalCountdownText = findViewById(R.id.horizontalCountdownText);
    horizontalStateText = findViewById(R.id.horizontalStateText);
    horizontalStateSecondary = findViewById(R.id.horizontalStateSecondary);
    horizontalStateDotsRow = findViewById(R.id.horizontalStateDotsRow);
    horizontalProgressRow = findViewById(R.id.horizontalProgressRow);
    horizontalTransitionCountdownText = findViewById(R.id.horizontalTransitionCountdownText);
    horizontalTransitionTitle = findViewById(R.id.horizontalTransitionTitle);
    horizontalTransitionHint = findViewById(R.id.horizontalTransitionHint);
    horizontalTransitionIcon = findViewById(R.id.horizontalTransitionIcon);
    playbackHint = findViewById(R.id.playbackHint);
    getReadyCountdownText = findViewById(R.id.getReadyCountdownText);
    getReadyLabelText = findViewById(R.id.getReadyLabelText);
    getReadySubtext = findViewById(R.id.getReadySubtext);
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

    findViewById(R.id.changeScreenButton).setOnClickListener(v -> showSelector());
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
    if (!handleLaunchIntent()) {
      showSelector();
    }
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

  private boolean handleLaunchIntent() {
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

  private void bindScreenButton(int buttonId, int screenNumber) {
    Button button = findViewById(buttonId);
    button.setOnClickListener(v -> openScreen(screenNumber, true));
  }

  private void bindPreviewStartTapTargets() {
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

  private void openScreen(int screenNumber, boolean persistSelection) {
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
    dispatchScreenHeartbeat(true);
    scheduleScreenHeartbeat();

    if (isVerticalCourseScreen(screenNumber)) {
      renderVerticalSchedule(screenNumber);
    } else {
      renderHorizontalScreen(screenNumber);
    }
  }

  private void showSelector() {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    stopChecksumPolling();
    stopPlayback();
    activeScreenNumber = 0;
    activeAccountNamespace = "";
    clearSavedAccountNamespace();
    saveScreenNumber(0);
    ensurePairToken();
    if (mqttManager != null) {
      mqttManager.updateControlRouting("", false);
    }
    applyResponsiveLayout();
    updateDeviceMetaViews();
    updateSelectorPairingUi();
    selectorPanel.setVisibility(View.VISIBLE);
    contentPanel.setVisibility(View.GONE);
    dispatchScreenHeartbeat(false);
    scheduleScreenHeartbeat();
  }

  private SharedPreferences getAppPreferences() {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
  }

  private String readSavedAccountNamespace() {
    return trimAccountNamespace(getAppPreferences().getString(PREF_ACCOUNT_NAMESPACE, ""));
  }

  private void saveAccountNamespace(String accountNamespace) {
    getAppPreferences()
        .edit()
        .putString(PREF_ACCOUNT_NAMESPACE, trimAccountNamespace(accountNamespace))
        .apply();
  }

  private void clearSavedAccountNamespace() {
    getAppPreferences().edit().remove(PREF_ACCOUNT_NAMESPACE).apply();
  }

  private String ensureDeviceId() {
    SharedPreferences preferences = getAppPreferences();
    String existing = preferences.getString(PREF_DEVICE_ID, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated = "TV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.US);
    preferences.edit().putString(PREF_DEVICE_ID, generated).apply();
    return generated;
  }

  private String buildMqttClientId(String currentDeviceId) {
    String compact = (currentDeviceId == null ? "" : currentDeviceId).replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.US);
    return compact.isEmpty() ? "tv-unknown" : "tv-" + compact;
  }

  private String trimAccountNamespace(String accountNamespace) {
    return accountNamespace == null ? "" : accountNamespace.trim().toLowerCase(Locale.US);
  }

  private int readSavedScreenNumber() {
    return getAppPreferences().getInt(PREF_SCREEN_NUMBER, 0);
  }

  private void saveScreenNumber(int screenNumber) {
    getAppPreferences().edit().putInt(PREF_SCREEN_NUMBER, screenNumber).apply();
  }

  private void clearCurrentScreenBinding() {
    clearSavedAccountNamespace();
    saveScreenNumber(0);
    activeAccountNamespace = "";
    currentPairToken = readOrCreatePairToken();
    showSelector();
  }

  private void updateDeviceMetaViews() {
    String mqttClientId = mqttManager != null ? mqttManager.getClientId() : buildMqttClientId(deviceId);
    String appVersion = resolveAppVersion();
    if (selectorDeviceIdText != null) {
      selectorDeviceIdText.setText("设备 ID  " + deviceId + "  ·  MQTT " + mqttClientId);
    }
    if (selectorPairCodeText != null) {
      selectorPairCodeText.setText(currentPairToken.isEmpty() ? "--" : currentPairToken);
    }
    if (screenDeviceMetaText != null) {
      screenDeviceMetaText.setText(deviceId + "  ·  v" + (appVersion == null || appVersion.trim().isEmpty() ? "unknown" : appVersion));
    }
  }

  private void ensurePairToken() {
    if (!TextUtils.isEmpty(currentPairToken)) {
      return;
    }
    currentPairToken = readOrCreatePairToken();
  }

  private String readOrCreatePairToken() {
    SharedPreferences preferences = getAppPreferences();
    String existing = preferences.getString(PREF_PAIR_TOKEN, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated =
        UUID.randomUUID()
            .toString()
            .replace("-", "")
            .substring(0, 8)
            .toUpperCase(Locale.US);
    preferences.edit().putString(PREF_PAIR_TOKEN, generated).apply();
    return generated;
  }

  private String buildPairingPayload() {
    ensurePairToken();
    return "infini-tv://pair?deviceId=" + Uri.encode(deviceId) + "&pairToken=" + Uri.encode(currentPairToken);
  }

  private void updateSelectorPairingUi() {
    ensurePairToken();
    if (selectorPairHintText != null) {
      selectorPairHintText.setText("请在 Coach 端扫码并选择屏幕 1 / 2 / 3 / 4 / 5 完成绑定");
    }
    if (selectorQrImage != null) {
      selectorQrImage.setImageBitmap(createPairingQrBitmap(buildPairingPayload(), dpToPx(260)));
    }
  }

  private Bitmap createPairingQrBitmap(String content, int sizePx) {
    try {
      Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
      hints.put(EncodeHintType.MARGIN, 1);
      BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints);
      Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
      for (int x = 0; x < sizePx; x += 1) {
        for (int y = 0; y < sizePx; y += 1) {
          bitmap.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
        }
      }
      return bitmap;
    } catch (WriterException error) {
      Log.w(TAG, "Failed to render pairing QR code", error);
      Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
      bitmap.eraseColor(Color.WHITE);
      return bitmap;
    }
  }

  private int dpToPx(int valueDp) {
    return Math.round(
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, valueDp, getResources().getDisplayMetrics()));
  }

  private void setUpdateUiState(
      String state,
      String targetVersion,
      int progressPercent,
      String message,
      boolean visible) {
    currentUpdateState = state == null || state.trim().isEmpty() ? "IDLE" : state.trim().toUpperCase(Locale.US);
    currentUpdateTargetVersion = targetVersion == null ? "" : targetVersion.trim();
    currentUpdateProgressPercent = Math.max(0, Math.min(progressPercent, 100));
    currentUpdateMessage = message == null ? "" : message.trim();

    if (updatePanel != null) {
      updatePanel.setVisibility(visible ? View.VISIBLE : View.GONE);
    }
    if (updateTitleText != null) {
      updateTitleText.setText("TV 正在准备更新");
    }
    if (updateVersionText != null) {
      updateVersionText.setText(
          currentUpdateTargetVersion.isEmpty() ? "版本信息待确认" : "目标版本 " + currentUpdateTargetVersion);
    }
    if (updateStatusText != null) {
      updateStatusText.setText(currentUpdateMessage.isEmpty() ? "请稍候..." : currentUpdateMessage);
    }
    if (updateProgressBar != null) {
      updateProgressBar.setProgress(currentUpdateProgressPercent);
    }
    if (updateProgressText != null) {
      updateProgressText.setText(currentUpdateProgressPercent + "%");
    }
    refreshUpdateActionButtons(visible);
    dispatchScreenHeartbeat(false);
  }

  private void clearUpdateUiState() {
    lastDownloadedUpdateApkFile = null;
    lastDownloadedUpdateVersion = "";
    setUpdateUiState("IDLE", "", 0, "", false);
  }

  private void refreshUpdateActionButtons(boolean panelVisible) {
    boolean canShowManualInstall =
        panelVisible
            && lastDownloadedUpdateApkFile != null
            && lastDownloadedUpdateApkFile.exists()
            && ("DOWNLOADED".equals(currentUpdateState)
                || "INSTALLING".equals(currentUpdateState)
                || "ERROR".equals(currentUpdateState));
    boolean needsInstallPermission =
        panelVisible
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getPackageManager().canRequestPackageInstalls();

    if (updatePermissionButton != null) {
      updatePermissionButton.setVisibility(needsInstallPermission ? View.VISIBLE : View.GONE);
    }
    if (updateManualInstallButton != null) {
      updateManualInstallButton.setVisibility(canShowManualInstall ? View.VISIBLE : View.GONE);
    }
    if (updateActionSpacer != null) {
      updateActionSpacer.setVisibility(
          needsInstallPermission && canShowManualInstall ? View.VISIBLE : View.GONE);
    }
    if (updateActionRow != null) {
      updateActionRow.setVisibility((needsInstallPermission || canShowManualInstall) ? View.VISIBLE : View.GONE);
    }
  }

  private void installAppUpdateFromRemote(
      String targetDeviceId,
      int screenNumber,
      String packageId,
      String version,
      String downloadUrl,
      String checksum) {
    Log.d(
        TAG,
        "install_app_update received targetDeviceId="
            + targetDeviceId
            + ", localDeviceId="
            + deviceId
            + ", targetScreen="
            + screenNumber
            + ", activeScreen="
            + activeScreenNumber
            + ", packageId="
            + packageId
            + ", version="
            + version
            + ", downloadUrl="
            + downloadUrl);

    if (targetDeviceId == null || !deviceId.equalsIgnoreCase(targetDeviceId)) {
      Log.d(TAG, "Ignoring install_app_update because deviceId does not match.");
      return;
    }

    if (screenNumber >= 1 && activeScreenNumber >= 1 && screenNumber != activeScreenNumber) {
      Log.w(
          TAG,
          "install_app_update screen mismatch detected, but proceeding because deviceId matched. targetScreen="
              + screenNumber
              + ", activeScreen="
              + activeScreenNumber);
    }

    stopPlayback();
    stopChecksumPolling();
    previewMode = false;
    setUpdateUiState("DOWNLOADING", version, 0, "正在下载更新包...", true);

    new Thread(
            () -> {
              try {
                Log.d(
                    TAG,
                    "Starting package download. packageId="
                        + packageId
                        + ", version="
                        + version
                        + ", downloadUrl="
                        + downloadUrl
                        + ", checksum="
                        + checksum);
                File apkFile =
                    repository.downloadAppPackage(
                        packageId,
                        version,
                        downloadUrl,
                        checksum,
                        (message, progressPercent) ->
                            runOnUiThread(
                                () ->
                                    setUpdateUiState(
                                        "DOWNLOADING", version, progressPercent, message, true)));

                lastDownloadedUpdateApkFile = apkFile;
                lastDownloadedUpdateVersion = version == null ? "" : version;
                Log.d(
                    TAG,
                    "Package download completed. file="
                        + apkFile.getAbsolutePath()
                        + ", size="
                        + apkFile.length());

                runOnUiThread(
                    () -> {
                      setUpdateUiState("DOWNLOADED", version, 100, "下载完成，准备安装...", true);
                      installDownloadedApk(apkFile, version);
                    });
              } catch (Exception error) {
                Log.e(TAG, "Package download failed", error);
                runOnUiThread(
                    () ->
                        setUpdateUiState(
                            "ERROR",
                            version,
                            currentUpdateProgressPercent,
                            error.getMessage() == null ? "安装包下载失败。" : error.getMessage(),
                            true));
              }
            })
        .start();
  }

  private void installDownloadedApk(File apkFile, String version) {
    if (apkFile == null || !apkFile.exists()) {
      setUpdateUiState("ERROR", version, currentUpdateProgressPercent, "安装包不存在，请重新下载。", true);
      return;
    }

    Log.d(
        TAG,
        "installDownloadedApk called. version="
            + version
            + ", file="
            + apkFile.getAbsolutePath()
            + ", size="
            + apkFile.length());
    setUpdateUiState("INSTALLING", version, 100, "正在尝试静默安装更新...", true);
    new Thread(
            () -> {
              SilentInstallResult silentResult = trySilentRootInstall(apkFile);
              runOnUiThread(
                  () -> {
                    if (silentResult.success) {
                      Log.d(
                          TAG,
                          "Silent install succeeded via "
                              + silentResult.commandLabel
                              + ": "
                              + silentResult.output);
                      setUpdateUiState("INSTALLED", version, 100, "静默安装完成，正在重启应用...", true);
                      relaunchSelfAfterSilentInstall();
                      return;
                    }

                    Log.w(
                        TAG,
                        "Silent install unavailable. lastCommand="
                            + silentResult.commandLabel
                            + ", exit="
                            + silentResult.exitCode
                            + ", output="
                            + silentResult.output);
                    setUpdateUiState("INSTALLING", version, 100, "静默安装不可用，正在打开系统安装器...", true);
                    launchApkInstaller(apkFile, version);
                  });
            })
        .start();
  }

  private SilentInstallResult trySilentRootInstall(File apkFile) {
    String sourcePath = apkFile.getAbsolutePath();
    String stagedPath = "/data/local/tmp/infini-tv-update.apk";
    List<String[]> fallbackCommands = new ArrayList<>();
    fallbackCommands.add(new String[] {"pm", "install", "-r", stagedPath});
    String[][] rootSpecs = {
      {"/system/xbin/su", "0"},
      {"/system/bin/su", "0"},
      {"su", "0"},
      {"/system/xbin/su", "root"},
      {"/system/bin/su", "root"},
      {"su", "root"}
    };

    SilentInstallResult lastResult =
        new SilentInstallResult(false, "root install not attempted", -1, "");

    for (String[] rootSpec : rootSpecs) {
      SilentInstallResult copyResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "cp", sourcePath, stagedPath});
      lastResult = copyResult;
      if (copyResult.exitCode != 0) {
        continue;
      }

      SilentInstallResult chmodResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "chmod", "644", stagedPath});
      lastResult = chmodResult;
      if (chmodResult.exitCode != 0) {
        continue;
      }

      SilentInstallResult installResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "pm", "install", "-r", stagedPath});
      lastResult = installResult;
      if (installResult.success) {
        return installResult;
      }
    }

    String directInstallCommand = "pm install -r " + shellQuote(sourcePath);
    fallbackCommands.add(new String[] {"/system/xbin/su", "-c", directInstallCommand});
    fallbackCommands.add(new String[] {"/system/bin/su", "-c", directInstallCommand});
    fallbackCommands.add(new String[] {"su", "-c", directInstallCommand});

    for (String[] command : fallbackCommands) {
      SilentInstallResult result = runSilentInstallCommand(command);
      lastResult = result;
      if (result.success) {
        return result;
      }
    }

    return lastResult;
  }

  private SilentInstallResult runSilentInstallCommand(String[] command) {
    String commandLabel = joinCommandForLog(command);
    Process process = null;
    try {
      Log.d(TAG, "Trying silent install command: " + commandLabel);
      process = new ProcessBuilder(command).redirectErrorStream(true).start();
      boolean completed = process.waitFor(90, TimeUnit.SECONDS);
      String output = readProcessOutput(process);
      if (!completed) {
        process.destroy();
        return new SilentInstallResult(false, commandLabel, -2, "命令超时。" + output);
      }

      int exitCode = process.exitValue();
      boolean success = exitCode == 0 && output.toLowerCase(Locale.US).contains("success");
      return new SilentInstallResult(success, commandLabel, exitCode, output);
    } catch (Exception error) {
      return new SilentInstallResult(
          false,
          commandLabel,
          -1,
          error.getClass().getSimpleName() + ": " + (error.getMessage() == null ? "" : error.getMessage()));
    } finally {
      if (process != null) {
        process.destroy();
      }
    }
  }

  private String readProcessOutput(Process process) {
    if (process == null) {
      return "";
    }
    StringBuilder output = new StringBuilder();
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(process.getInputStream()))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (output.length() > 0) {
          output.append('\n');
        }
        output.append(line);
      }
    } catch (Exception error) {
      if (output.length() > 0) {
        output.append('\n');
      }
      output.append("读取安装输出失败: ").append(error.getMessage());
    }
    return output.toString();
  }

  private String shellQuote(String value) {
    if (value == null) {
      return "''";
    }
    return "'" + value.replace("'", "'\\''") + "'";
  }

  private String joinCommandForLog(String[] command) {
    if (command == null || command.length == 0) {
      return "";
    }
    StringBuilder label = new StringBuilder();
    for (String part : command) {
      if (label.length() > 0) {
        label.append(' ');
      }
      label.append(part);
    }
    return label.toString();
  }

  private void relaunchSelfAfterSilentInstall() {
    playbackHandler.postDelayed(
        () -> {
          Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
          if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(launchIntent);
          }
          finish();
          Runtime.getRuntime().exit(0);
        },
        1500L);
  }

  private void launchApkInstaller(File apkFile, String version) {
    try {
      Log.d(
          TAG,
          "Preparing installer launch. version="
              + version
              + ", file="
              + (apkFile == null ? "<null>" : apkFile.getAbsolutePath()));
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          && !getPackageManager().canRequestPackageInstalls()) {
        setUpdateUiState(
            "ERROR",
            version,
            currentUpdateProgressPercent,
            "请先允许此应用安装未知来源应用，然后点击下方按钮继续安装。",
            true);
        openUnknownAppSourcesSettings();
        return;
      }

      Uri apkUri =
          FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
      Intent intent = buildPackageInstallerIntent(apkUri);
      Log.d(TAG, "Starting installer intent: " + intent);

      setUpdateUiState("INSTALLING", version, 100, "已打开安装器，请完成更新安装。", true);
      startActivity(intent);
    } catch (Exception error) {
      Log.e(TAG, "Failed to launch installer", error);
      setUpdateUiState(
          "ERROR",
          version,
          currentUpdateProgressPercent,
          "无法打开系统安装器，请检查盒子安装权限。",
          true);
    }
  }

  private void tryManualInstallFromUpdateUi(String source) {
    Log.d(
        TAG,
        "Manual install requested from "
            + source
            + ", state="
            + currentUpdateState
            + ", version="
            + currentUpdateTargetVersion
            + ", file="
            + (lastDownloadedUpdateApkFile == null
                ? "<null>"
                : lastDownloadedUpdateApkFile.getAbsolutePath()));
    if (lastDownloadedUpdateApkFile == null || !lastDownloadedUpdateApkFile.exists()) {
      setUpdateUiState(
          "ERROR",
          currentUpdateTargetVersion,
          currentUpdateProgressPercent,
          "当前没有可安装的更新包，请先重新下载更新。",
          true);
      return;
    }
    installDownloadedApk(lastDownloadedUpdateApkFile, lastDownloadedUpdateVersion);
  }

  private void initCueSounds() {
    AudioAttributes audioAttributes =
        new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    cueSoundPool =
        new SoundPool.Builder().setMaxStreams(2).setAudioAttributes(audioAttributes).build();
    cueSoundPool.setOnLoadCompleteListener(
        (soundPool, sampleId, status) -> {
          if (status == 0) {
            loadedCueSoundIds.add(sampleId);
          } else {
            Log.w(TAG, "Failed to load cue sound sampleId=" + sampleId + ", status=" + status);
          }
        });
    warmCueSoundId = cueSoundPool.load(this, R.raw.warm, 1);
    coolCueSoundId = cueSoundPool.load(this, R.raw.cool, 1);
    dingCueSoundId = cueSoundPool.load(this, R.raw.ding, 1);
    endCueSoundId = cueSoundPool.load(this, R.raw.end, 1);
  }

  private void releaseCueSounds() {
    loadedCueSoundIds.clear();
    warmCueSoundId = 0;
    coolCueSoundId = 0;
    dingCueSoundId = 0;
    endCueSoundId = 0;
    if (cueSoundPool != null) {
      cueSoundPool.release();
      cueSoundPool = null;
    }
  }

  private void playCueSound(CueSound cueSound) {
    if (cueSoundPool == null || cueSound == null) {
      return;
    }
    int sampleId = 0;
    switch (cueSound) {
      case WARM:
        sampleId = warmCueSoundId;
        break;
      case COOL:
        sampleId = coolCueSoundId;
        break;
      case DING:
        sampleId = dingCueSoundId;
        break;
      case END:
        sampleId = endCueSoundId;
        break;
      default:
        break;
    }
    if (sampleId <= 0 || !loadedCueSoundIds.contains(sampleId)) {
      return;
    }
    cueSoundPool.play(sampleId, 1f, 1f, 1, 0, 1f);
  }

  private void resetAudioCueTracking() {
    lastWaterfallAudioMode = "";
    lastWaterfallAudioIndex = -1;
    lastTrainingAudioRenderKey = "";
    lastTrainingAudioPhase = "";
    finishCuePlayed = false;
  }

  private void scheduleFinishReturn() {
    playbackHandler.removeCallbacks(finishReturnTicker);
    playbackHandler.postDelayed(finishReturnTicker, FINISH_RETURN_DELAY_MS);
  }

  private void cancelFinishReturn() {
    playbackHandler.removeCallbacks(finishReturnTicker);
  }

  private void maybePlayWaterfallCue(String modeKey, int currentIndex) {
    if (!"WARMUP".equals(modeKey) && !"COOLDOWN".equals(modeKey)) {
      lastWaterfallAudioMode = modeKey == null ? "" : modeKey;
      lastWaterfallAudioIndex = currentIndex;
      return;
    }
    if (!safeEquals(lastWaterfallAudioMode, modeKey)) {
      lastWaterfallAudioMode = modeKey;
      lastWaterfallAudioIndex = currentIndex;
      return;
    }
    if (currentIndex != lastWaterfallAudioIndex && lastWaterfallAudioIndex >= 0) {
      playCueSound("COOLDOWN".equals(modeKey) ? CueSound.COOL : CueSound.WARM);
    }
    lastWaterfallAudioMode = modeKey;
    lastWaterfallAudioIndex = currentIndex;
  }

  private void maybePlayTrainingCue(TrainingPlaybackState state) {
    if (state == null) {
      lastTrainingAudioRenderKey = "";
      lastTrainingAudioPhase = "";
      return;
    }
    String currentRenderKey = state.renderKey == null ? "" : state.renderKey;
    String currentPhase = resolveTrainingCuePhase(state);
    if (!TextUtils.isEmpty(lastTrainingAudioRenderKey)
        && !safeEquals(lastTrainingAudioRenderKey, currentRenderKey)
        && ("WORK".equals(lastTrainingAudioPhase) || "REST".equals(lastTrainingAudioPhase))) {
      playCueSound(CueSound.DING);
    }
    lastTrainingAudioRenderKey = currentRenderKey;
    lastTrainingAudioPhase = currentPhase;
  }

  private String resolveTrainingCuePhase(TrainingPlaybackState state) {
    if (state == null || state.stageProgress == null) {
      return "";
    }
    String progress = state.stageProgress.trim().toUpperCase(Locale.US);
    if ("WORK".equals(progress)) {
      return "WORK";
    }
    if ("REST".equals(progress)) {
      return "REST";
    }
    return "";
  }

  private void openUnknownAppSourcesSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    Intent settingsIntent =
        new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            .setData(Uri.parse("package:" + getPackageName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(settingsIntent);
  }

  private Intent buildPackageInstallerIntent(Uri apkUri) {
    PackageManager packageManager = getPackageManager();
    ClipData apkClipData = ClipData.newRawUri("tv-apk", apkUri);

    Intent installIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
    installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
    installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    installIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
    installIntent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
    installIntent.setClipData(apkClipData);

    Intent viewIntent = new Intent(Intent.ACTION_VIEW);
    viewIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
    viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    viewIntent.setClipData(apkClipData);

    List<Intent> candidates = new ArrayList<>();
    appendKnownInstallerCandidates(candidates, apkUri, installIntent, true);
    appendKnownInstallerCandidates(candidates, apkUri, viewIntent, false);

    ResolveInfo packageInstallerActivity = resolvePreferredInstaller(packageManager, installIntent);
    if (packageInstallerActivity != null && packageInstallerActivity.activityInfo != null) {
      Intent explicitInstallIntent = new Intent(installIntent);
      String packageName = packageInstallerActivity.activityInfo.packageName;
      grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
      explicitInstallIntent.setComponent(
          new ComponentName(packageName, packageInstallerActivity.activityInfo.name));
      candidates.add(explicitInstallIntent);
    }

    ResolveInfo viewInstallerActivity = resolvePreferredInstaller(packageManager, viewIntent);
    if (viewInstallerActivity != null && viewInstallerActivity.activityInfo != null) {
      Intent explicitViewIntent = new Intent(viewIntent);
      String packageName = viewInstallerActivity.activityInfo.packageName;
      grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
      explicitViewIntent.setComponent(
          new ComponentName(packageName, viewInstallerActivity.activityInfo.name));
      candidates.add(explicitViewIntent);
    }

    candidates.add(installIntent);
    candidates.add(viewIntent);

    for (Intent candidate : candidates) {
      ResolveInfo resolved = packageManager.resolveActivity(candidate, PackageManager.MATCH_DEFAULT_ONLY);
      if (candidate.getComponent() != null || resolved != null) {
        Log.d(TAG, "Using installer intent: " + candidate);
        return candidate;
      }
    }

    throw new IllegalStateException("当前设备没有可用的系统安装器。");
  }

  private void appendKnownInstallerCandidates(
      List<Intent> candidates, Uri apkUri, Intent baseIntent, boolean installAction) {
    String[][] knownComponents = {
      {"com.google.android.packageinstaller", "com.android.packageinstaller.InstallStart"},
      {"com.google.android.packageinstaller", "com.android.packageinstaller.PackageInstallerActivity"},
      {"com.android.packageinstaller", "com.android.packageinstaller.InstallStart"},
      {"com.android.packageinstaller", "com.android.packageinstaller.PackageInstallerActivity"}
    };

    for (String[] component : knownComponents) {
      Intent explicitIntent = new Intent(baseIntent);
      explicitIntent.setComponent(new ComponentName(component[0], component[1]));
      grantUriPermission(component[0], apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
      if (installAction) {
        explicitIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        explicitIntent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
      }
      candidates.add(explicitIntent);
    }
  }

  private ResolveInfo resolvePreferredInstaller(PackageManager packageManager, Intent intent) {
    List<ResolveInfo> candidates =
        packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
    if (candidates == null || candidates.isEmpty()) {
      candidates = packageManager.queryIntentActivities(intent, 0);
    }
    if (candidates == null || candidates.isEmpty()) {
      return null;
    }

    ResolveInfo fallback = null;
    for (ResolveInfo candidate : candidates) {
      if (candidate == null || candidate.activityInfo == null) {
        continue;
      }
      String packageName = candidate.activityInfo.packageName;
      if (TextUtils.isEmpty(packageName)) {
        continue;
      }
      if (fallback == null) {
        fallback = candidate;
      }
      if (packageName.equals("com.google.android.packageinstaller")
          || packageName.equals("com.android.packageinstaller")) {
        return candidate;
      }
    }
    return fallback;
  }

  private String currentPlaybackState() {
    if (syncInProgress) {
      return "SYNCING";
    }
    if (previewMode) {
      return "PREVIEW";
    }
    if (playbackPaused) {
      return "PAUSED";
    }
    if (activePlaybackItem != null) {
      return "RUNNING";
    }
    return "IDLE";
  }

  private long resolveElapsedRealtimeForWallClock(long wallClockMs) {
    long nowElapsedRealtime = SystemClock.elapsedRealtime();
    if (wallClockMs <= 0L) {
      return nowElapsedRealtime;
    }
    return nowElapsedRealtime + (wallClockMs - System.currentTimeMillis());
  }

  private long currentPlaybackElapsedMs() {
    if (activePlaybackItem == null || previewMode) {
      return 0L;
    }
    if (playbackPaused) {
      return Math.max(frozenElapsedMs, 0L);
    }
    return Math.max(
        SystemClock.elapsedRealtime()
            - playbackStartElapsedRealtimeMs
            - accumulatedPauseElapsedRealtimeMs,
        0L);
  }

  private void dispatchScreenHeartbeat(boolean bind) {
    if (screenHeartbeatInFlight
        || (bind && (activeScreenNumber < 1 || activeScreenNumber > 5))) {
      return;
    }

    final String heartbeatAccountNamespace = activeAccountNamespace;
    final String heartbeatDeviceId = deviceId;
    final int heartbeatScreenNumber =
        activeScreenNumber >= 1 && activeScreenNumber <= 5
            ? activeScreenNumber
            : Math.max(0, readSavedScreenNumber());
    final String heartbeatPairToken = TextUtils.isEmpty(activeAccountNamespace) ? currentPairToken : "";
    final String heartbeatClientId = mqttManager != null ? mqttManager.getClientId() : buildMqttClientId(deviceId);
    final String heartbeatAppVersion = resolveAppVersion();
    final String heartbeatPlaybackState = currentPlaybackState();
    final String heartbeatScheduleId = activePlaybackItem != null ? activePlaybackItem.id : "";
    final boolean heartbeatPreviewMode = previewMode;
    final String heartbeatPlaybackSessionId = activePlaybackSessionId;
    final String heartbeatBundleChecksum = activeBundleChecksum;
    final long heartbeatPlaybackElapsedMs = currentPlaybackElapsedMs();
    final String heartbeatUpdateState = currentUpdateState;
    final String heartbeatUpdateTargetVersion = currentUpdateTargetVersion;
    final int heartbeatUpdateProgressPercent = currentUpdateProgressPercent;
    final String heartbeatUpdateMessage = currentUpdateMessage;
    screenHeartbeatInFlight = true;
    Log.d(
        TAG,
        "Dispatching "
            + (bind ? "bind" : "heartbeat")
            + " for "
            + heartbeatDeviceId
            + " screen="
            + heartbeatScreenNumber
            + " namespace="
            + heartbeatAccountNamespace
            + " pair="
            + heartbeatPairToken);

    new Thread(
            () -> {
              try {
                TvScriptRepository.ScreenRegistration registration;
                if (bind) {
                  registration = repository.bindScreen(
                      heartbeatAccountNamespace,
                      heartbeatDeviceId,
                      heartbeatScreenNumber,
                      heartbeatPairToken,
                      heartbeatClientId,
                      heartbeatAppVersion,
                      heartbeatPlaybackState,
                      heartbeatScheduleId,
                      heartbeatPreviewMode,
                      heartbeatPlaybackSessionId,
                      heartbeatBundleChecksum,
                      heartbeatPlaybackElapsedMs,
                      heartbeatUpdateState,
                      heartbeatUpdateTargetVersion,
                      heartbeatUpdateProgressPercent,
                      heartbeatUpdateMessage);
                } else {
                  registration = repository.sendScreenHeartbeat(
                      heartbeatAccountNamespace,
                      heartbeatDeviceId,
                      heartbeatScreenNumber,
                      heartbeatPairToken,
                      heartbeatClientId,
                      heartbeatAppVersion,
                      heartbeatPlaybackState,
                      heartbeatScheduleId,
                      heartbeatPreviewMode,
                      heartbeatPlaybackSessionId,
                      heartbeatBundleChecksum,
                      heartbeatPlaybackElapsedMs,
                      heartbeatUpdateState,
                      heartbeatUpdateTargetVersion,
                      heartbeatUpdateProgressPercent,
                      heartbeatUpdateMessage);
                }
                if (registration != null) {
                  Log.d(
                      TAG,
                      "Screen sync ok device="
                          + registration.deviceId
                          + " screen="
                          + registration.screenNumber
                          + " namespace="
                          + registration.accountNamespace
                          + " online="
                          + registration.online);
                  runOnUiThread(() -> syncBindingFromServer(registration));
                }
              } catch (Exception error) {
                Log.w(TAG, "Screen heartbeat failed", error);
              } finally {
                screenHeartbeatInFlight = false;
              }
            })
        .start();
  }

  private void registerNetworkMonitoring() {
    connectivityManager = getSystemService(ConnectivityManager.class);
    if (connectivityManager == null) {
      return;
    }

    networkCallback =
        new ConnectivityManager.NetworkCallback() {
          @Override
          public void onAvailable(Network network) {
            runOnUiThread(
                () -> {
                  Log.d(TAG, "Network available, requesting MQTT/API resync");
                  if (mqttManager != null) {
                    mqttManager.connect();
                  }
                  dispatchScreenHeartbeat(false);
                  requestNetworkRecoverySync();
                });
          }

          @Override
          public void onCapabilitiesChanged(Network network, NetworkCapabilities networkCapabilities) {
            if (networkCapabilities == null
                || !networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
              return;
            }
            runOnUiThread(
                () -> {
                  Log.d(TAG, "Network capabilities updated, requesting MQTT/API resync");
                  if (mqttManager != null) {
                    mqttManager.connect();
                  }
                  dispatchScreenHeartbeat(false);
                  requestNetworkRecoverySync();
                });
          }
        };

    NetworkRequest request =
        new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
    connectivityManager.registerNetworkCallback(request, networkCallback);
  }

  private void unregisterNetworkMonitoring() {
    if (connectivityManager == null || networkCallback == null) {
      return;
    }
    try {
      connectivityManager.unregisterNetworkCallback(networkCallback);
    } catch (Exception ignored) {
      // Ignore cleanup issues.
    }
    networkCallback = null;
  }

  private void scheduleScreenHeartbeat() {
    stopScreenHeartbeat();
    screenHeartbeatHandler.postDelayed(screenHeartbeatTicker, SCREEN_HEARTBEAT_INTERVAL_MS);
  }

  private void syncBindingFromServer(TvScriptRepository.ScreenRegistration registration) {
    if (registration == null || !deviceId.equalsIgnoreCase(registration.deviceId)) {
      return;
    }

    String serverNamespace = trimAccountNamespace(registration.accountNamespace);
    int serverScreenNumber = registration.screenNumber;
    if (TextUtils.isEmpty(serverNamespace) || serverScreenNumber < 1 || serverScreenNumber > 5) {
      return;
    }

    boolean accountChanged = !serverNamespace.equals(activeAccountNamespace);
    boolean screenChanged = activeScreenNumber != serverScreenNumber || readSavedScreenNumber() != serverScreenNumber;
    if (!accountChanged && !screenChanged && selectorPanel != null && selectorPanel.getVisibility() != View.VISIBLE) {
      return;
    }

    activeAccountNamespace = serverNamespace;
    saveAccountNamespace(activeAccountNamespace);
    saveScreenNumber(serverScreenNumber);
    openScreen(serverScreenNumber, false);
  }

  private void stopScreenHeartbeat() {
    screenHeartbeatHandler.removeCallbacks(screenHeartbeatTicker);
  }

  private String resolveAppVersion() {
    try {
      return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
    } catch (Exception ignored) {
      return "1.0.0";
    }
  }

  private boolean isVerticalCourseScreen(int screenNumber) {
    return screenNumber == 1 || screenNumber == 3 || screenNumber == 5;
  }

  private boolean isHorizontalInfoScreen(int screenNumber) {
    return screenNumber == 2 || screenNumber == 4;
  }

  private void applyScreenOrientation(int screenNumber) {
    if (isVerticalCourseScreen(screenNumber)) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
      return;
    }
    if (isHorizontalInfoScreen(screenNumber)) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
      return;
    }
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
  }

  private int getDisplayScreenIndex() {
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

  private void renderVerticalSchedule(int screenNumber) {
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

  private void renderHorizontalScreen(int screenNumber) {
    stopChecksumPolling();
    stopPlayback();
    applyResponsiveLayout();
    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
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

  private void showVerticalScheduleList() {
    scheduleScrollView.setVisibility(View.VISIBLE);
    verticalSchedulePanel.setVisibility(View.VISIBLE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
  }

  private void bindScheduleItems(List<TvScheduleItem> scheduleItems) {
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

  private void startCourse(TvScheduleItem item) {
    startCourse(item, "", item == null ? "" : item.contentChecksum);
  }

  private void startCourse(TvScheduleItem item, String playbackSessionId, String bundleChecksum) {
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

  private void beginPreviewedCourse() {
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
    resetAudioCueTracking();
    playbackStartElapsedRealtimeMs = SystemClock.elapsedRealtime();
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = 0L;
    resetPlaybackStateCaches();
    refreshPlayback();
    playbackLoopRunning = true;
    playbackHandler.removeCallbacks(playbackTicker);
    playbackHandler.postDelayed(playbackTicker, 400L);
    dispatchScreenHeartbeat(false);
  }

  private void previewCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      String playbackSessionId,
      String bundleChecksum) {
    if (syncInProgress) {
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

  private void startCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      long playbackStartAtMs,
      String playbackSessionId,
      String bundleChecksum) {
    if (syncInProgress) {
      return;
    }
    resolveRemoteSchedule(
        scheduleId,
        courseId,
        scheduledStartAtMs,
        bundleChecksum,
        item -> {
          if (item == null) {
            return;
          }

          if (activePlaybackItem == null
              || !activePlaybackItem.id.equals(item.id)
              || !previewMode
              || !TextUtils.equals(activePlaybackSessionId, playbackSessionId)
              || !TextUtils.equals(activeBundleChecksum, bundleChecksum)) {
            startCourse(item, playbackSessionId, bundleChecksum);
          }

          activePlaybackSessionId = playbackSessionId == null ? "" : playbackSessionId;
          activeBundleChecksum =
              !TextUtils.isEmpty(bundleChecksum) ? bundleChecksum : item.contentChecksum;
          previewMode = false;
          playbackPaused = false;
          resetAudioCueTracking();
          playbackStartElapsedRealtimeMs =
              resolveElapsedRealtimeForWallClock(
                  playbackStartAtMs > 0 ? playbackStartAtMs : System.currentTimeMillis());
          accumulatedPauseElapsedRealtimeMs = 0L;
          pauseStartedElapsedRealtimeMs = 0L;
          frozenElapsedMs = 0L;
          resetPlaybackStateCaches();
          refreshPlayback();
          playbackLoopRunning = true;
          playbackHandler.removeCallbacks(playbackTicker);
          playbackHandler.postDelayed(playbackTicker, 400L);
          dispatchScreenHeartbeat(false);
        });
  }

  private void pauseCourseFromRemote(
      String scheduleId, int courseId, long pausedAtMs, String playbackSessionId) {
    if (previewMode
        || activePlaybackItem == null
        || !matchesActiveSchedule(scheduleId, courseId)
        || !matchesActiveSession(playbackSessionId)) {
      return;
    }
    if (playbackPaused) {
      return;
    }

    long effectivePauseAt =
        resolveElapsedRealtimeForWallClock(pausedAtMs > 0 ? pausedAtMs : System.currentTimeMillis());
    frozenElapsedMs =
        Math.max(
            effectivePauseAt - playbackStartElapsedRealtimeMs - accumulatedPauseElapsedRealtimeMs,
            0L);
    playbackPaused = true;
    pauseStartedElapsedRealtimeMs = effectivePauseAt;
    refreshPlayback();
    playbackHandler.removeCallbacks(playbackTicker);
    dispatchScreenHeartbeat(false);
  }

  private void resumeCourseFromRemote(
      String scheduleId, int courseId, long resumedAtMs, String playbackSessionId) {
    if (previewMode
        || activePlaybackItem == null
        || !matchesActiveSchedule(scheduleId, courseId)
        || !matchesActiveSession(playbackSessionId)) {
      return;
    }
    if (!playbackPaused) {
      return;
    }

    long effectiveResumeAt =
        resolveElapsedRealtimeForWallClock(
            resumedAtMs > 0 ? resumedAtMs : System.currentTimeMillis());
    if (pauseStartedElapsedRealtimeMs > 0 && effectiveResumeAt > pauseStartedElapsedRealtimeMs) {
      accumulatedPauseElapsedRealtimeMs += (effectiveResumeAt - pauseStartedElapsedRealtimeMs);
    }
    playbackPaused = false;
    pauseStartedElapsedRealtimeMs = 0L;
    refreshPlayback();
    playbackHandler.removeCallbacks(playbackTicker);
    playbackHandler.postDelayed(playbackTicker, 400L);
    dispatchScreenHeartbeat(false);
  }

  private void terminateCourseFromRemote(
      String scheduleId, int courseId, String playbackSessionId) {
    if (activePlaybackItem == null
        || !matchesActiveSchedule(scheduleId, courseId)
        || !matchesActiveSession(playbackSessionId)) {
      return;
    }

    if (isVerticalCourseScreen(activeScreenNumber)) {
      renderVerticalSchedule(activeScreenNumber);
      return;
    }
    renderHorizontalScreen(activeScreenNumber);
  }

  private TvScheduleItem findSyncedSchedule(String scheduleId, int courseId, long scheduledStartAtMs) {
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

  private void resolveRemoteSchedule(
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
      return;
    }

    new Thread(
            () -> {
              try {
                TvScheduleItem remoteItem = repository.loadScheduleById(scheduleId);
                if (remoteItem == null) {
                  return;
                }

                runOnUiThread(
                    () -> {
                      upsertSyncedSchedule(remoteItem);
                      resourceCacheDirty = false;
                      action.apply(remoteItem);
                    });
              } catch (Exception ignored) {
                // Keep the current screen unchanged if remote schedule fetch fails.
              }
            })
        .start();
  }

  private void upsertSyncedSchedule(TvScheduleItem item) {
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

  private boolean matchesActiveSchedule(String scheduleId, int courseId) {
    if (activePlaybackItem == null) {
      return false;
    }
    if (scheduleId != null && !scheduleId.trim().isEmpty()) {
      return scheduleId.equals(activePlaybackItem.id);
    }
    return courseId > 0 && activePlaybackItem.courseId == courseId;
  }

  private boolean matchesActiveSession(String playbackSessionId) {
    return TextUtils.isEmpty(playbackSessionId)
        || TextUtils.equals(playbackSessionId, activePlaybackSessionId);
  }

  private long toEpochMs(java.time.LocalDateTime localDateTime) {
    if (localDateTime == null) {
      return 0L;
    }
    return localDateTime
        .atZone(java.time.ZoneId.of(ServerConfig.COURSE_TIME_ZONE))
        .toInstant()
        .toEpochMilli();
  }

  private void renderPreviewState() {
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

  private TrainingPlaybackState buildPreviewTrainingState(CourseScript course) {
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

  private long resolvePlaybackStartTime(TvScheduleItem item) {
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

  private void resetPlaybackStateCaches() {
    lastWaterfallIndex = -1;
    lastWaterfallWindowStart = -1;
    lastPlaybackMode = "";
    lastTrainingSignature = "";
    lastWaterfallSignature = "";
  }

  private void syncTodaySchedule(int screenNumber, boolean immediate) {
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

  private void requestTodayChecksumCheck(int screenNumber) {
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

  private void clearTvCacheFromRemote(String targetDeviceId) {
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

  private void scheduleChecksumPolling() {
    syncHandler.removeCallbacks(checksumTicker);
    syncHandler.postDelayed(checksumTicker, CHECKSUM_POLL_INTERVAL_MS);
  }

  private void stopChecksumPolling() {
    syncHandler.removeCallbacks(checksumTicker);
  }

  private boolean shouldApplyScreenUpdate(int screenNumber) {
    return activeScreenNumber == screenNumber && selectorPanel.getVisibility() != View.VISIBLE;
  }

  private boolean shouldApplyVerticalScreenUpdate(int screenNumber) {
    return shouldApplyScreenUpdate(screenNumber) && isVerticalCourseScreen(screenNumber);
  }

  private boolean shouldApplyHorizontalScreenUpdate(int screenNumber) {
    return shouldApplyScreenUpdate(screenNumber) && isHorizontalInfoScreen(screenNumber);
  }

  private void requestNetworkRecoverySync() {
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

  private String buildSyncMessage(String message, int completed, int total) {
    if (total <= 0) {
      return message;
    }

    int percent = Math.round((completed * 100f) / total);
    return message + "\n同步进度 " + completed + "/" + total + " · " + percent + "%";
  }

  private void showScheduleChrome() {
    contentTopBar.setVisibility(View.VISIBLE);
    pageTitle.setVisibility(View.VISIBLE);
    pageSubtitle.setVisibility(View.VISIBLE);
    pageDividerRow.setVisibility(View.VISIBLE);
  }

  private void showHorizontalChrome() {
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

  private void showPlaybackChrome(boolean showCountdown, boolean showHint) {
    contentTopBar.setVisibility(View.GONE);
    pageTitle.setVisibility(View.GONE);
    pageSubtitle.setVisibility(View.GONE);
    pageDividerRow.setVisibility(View.GONE);
    playbackStatusGroup.setVisibility(showCountdown ? View.VISIBLE : View.GONE);
    playbackHint.setVisibility(showHint ? View.VISIBLE : View.GONE);
  }

  private View createScheduleCard(TvScheduleItem item) {
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = dp(20);
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(28), dp(28), dp(28), dp(28));
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
    logo.setTextColor(getColor(R.color.tv_text_main));
    logo.setTextSize(16f);
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
    name.setTextSize(22f);
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
    time.setTextColor(getColor(R.color.tv_text_main));
    time.setTextSize(18f);
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
    badge.setBackgroundResource(R.drawable.bg_today_badge);
    badge.setPadding(dp(18), dp(10), dp(18), dp(10));
    badge.setText(item.isLive ? "今日课" : "待开始");
    badge.setTextColor(getColor(R.color.tv_text_main));
    badge.setTextSize(16f);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    card.addView(badge);

    return card;
  }

  private View createVerticalScheduleCard(TvScheduleItem item) {
    FrameLayout card = new FrameLayout(this);
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    cardParams.topMargin = dp(18);
    card.setLayoutParams(cardParams);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(20), dp(20), dp(20), dp(20));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(android.view.Gravity.CENTER_VERTICAL);
    card.addView(row);

    TextView logo = new TextView(this);
    LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(72), dp(72));
    logo.setLayoutParams(logoParams);
    logo.setBackgroundResource(R.drawable.bg_logo_panel);
    logo.setText(item.logoText);
    logo.setTextColor(getColor(R.color.tv_text_main));
    logo.setTextSize(11f);
    logo.setLineSpacing(0f, 0.9f);
    logo.setGravity(android.view.Gravity.CENTER);
    row.addView(logo);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(16);
    contentParams.rightMargin = dp(72);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    row.addView(content);

    TextView name = new TextView(this);
    String versionSuffix =
        item.version == null || item.version.trim().isEmpty() ? "" : " (" + item.version + ")";
    name.setText(item.courseName + versionSuffix);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(18f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(2);
    name.setEllipsize(TextUtils.TruncateAt.END);
    content.addView(name);

    TextView time = new TextView(this);
    LinearLayout.LayoutParams timeParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    timeParams.topMargin = dp(10);
    time.setLayoutParams(timeParams);
    time.setText("◷  " + formatTimeRange(item));
    time.setTextColor(getColor(R.color.tv_text_main));
    time.setTextSize(14f);
    time.setTypeface(time.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(time);

    TextView badge = new TextView(this);
    FrameLayout.LayoutParams badgeParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.gravity = android.view.Gravity.END | android.view.Gravity.TOP;
    badge.setLayoutParams(badgeParams);
    badge.setBackgroundResource(R.drawable.bg_today_badge);
    badge.setPadding(dp(14), dp(8), dp(14), dp(8));
    badge.setText(item.isLive ? "今日课" : "待开始");
    badge.setTextColor(getColor(R.color.tv_text_main));
    badge.setTextSize(12f);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    card.addView(badge);

    return card;
  }

  private View createHorizontalScheduleCard(TvScheduleItem item) {
    FrameLayout card = new FrameLayout(this);
    card.setBackgroundResource(R.drawable.bg_schedule_card);
    card.setPadding(dp(18), dp(18), dp(18), dp(18));
    card.setClickable(true);
    card.setFocusable(true);
    card.setOnClickListener(v -> startCourse(item));

    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(android.view.Gravity.CENTER_VERTICAL);
    card.addView(row);

    TextView logo = new TextView(this);
    LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(68), dp(68));
    logo.setLayoutParams(logoParams);
    logo.setBackgroundResource(R.drawable.bg_logo_panel);
    logo.setText(item.logoText);
    logo.setTextColor(getColor(R.color.tv_text_main));
    logo.setTextSize(10f);
    logo.setLineSpacing(0f, 0.9f);
    logo.setGravity(android.view.Gravity.CENTER);
    row.addView(logo);

    LinearLayout content = new LinearLayout(this);
    LinearLayout.LayoutParams contentParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    contentParams.leftMargin = dp(14);
    contentParams.rightMargin = dp(68);
    content.setLayoutParams(contentParams);
    content.setOrientation(LinearLayout.VERTICAL);
    row.addView(content);

    TextView name = new TextView(this);
    String versionSuffix =
        item.version == null || item.version.trim().isEmpty() ? "" : " (" + item.version + ")";
    name.setText(item.courseName + versionSuffix);
    name.setTextColor(getColor(R.color.tv_text_main));
    name.setTextSize(16f);
    name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
    name.setMaxLines(2);
    name.setEllipsize(TextUtils.TruncateAt.END);
    content.addView(name);

    TextView time = new TextView(this);
    LinearLayout.LayoutParams timeParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    timeParams.topMargin = dp(8);
    time.setLayoutParams(timeParams);
    time.setText("◷  " + formatTimeRange(item));
    time.setTextColor(getColor(R.color.tv_text_main));
    time.setTextSize(13f);
    time.setTypeface(time.getTypeface(), android.graphics.Typeface.BOLD);
    content.addView(time);

    TextView badge = new TextView(this);
    FrameLayout.LayoutParams badgeParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    badgeParams.gravity = android.view.Gravity.END | android.view.Gravity.TOP;
    badge.setLayoutParams(badgeParams);
    badge.setBackgroundResource(R.drawable.bg_today_badge);
    badge.setPadding(dp(12), dp(7), dp(12), dp(7));
    badge.setText(item.isLive ? "今日课" : "待开始");
    badge.setTextColor(getColor(R.color.tv_text_main));
    badge.setTextSize(11f);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    card.addView(badge);

    return card;
  }

  private void syncHorizontalCourse(int screenNumber, boolean immediate) {
    if (syncInProgress) {
      return;
    }

    syncInProgress = true;
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.VISIBLE);
      horizontalLoadingText.setText(immediate ? "正在同步今日课程资源..." : "检测到课程更新，正在重新同步资源...");
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
                                }));

                runOnUiThread(
                    () -> {
                      if (!shouldApplyHorizontalScreenUpdate(screenNumber)) {
                        syncInProgress = false;
                        return;
                      }

                      syncInProgress = false;
                      currentBundleChecksum = result.checksum;
                      resourceCacheDirty = false;
                      lastScheduleSyncFailed = false;
                      bindHorizontalSchedule(result.schedules);
                      dispatchScreenHeartbeat(false);
                      scheduleChecksumPolling();
                    });
              } catch (Exception error) {
                Log.e(TAG, "Horizontal schedule sync failed for screen " + screenNumber, error);
                runOnUiThread(
                    () -> {
                      if (!shouldApplyHorizontalScreenUpdate(screenNumber)) {
                        syncInProgress = false;
                        return;
                      }
                      syncInProgress = false;
                      lastScheduleSyncFailed = true;
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

  private void bindHorizontalSchedule(List<TvScheduleItem> scheduleItems) {
    syncedTodaySchedules.clear();
    if (scheduleItems != null) {
      syncedTodaySchedules.addAll(scheduleItems);
    }
    if (horizontalScheduleList != null) {
      horizontalScheduleList.removeAllViews();
    }

    if (scheduleItems == null || scheduleItems.isEmpty()) {
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
      horizontalScheduleSubtitle.setText(LocalDate.now().format(dateFormatter));
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

    for (int index = 0; index < scheduleItems.size(); index += 2) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      if (index > 0) {
        rowParams.topMargin = dp(16);
      }
      row.setLayoutParams(rowParams);

      View firstCard = createHorizontalScheduleCard(scheduleItems.get(index));
      LinearLayout.LayoutParams firstParams =
          new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
      firstCard.setLayoutParams(firstParams);
      row.addView(firstCard);

      if (index + 1 < scheduleItems.size()) {
        View secondCard = createHorizontalScheduleCard(scheduleItems.get(index + 1));
        LinearLayout.LayoutParams secondParams =
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        secondParams.leftMargin = dp(16);
        secondCard.setLayoutParams(secondParams);
        row.addView(secondCard);
      } else {
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerParams =
            new LinearLayout.LayoutParams(0, 0, 1f);
        spacerParams.leftMargin = dp(16);
        spacer.setLayoutParams(spacerParams);
        row.addView(spacer);
      }

      if (horizontalScheduleList != null) {
        horizontalScheduleList.addView(row);
      }
    }
  }

  private TvScheduleItem selectHorizontalSchedule(List<TvScheduleItem> scheduleItems) {
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

  private String formatTimeRange(TvScheduleItem item) {
    return item.startTime.format(timeFormatter) + " - " + item.endTime.format(timeFormatter);
  }

  private void refreshPlayback() {
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

  private void updateWaterfallPlayback(
      CourseScript.WaterfallSection section,
      int elapsedSeconds,
      String stageLabel,
      String modeKey,
      String fallbackHint) {
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, false);
    showPlaybackScroller();
    if (section == null || section.items == null || section.items.isEmpty()) {
      showPlaybackMessage("0", stageLabel, fallbackHint);
      return;
    }

    List<CourseScript.WaterfallItem> items = section.items;
    String waterfallSignature = buildWaterfallSignature(items);
    if (!modeKey.equals(lastPlaybackMode) || !waterfallSignature.equals(lastWaterfallSignature)) {
      lastPlaybackMode = modeKey;
      lastWaterfallSignature = waterfallSignature;
      lastWaterfallIndex = -1;
      lastWaterfallWindowStart = -1;
      lastTrainingSignature = "";
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.GONE);
      warmupRowsContainer.setVisibility(View.VISIBLE);
      buildWaterfallRows(items);
    }

    int currentIndex = 0;
    int currentItemStart = 0;
    int currentItemEnd = 0;
    for (int index = 0; index < items.size(); index += 1) {
      int nextEnd = currentItemStart + Math.max(items.get(index).seconds, 0);
      if (elapsedSeconds < nextEnd || index == items.size() - 1) {
        currentIndex = index;
        currentItemEnd = nextEnd;
        break;
      }
      currentItemStart = nextEnd;
    }

    int remainingSeconds = Math.max(currentItemEnd - elapsedSeconds, 0);
    int maxWindowStart = Math.max(items.size() - 3, 0);
    int windowStart = Math.min(Math.max(currentIndex - 1, 0), maxWindowStart);
    maybePlayWaterfallCue(modeKey, currentIndex);

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          activePlaybackItem == null ? null : activePlaybackItem.course,
          remainingSeconds,
          stageLabel,
          "",
          0,
          0);
      return;
    }

    playbackCountdownText.setText(String.valueOf(remainingSeconds));
    playbackStageLabel.setText(stageLabel);
    playbackStageProgress.setText((currentIndex + 1) + " / " + items.size());
    playbackHint.setText(buildWaterfallHint(items.get(currentIndex), fallbackHint));
    renderStageMeta("", 0, 0);

    if (currentIndex != lastWaterfallIndex || windowStart != lastWaterfallWindowStart) {
      lastWaterfallIndex = currentIndex;
      lastWaterfallWindowStart = windowStart;
      updateWaterfallRows(currentIndex, windowStart);
      scrollWaterfallToWindowStart(windowStart);
    } else {
      updateWaterfallActiveState(currentIndex);
    }
  }

  private String buildWaterfallHint(CourseScript.WaterfallItem item, String fallbackHint) {
    if (item == null) {
      return fallbackHint;
    }

    if (item.cue != null && !item.cue.trim().isEmpty()) {
      return item.cue;
    }
    if (item.actionName != null && !item.actionName.trim().isEmpty()) {
      return item.actionName;
    }
    return fallbackHint;
  }

  private String buildWaterfallSignature(List<CourseScript.WaterfallItem> items) {
    if (items == null || items.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(items.size());
    for (CourseScript.WaterfallItem item : items) {
      builder
          .append("|")
          .append(item == null || item.mediaUrl == null ? "" : item.mediaUrl)
          .append(":")
          .append(item == null || item.actionName == null ? "" : item.actionName)
          .append(":")
          .append(item == null ? 0 : Math.max(item.seconds, 0));
    }
    return builder.toString();
  }

  private String buildTrainingWaterfallSignature(List<CourseScript.VideoCard> cards) {
    if (cards == null || cards.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(cards.size());
    for (CourseScript.VideoCard card : cards) {
      builder
          .append("|")
          .append(card == null || card.mediaUrl == null ? "" : card.mediaUrl)
          .append(":")
          .append(card == null || card.actionName == null ? "" : card.actionName)
          .append(":")
          .append(card == null || card.stationNumber == null ? "" : card.stationNumber);
    }
    return builder.toString();
  }

  private void buildWaterfallRows(List<CourseScript.WaterfallItem> items) {
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (items == null) {
      return;
    }

    for (int index = 0; index < items.size(); index += 1) {
      WaterfallRowView row = createWaterfallRow();
      row.itemIndex = index;
      row.item = items.get(index);
      bindWaterfallRowContent(row);
      waterfallRows.add(row);
      warmupRowsContainer.addView(row.container);
    }
    syncWaterfallRowLayout();
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  private void buildTrainingWaterfallRows(List<CourseScript.VideoCard> cards) {
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (cards == null) {
      return;
    }

    for (int index = 0; index < cards.size(); index += 1) {
      CourseScript.VideoCard card = cards.get(index);
      WaterfallRowView row = createWaterfallRow();
      row.itemIndex = index;
      row.item =
          new CourseScript.WaterfallItem(
              card == null ? "" : card.actionId,
              card == null ? "" : card.actionName,
              card == null ? "" : card.mediaUrl,
              0,
              "");
      bindWaterfallRowContent(row);
      waterfallRows.add(row);
      warmupRowsContainer.addView(row.container);
    }
    syncWaterfallRowLayout();
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  private WaterfallRowView createWaterfallRow() {
    FrameLayout container = new FrameLayout(this);
    LinearLayout.LayoutParams containerParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    container.setLayoutParams(containerParams);
    container.setBackgroundResource(R.drawable.bg_playback_surface_card);

    VideoView videoView = new VideoView(this);
    FrameLayout.LayoutParams videoParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    videoParams.gravity = android.view.Gravity.CENTER;
    videoView.setLayoutParams(videoParams);
    container.addView(videoView);

    TextView placeholder = new TextView(this);
    placeholder.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    placeholder.setGravity(android.view.Gravity.CENTER);
    placeholder.setPadding(dp(16), dp(16), dp(16), dp(16));
    placeholder.setText("暂无视频");
    placeholder.setTextColor(getColor(R.color.tv_text_main));
    placeholder.setTextSize(22f);
    placeholder.setTypeface(placeholder.getTypeface(), android.graphics.Typeface.BOLD);
    container.addView(placeholder);

    View dimOverlay = new View(this);
    dimOverlay.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    dimOverlay.setBackgroundColor(getColor(R.color.tv_playback_dim));
    container.addView(dimOverlay);

    return new WaterfallRowView(container, videoView, placeholder, dimOverlay);
  }

  private void bindWaterfallRowContent(WaterfallRowView row) {
    if (row == null) {
      return;
    }

    String placeholderText = "暂无视频";
    if (row.item != null && row.item.actionName != null && !row.item.actionName.trim().isEmpty()) {
      placeholderText = row.item.actionName;
    }
    row.placeholderText.setText(placeholderText);
    row.placeholderText.setVisibility(View.VISIBLE);
    row.videoView.setVisibility(View.GONE);
    row.dimOverlay.setAlpha(0.46f);
    row.dimOverlay.setVisibility(View.VISIBLE);
  }

  private void updateWaterfallRows(int currentIndex, int windowStart) {
    int preloadEnd = Math.min(windowStart + 3, waterfallRows.size() - 1);
    for (int index = 0; index < waterfallRows.size(); index += 1) {
      WaterfallRowView row = waterfallRows.get(index);
      boolean shouldBindVideo = index >= windowStart && index <= preloadEnd;
      bindWaterfallVideo(row, shouldBindVideo ? row.item.mediaUrl : null);
      applyWaterfallRowActiveState(row, index == currentIndex);
    }
  }

  private void updateWaterfallActiveState(int currentIndex) {
    for (int index = 0; index < waterfallRows.size(); index += 1) {
      applyWaterfallRowActiveState(waterfallRows.get(index), index == currentIndex);
    }
  }

  private void bindWaterfallVideo(WaterfallRowView row, String mediaUrl) {
    if (row == null) {
      return;
    }

    if (mediaUrl == null || mediaUrl.trim().isEmpty()) {
      stopWaterfallVideo(row);
      return;
    }

    if (mediaUrl.equals(row.boundUrl)) {
      if (!row.videoView.isPlaying()) {
        row.videoView.start();
      }
      return;
    }

    row.boundUrl = mediaUrl;
    row.placeholderText.setVisibility(View.GONE);
    row.videoView.setVisibility(View.VISIBLE);
    try {
      row.videoView.stopPlayback();
    } catch (Exception ignored) {
      // Ignore stale player state while rebinding warmup rows.
    }
    row.videoView.setOnPreparedListener(
        mediaPlayer -> {
          mediaPlayer.setLooping(true);
          mediaPlayer.setVolume(0f, 0f);
          row.videoView.start();
        });
    row.videoView.setOnErrorListener(
        (mediaPlayer, what, extra) -> {
          stopWaterfallVideo(row);
          return true;
        });
    row.videoView.setVideoPath(mediaUrl);
    row.videoView.start();
  }

  private void stopWaterfallVideo(WaterfallRowView row) {
    if (row == null) {
      return;
    }

    row.boundUrl = "";
    try {
      row.videoView.stopPlayback();
    } catch (Exception ignored) {
      // Ignore stale player state when leaving playback.
    }
    row.videoView.setVisibility(View.GONE);
    row.placeholderText.setVisibility(View.VISIBLE);
  }

  private void applyWaterfallRowActiveState(WaterfallRowView row, boolean active) {
    if (row == null) {
      return;
    }
    row.dimOverlay.setAlpha(active ? 0f : 0.44f);
  }

  private void syncWaterfallRowLayout() {
    playbackScrollView.post(
        () -> {
          if (waterfallRows.isEmpty()) {
            return;
          }

          int contentWidth = warmupRowsContainer.getWidth();
          int viewportHeight = playbackScrollView.getHeight();
          if (contentWidth <= 0 || viewportHeight <= 0) {
            return;
          }

          int rowGap = dp(8);
          int heightByWidth = Math.round(contentWidth * 9f / 16f);
          int heightByViewport = Math.max((viewportHeight - rowGap * 2) / 3, dp(120));
          int rowHeight = Math.max(Math.min(heightByWidth, heightByViewport), dp(120));
          for (int index = 0; index < waterfallRows.size(); index += 1) {
            WaterfallRowView row = waterfallRows.get(index);
            LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) row.container.getLayoutParams();
            if (params == null) {
              params =
                  new LinearLayout.LayoutParams(
                      LinearLayout.LayoutParams.MATCH_PARENT, rowHeight);
            }
            params.height = rowHeight;
            params.topMargin = index == 0 ? 0 : rowGap;
            row.container.setLayoutParams(params);
          }
        });
  }

  private void scrollWaterfallToWindowStart(int windowStart) {
    playbackScrollView.post(
        () -> {
          if (windowStart < 0 || windowStart >= waterfallRows.size()) {
            return;
          }
          View targetRow = waterfallRows.get(windowStart).container;
          playbackScrollView.smoothScrollTo(0, Math.max(targetRow.getTop(), 0));
        });
  }

  private void showPlaybackScroller() {
    hideFinishPanel();
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    playbackScrollView.setVisibility(View.VISIBLE);
  }

  private void showVerticalPreviewState(CourseScript course) {
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, false);
    configureVerticalPlaybackHeader(true);
    hideFinishPanel();
    showPlaybackScroller();
    playbackCountdownText.setText("");
    playbackStageLabel.setText("");
    playbackStageProgress.setText("PREVIEW");
    renderStageMeta("", 0, 0);
    playbackHint.setVisibility(View.GONE);

    CourseScript.Pod firstPod =
        course == null || course.pods == null || course.pods.isEmpty() ? null : course.pods.get(0);
    EffectivePodScreen previewScreen =
        materializePodScreen(
            firstPod,
            findVideoGroup(course, firstPod == null ? null : firstPod.videoGroupId),
            getDisplayScreenIndex());

    if (previewScreen == null || previewScreen.videoCards == null || previewScreen.videoCards.isEmpty()) {
      showPlaybackMessage("", "PREVIEW", "正式训练还没有配置可预览的视频组。");
      return;
    }

    if (previewScreen.waterfallLayout) {
      String waterfallSignature = buildTrainingWaterfallSignature(previewScreen.videoCards);
      if (!"PREVIEW_WATERFALL".equals(lastPlaybackMode)
          || !waterfallSignature.equals(lastWaterfallSignature)) {
        lastPlaybackMode = "PREVIEW_WATERFALL";
        lastWaterfallSignature = waterfallSignature;
        lastTrainingSignature = "";
        lastWaterfallIndex = -1;
        lastWaterfallWindowStart = -1;
        trainingCardsContainer.removeAllViews();
        trainingCardsContainer.setVisibility(View.GONE);
        warmupRowsContainer.setVisibility(View.VISIBLE);
        buildTrainingWaterfallRows(previewScreen.videoCards);
      }
      updateWaterfallRows(0, 0);
      scrollWaterfallToWindowStart(0);
      return;
    }

    lastPlaybackMode = "PREVIEW_TRAINING";
    lastWaterfallSignature = "";
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.setVisibility(View.VISIBLE);
    String layoutSignature = buildTrainingLayoutSignature(previewScreen.videoCards);
    if (!layoutSignature.equals(lastTrainingSignature)) {
      renderTrainingCards(
          new TrainingPlaybackState(
              "preview|" + layoutSignature,
              "",
              "PREVIEW",
              "",
              0,
              previewScreen.videoCards,
              -1,
              false));
      lastTrainingSignature = layoutSignature;
    }
  }

  private void showHorizontalPreviewState(CourseScript course) {
    TrainingPlaybackState previewState = buildPreviewTrainingState(course);
    if (previewState == null) {
      showHorizontalMainState(course, 0, "PREVIEW", "", 0, 0);
      return;
    }

    showHorizontalMainState(
        course,
        Math.max(previewState.remainingSeconds, 0),
        previewState.stageProgress == null || previewState.stageProgress.trim().isEmpty()
            ? "WORK"
            : previewState.stageProgress,
        previewState.stageSecondaryText,
        previewState.completedDots,
        previewState.totalDots);
  }

  private void showHorizontalMainState(
      CourseScript course,
      int remainingSeconds,
      String primaryText,
      String secondaryText,
      int completedDots,
      int totalDots) {
    configureHorizontalMainLayout(false);
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.VISIBLE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.VISIBLE);
    }
    if (horizontalCountdownText != null) {
      horizontalCountdownText.setText(String.valueOf(Math.max(remainingSeconds, 0)));
    }
    if (horizontalStateText != null) {
      horizontalStateText.setText(
          primaryText == null || primaryText.trim().isEmpty() ? "WAITING" : primaryText);
      horizontalStateText.setMaxLines(totalDots > 0 ? 2 : 3);
    }
    if (horizontalStateSecondary != null) {
      if (secondaryText == null || secondaryText.trim().isEmpty() || totalDots > 0) {
        horizontalStateSecondary.setVisibility(View.GONE);
      } else {
        horizontalStateSecondary.setVisibility(View.VISIBLE);
        horizontalStateSecondary.setText(secondaryText);
      }
    }
    renderHorizontalDots(completedDots, totalDots);
    renderHorizontalProgressBar(course, currentTrainingElapsedSeconds, currentTrainingTotalSeconds);
  }

  private void showHorizontalTrainingState(CourseScript course, TrainingPlaybackState state) {
    if (state == null) {
      showHorizontalMainState(course, 0, "WAITING", "", 0, 0);
      return;
    }

    String primaryText =
        state.stageProgress == null || state.stageProgress.trim().isEmpty()
            ? "TRAINING"
            : state.stageProgress;
    showHorizontalMainState(
        course,
        Math.max(state.remainingSeconds, 0),
        primaryText,
        state.stageSecondaryText,
        state.completedDots,
        state.totalDots);
  }

  private void showHorizontalTransitionState(TrainingPlaybackState state) {
    showHorizontalMainState(
        activePlaybackItem == null ? null : activePlaybackItem.course,
        Math.max(state == null ? 0 : state.remainingSeconds, 0),
        formatHorizontalStateTitle(state == null ? "" : state.stageProgress),
        "",
        0,
        0);
  }

  private void showHorizontalFinishState() {
    configureHorizontalMainLayout(true);
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.GONE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.VISIBLE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.VISIBLE);
    }
    if (horizontalCountdownText != null) {
      horizontalCountdownText.setText("");
    }
    if (horizontalStateText != null) {
      horizontalStateText.setText("CONGRATULATION");
    }
    if (horizontalStateSecondary != null) {
      horizontalStateSecondary.setVisibility(View.GONE);
    }
    renderHorizontalDots(0, 0);
    if (horizontalProgressRow != null) {
      horizontalProgressRow.removeAllViews();
      horizontalProgressRow.setVisibility(View.GONE);
    }
  }

  private void renderHorizontalDots(int completedDots, int totalDots) {
    if (horizontalStateDotsRow == null) {
      return;
    }
    horizontalStateDotsRow.removeAllViews();
    if (totalDots <= 0) {
      horizontalStateDotsRow.setVisibility(View.GONE);
      return;
    }
    horizontalStateDotsRow.setVisibility(View.VISIBLE);
    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    int dotSize = clamp(Math.round(shortSide * 0.018f), dp(10), dp(18));
    int dotGap = clamp(Math.round(shortSide * 0.012f), dp(8), dp(16));
    for (int index = 0; index < totalDots; index += 1) {
      View dot = new View(this);
      LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dotSize, dotSize);
      if (index > 0) {
        params.leftMargin = dotGap;
      }
      dot.setLayoutParams(params);
      dot.setBackgroundResource(
          index < Math.max(completedDots, 0)
              ? R.drawable.bg_stage_dot_filled
              : R.drawable.bg_stage_dot_hollow);
      horizontalStateDotsRow.addView(dot);
    }
  }

  private void renderHorizontalProgressBar(CourseScript course, int elapsedSeconds, int totalSeconds) {
    if (horizontalProgressRow == null) {
      return;
    }

    horizontalProgressRow.removeAllViews();
    List<HorizontalTimelineSegment> segments = buildHorizontalTimeline(course);
    if (segments.isEmpty()) {
      horizontalProgressRow.setVisibility(View.GONE);
      return;
    }

    horizontalProgressRow.setVisibility(View.VISIBLE);
    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    int segmentHeight = clamp(Math.round(shortSide * 0.022f), dp(10), dp(18));
    int markerHeight = clamp(Math.round(shortSide * 0.05f), dp(26), dp(40));
    int markerWidth =
        clamp(Math.round(markerHeight * WATER_ICON_ASPECT_RATIO), dp(16), dp(28));
    int markerMargin = clamp(Math.round(shortSide * 0.012f), dp(8), dp(14));
    int safeElapsed = clamp(Math.max(elapsedSeconds, 0), 0, Math.max(totalSeconds, 0));
    int consumed = 0;
    for (int index = 0; index < segments.size(); index += 1) {
      HorizontalTimelineSegment segment = segments.get(index);
      LinearLayout segmentContainer = new LinearLayout(this);
      segmentContainer.setOrientation(LinearLayout.HORIZONTAL);
      LinearLayout.LayoutParams segmentParams =
          new LinearLayout.LayoutParams(0, segmentHeight, Math.max(segment.durationSeconds, 1));
      segmentContainer.setLayoutParams(segmentParams);

      int completedInSegment = clamp(safeElapsed - consumed, 0, segment.durationSeconds);
      int remainingInSegment = Math.max(segment.durationSeconds - completedInSegment, 0);
      if (completedInSegment > 0) {
        View fill = new View(this);
        fill.setBackgroundResource(R.drawable.bg_horizontal_progress_active);
        LinearLayout.LayoutParams fillParams =
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, completedInSegment);
        fill.setLayoutParams(fillParams);
        segmentContainer.addView(fill);
      }
      if (remainingInSegment > 0 || completedInSegment <= 0) {
        View empty = new View(this);
        empty.setBackgroundResource(R.drawable.bg_horizontal_progress_inactive);
        LinearLayout.LayoutParams emptyParams =
            new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.max(remainingInSegment, completedInSegment <= 0 ? segment.durationSeconds : 0));
        empty.setLayoutParams(emptyParams);
        segmentContainer.addView(empty);
      }
      horizontalProgressRow.addView(segmentContainer);
      consumed += segment.durationSeconds;

      if (index < segments.size() - 1) {
        ImageView marker = new ImageView(this);
        LinearLayout.LayoutParams markerParams =
            new LinearLayout.LayoutParams(markerWidth, markerHeight);
        markerParams.leftMargin = markerMargin;
        markerParams.rightMargin = markerMargin;
        marker.setLayoutParams(markerParams);
        marker.setAdjustViewBounds(true);
        marker.setScaleType(ImageView.ScaleType.FIT_CENTER);
        marker.setImageResource(R.drawable.icon_water);
        marker.setAlpha(1f);
        horizontalProgressRow.addView(marker);
      }
    }
  }

  private void configureVerticalPlaybackHeader(boolean previewHeader) {
    if (playbackTimerCard == null || playbackStageCard == null) {
      return;
    }

    LinearLayout.LayoutParams timerParams =
        (LinearLayout.LayoutParams) playbackTimerCard.getLayoutParams();
    LinearLayout.LayoutParams stageParams =
        (LinearLayout.LayoutParams) playbackStageCard.getLayoutParams();
    if (previewHeader) {
      playbackTimerCard.setVisibility(View.GONE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = LinearLayout.LayoutParams.MATCH_PARENT;
        stageParams.weight = 0f;
        stageParams.leftMargin = 0;
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(20), dp(14), dp(20), dp(14));
    } else {
      playbackTimerCard.setVisibility(View.VISIBLE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0.28f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = 0;
        stageParams.weight = 0.72f;
        stageParams.leftMargin = clamp(Math.round(
            Math.min(
                    getResources().getDisplayMetrics().widthPixels,
                    getResources().getDisplayMetrics().heightPixels)
                * 0.02f), dp(8), dp(16));
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(18), dp(12), dp(18), dp(12));
    }
  }

  private void configureHorizontalMainLayout(boolean finishMode) {
    if (horizontalCountdownText == null || horizontalStateText == null) {
      return;
    }

    View stateColumn = (View) horizontalStateText.getParent();
    LinearLayout.LayoutParams countdownParams =
        (LinearLayout.LayoutParams) horizontalCountdownText.getLayoutParams();
    LinearLayout.LayoutParams stateParams =
        stateColumn instanceof View
            ? (LinearLayout.LayoutParams) stateColumn.getLayoutParams()
            : null;
    if (finishMode) {
      horizontalCountdownText.setVisibility(View.GONE);
      if (countdownParams != null) {
        countdownParams.width = 0;
        countdownParams.weight = 0f;
        horizontalCountdownText.setLayoutParams(countdownParams);
      }
      if (stateParams != null) {
        stateParams.width = 0;
        stateParams.weight = 1f;
        stateColumn.setLayoutParams(stateParams);
      }
      if (stateColumn instanceof LinearLayout) {
        ((LinearLayout) stateColumn).setGravity(android.view.Gravity.CENTER);
        ((LinearLayout) stateColumn).setPadding(0, 0, 0, 0);
      }
      horizontalStateText.setGravity(android.view.Gravity.CENTER);
      horizontalStateText.setMaxLines(2);
    } else {
      horizontalCountdownText.setVisibility(View.VISIBLE);
      if (countdownParams != null) {
        countdownParams.width = 0;
        countdownParams.weight = 0.42f;
        horizontalCountdownText.setLayoutParams(countdownParams);
      }
      if (stateParams != null) {
        stateParams.width = 0;
        stateParams.weight = 0.58f;
        stateColumn.setLayoutParams(stateParams);
      }
      if (stateColumn instanceof LinearLayout) {
        ((LinearLayout) stateColumn).setGravity(android.view.Gravity.CENTER_VERTICAL);
        ((LinearLayout) stateColumn).setPadding(dp(24), 0, dp(8), 0);
      }
      horizontalStateText.setGravity(android.view.Gravity.START);
      horizontalStateText.setMaxLines(3);
    }
  }

  private List<HorizontalTimelineSegment> buildHorizontalTimeline(CourseScript course) {
    List<HorizontalTimelineSegment> segments = new ArrayList<>();
    if (course == null) {
      return segments;
    }

    int segmentDuration = 0;
    if (course.pods != null) {
      for (CourseScript.Pod pod : course.pods) {
        segmentDuration +=
            getPodDurationSeconds(materializeProgressPodScreen(course, pod));
        int endingDuration = getPodEndingDurationSeconds(course, pod);
        if (endingDuration > 0 && isProgressMarkerPod(pod)) {
          segmentDuration += endingDuration;
          segments.add(new HorizontalTimelineSegment(Math.max(segmentDuration, 1)));
          segmentDuration = 0;
        } else {
          segmentDuration += endingDuration;
        }
      }
    }

    if (segmentDuration > 0 || (segments.isEmpty() && getTrainingTotalSeconds(course) > 0)) {
      segments.add(new HorizontalTimelineSegment(Math.max(segmentDuration, 1)));
    }
    return segments;
  }

  private EffectivePodScreen materializeProgressPodScreen(CourseScript course, CourseScript.Pod pod) {
    CourseScript.VideoGroup group = findVideoGroup(course, pod == null ? null : pod.videoGroupId);
    if (group == null) {
      return null;
    }
    if (group.screenCount <= 1) {
      return materializePodScreen(pod, group, 1);
    }
    if (findPodScreen(pod, 1) != null && findVideoGroupScreen(group, 1) != null) {
      return materializePodScreen(pod, group, 1);
    }
    if (findPodScreen(pod, 2) != null && findVideoGroupScreen(group, 2) != null) {
      return materializePodScreen(pod, group, 2);
    }
    if (findPodScreen(pod, 3) != null && findVideoGroupScreen(group, 3) != null) {
      return materializePodScreen(pod, group, 3);
    }
    return null;
  }

  private boolean isProgressMarkerPod(CourseScript.Pod pod) {
    return pod != null && ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending));
  }

  private int getCourseTotalSeconds(CourseScript course) {
    if (course == null) {
      return 0;
    }
    return getWarmupReadySeconds(course)
        + getWaterfallTotalSeconds(course.warmup)
        + getTrainingReadySeconds(course)
        + getTrainingTotalSeconds(course)
        + getCooldownReadySeconds(course)
        + getWaterfallTotalSeconds(course.cooldown);
  }

  private String resolveHorizontalTransitionHint(TrainingPlaybackState state) {
    if (state == null) {
      return "";
    }
    if (state.hintText != null && !state.hintText.trim().isEmpty()) {
      return state.hintText;
    }
    if ("HYDRATE".equals(state.transitionType)) {
      return "补水后继续下一段训练";
    }
    if ("MOVE_ZONE".equals(state.transitionType)) {
      return "准备前往下一个区域";
    }
    if ("MOVE_STATION".equals(state.transitionType)) {
      return "准备前往下一个站点";
    }
    return "";
  }

  private String formatHorizontalStateTitle(String title) {
    if (title == null || title.trim().isEmpty()) {
      return "WAITING";
    }
    return title.toUpperCase(Locale.US);
  }

  private int resolveHorizontalTransitionIcon(String transitionType) {
    if ("HYDRATE".equals(transitionType)) {
      return R.drawable.icon_water;
    }
    if ("MOVE_STATION".equals(transitionType) || "MOVE_ZONE".equals(transitionType)) {
      return R.drawable.ic_horizontal_move;
    }
    return 0;
  }

  private int getHorizontalTransitionBackgroundColor(String transitionType) {
    if ("MOVE_STATION".equals(transitionType)) {
      return getColor(R.color.tv_playback_move_station);
    }
    if ("HYDRATE".equals(transitionType)) {
      return getColor(R.color.tv_playback_blue);
    }
    if ("MOVE_ZONE".equals(transitionType)) {
      return getColor(R.color.tv_black);
    }
    return getColor(R.color.tv_black);
  }

  private int parseSafeInt(String value) {
    if (value == null || value.trim().isEmpty()) {
      return 0;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ignored) {
      return 0;
    }
  }

  private void showWarmupReadyState(CourseScript course, int remainingSeconds) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          course,
          Math.max(remainingSeconds, 0),
          "GET READY FOR\nWARM UP",
          "",
          0,
          0);
      return;
    }

    updateWaterfallPlayback(
        course == null ? null : course.warmup,
        0,
        "REMAINING",
        "WARMUP_READY",
        "热身即将开始");
    applyPlaybackTheme(PlaybackTheme.READY);
    playbackCountdownText.setText(String.valueOf(Math.max(remainingSeconds, 0)));
    playbackStageLabel.setText("");
    playbackStageProgress.setText("GET READY FOR\nWARM UP");
    renderStageMeta("", 0, 0);
  }

  private void showWorkoutReadyState(CourseScript course, int remainingSeconds) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          course,
          Math.max(remainingSeconds, 0),
          "GET READY FOR\nWORKOUT",
          "",
          0,
          0);
      return;
    }

    updateTrainingPlayback(course, 0);
    applyPlaybackTheme(PlaybackTheme.READY);
    playbackCountdownText.setText(String.valueOf(Math.max(remainingSeconds, 0)));
    playbackStageLabel.setText("");
    playbackStageProgress.setText("GET READY FOR\nWORKOUT");
    renderStageMeta("", 0, 0);
  }

  private void showCooldownReadyState(CourseScript course, int remainingSeconds) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          course,
          Math.max(remainingSeconds, 0),
          "GET READY FOR\nCOOL DOWN",
          "",
          0,
          0);
      return;
    }

    updateWaterfallPlayback(
        course == null ? null : course.cooldown,
        0,
        "COOL DOWN",
        "COOLDOWN_READY",
        "冷身即将开始");
    applyPlaybackTheme(PlaybackTheme.READY);
    playbackCountdownText.setText(String.valueOf(Math.max(remainingSeconds, 0)));
    playbackStageLabel.setText("");
    playbackStageProgress.setText("GET READY FOR\nCOOL DOWN");
    renderStageMeta("", 0, 0);
  }

  private void showFullScreenTransitionState(TrainingPlaybackState state) {
    if (state == null) {
      return;
    }

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalTransitionState(state);
      return;
    }

    contentPanel.setBackgroundColor(getTransitionBackgroundColor(state.transitionType));
    showPlaybackChrome(false, false);
    clearWaterfallRows();
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    warmupRowsContainer.setVisibility(View.GONE);
    playbackScrollView.setVisibility(View.GONE);
    hideFinishPanel();
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.VISIBLE);
    }
    if (getReadyCountdownText != null) {
      getReadyCountdownText.setText(String.valueOf(Math.max(state.remainingSeconds, 0)));
    }
    if (getReadyLabelText != null) {
      getReadyLabelText.setText(formatTransitionTitle(state.stageProgress));
    }
    if (getReadySubtext != null) {
      if (state.hintText == null || state.hintText.trim().isEmpty()) {
        getReadySubtext.setVisibility(View.GONE);
      } else {
        getReadySubtext.setVisibility(View.VISIBLE);
        getReadySubtext.setText(state.hintText);
      }
    }
    lastPlaybackMode = "FULLSCREEN_TRANSITION|" + state.transitionType;
    lastTrainingSignature = "";
    lastWaterfallSignature = "";
    lastWaterfallIndex = -1;
    lastWaterfallWindowStart = -1;
  }

  private int getWarmupReadySeconds(CourseScript course) {
    if (course == null || course.warmup == null || course.warmup.items == null || course.warmup.items.isEmpty()) {
      return 0;
    }
    return WARMUP_READY_SECONDS;
  }

  private int getTrainingReadySeconds(CourseScript course) {
    if (course == null || course.pods == null || course.pods.isEmpty()) {
      return 0;
    }
    return TRAINING_READY_SECONDS;
  }

  private int getCooldownReadySeconds(CourseScript course) {
    if (course == null || course.cooldown == null || course.cooldown.items == null || course.cooldown.items.isEmpty()) {
      return 0;
    }
    return COOLDOWN_READY_SECONDS;
  }

  private void applyResponsiveLayout() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    int horizontalPadding = clamp(Math.round(shortSide * 0.05f), dp(14), dp(40));
    int verticalPadding = clamp(Math.round(shortSide * 0.04f), dp(12), dp(32));

    if (contentPanel != null) {
      contentPanel.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
    }
    if (pageTitle != null) {
      pageTitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.115f, sp(30), sp(62)));
    }
    if (pageSubtitle != null) {
      pageSubtitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.038f, sp(14), sp(24)));
    }
    if (screenTag != null) {
      screenTag.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.03f, sp(12), sp(18)));
    }

    int statusHeight = clamp(Math.round(shortSide * 0.3f), dp(112), dp(220));
    if (playbackStatusGroup != null) {
      ViewGroup.LayoutParams params = playbackStatusGroup.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        playbackStatusGroup.setLayoutParams(params);
      }
    }
    if (playbackTimerCard != null) {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playbackTimerCard.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        params.width = 0;
        params.weight = 0.28f;
        playbackTimerCard.setLayoutParams(params);
      }
    }
    if (playbackStageCard != null) {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playbackStageCard.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        params.width = 0;
        params.weight = 0.72f;
        params.leftMargin = clamp(Math.round(shortSide * 0.02f), dp(8), dp(16));
        playbackStageCard.setLayoutParams(params);
      }
    }

    if (playbackCountdownText != null) {
      playbackCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(statusHeight * 0.78f, sp(48), sp(108)));
    }
    if (playbackStageProgress != null) {
      playbackStageProgress.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(statusHeight * 0.28f, sp(18), sp(34)));
    }
    if (playbackStageSecondary != null) {
      playbackStageSecondary.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(statusHeight * 0.14f, sp(11), sp(18)));
    }
    if (playbackHint != null) {
      playbackHint.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.032f, sp(14), sp(22)));
    }
    if (getReadyCountdownText != null) {
      getReadyCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.34f, sp(84), sp(168)));
    }
    if (getReadyLabelText != null) {
      getReadyLabelText.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.085f, sp(28), sp(44)));
    }
    if (getReadySubtext != null) {
      getReadySubtext.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.04f, sp(16), sp(24)));
    }
    if (finishFallbackText != null) {
      finishFallbackText.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.085f, sp(30), sp(52)));
    }
    if (finishLogoImage != null) {
      finishLogoImage.setMaxWidth(clamp(Math.round(shortSide * 0.7f), dp(220), dp(560)));
      finishLogoImage.setMaxHeight(clamp(Math.round(shortSide * 0.38f), dp(120), dp(320)));
    }
    if (horizontalCountdownText != null) {
      horizontalCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.42f, sp(88), sp(220)));
    }
    if (horizontalStateText != null) {
      horizontalStateText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.13f, sp(30), sp(64)));
    }
    if (horizontalStateSecondary != null) {
      horizontalStateSecondary.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.05f, sp(16), sp(28)));
    }
    if (horizontalTransitionCountdownText != null) {
      horizontalTransitionCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.3f, sp(92), sp(180)));
    }
    if (horizontalTransitionTitle != null) {
      horizontalTransitionTitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.12f, sp(28), sp(60)));
    }
    if (horizontalTransitionHint != null) {
      horizontalTransitionHint.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.042f, sp(14), sp(24)));
    }
    if (horizontalScheduleTitle != null) {
      horizontalScheduleTitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.085f, sp(24), sp(52)));
    }
    if (horizontalScheduleSubtitle != null) {
      horizontalScheduleSubtitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.035f, sp(13), sp(22)));
    }

    updateScheduleLayoutBounds(screenWidth, screenHeight, shortSide);
  }

  private void updateScheduleLayoutBounds(int screenWidth, int screenHeight, int shortSide) {
    if (scheduleList != null) {
      ViewGroup.LayoutParams rawParams = scheduleList.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width =
            isVerticalCourseScreen(activeScreenNumber)
                ? Math.min(Math.round(screenWidth * 0.82f), dp(520))
                : LinearLayout.LayoutParams.MATCH_PARENT;
        scheduleList.setLayoutParams(params);
      }
    }

    if (scheduleStateText != null) {
      ViewGroup.LayoutParams rawParams = scheduleStateText.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width =
            isVerticalCourseScreen(activeScreenNumber)
                ? Math.min(Math.round(screenWidth * 0.82f), dp(520))
                : LinearLayout.LayoutParams.MATCH_PARENT;
        scheduleStateText.setLayoutParams(params);
      }
    }

    if (horizontalScheduleList != null) {
      ViewGroup.LayoutParams rawParams = horizontalScheduleList.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width = Math.min(Math.round(screenWidth * 0.92f), dp(1080));
        horizontalScheduleList.setLayoutParams(params);
      }
    }
  }

  private int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }

  private float clampPx(float value, float min, float max) {
    return Math.max(min, Math.min(max, value));
  }

  private float sp(int value) {
    return TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_SP, value, getResources().getDisplayMetrics());
  }

  private void applyPlaybackTheme(PlaybackTheme theme) {
    if (playbackTimerCard == null || playbackStageCard == null) {
      return;
    }

    PlaybackTheme safeTheme = theme == null ? PlaybackTheme.NORMAL : theme;
    switch (safeTheme) {
      case READY:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_ready);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case MOVE_STATION:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_move_station);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case MOVE_ZONE:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_black);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card_black);
        break;
      case HYDRATE:
      case NORMAL:
      default:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
    }
  }

  private PlaybackTheme getThemeForState(TrainingPlaybackState state) {
    if (state == null || state.transitionType == null || state.transitionType.trim().isEmpty()) {
      return PlaybackTheme.NORMAL;
    }

    if ("MOVE_STATION".equals(state.transitionType)) {
      return PlaybackTheme.MOVE_STATION;
    }
    if ("MOVE_ZONE".equals(state.transitionType)) {
      return PlaybackTheme.MOVE_ZONE;
    }
    if ("HYDRATE".equals(state.transitionType)) {
      return PlaybackTheme.HYDRATE;
    }
    return PlaybackTheme.NORMAL;
  }

  private int getTransitionBackgroundColor(String transitionType) {
    if ("MOVE_STATION".equals(transitionType)) {
      return getColor(R.color.tv_playback_move_station);
    }
    if ("MOVE_ZONE".equals(transitionType)) {
      return getColor(R.color.tv_playback_move_zone);
    }
    return getColor(R.color.tv_playback_blue);
  }

  private String formatTransitionTitle(String transitionTitle) {
    if (transitionTitle == null || transitionTitle.trim().isEmpty()) {
      return "READY";
    }
    return transitionTitle.replace(" ", "\n");
  }

  private void renderStageMeta(String secondaryText, int completedDots, int totalDots) {
    if (playbackStageSecondary != null) {
      if (secondaryText == null || secondaryText.trim().isEmpty()) {
        playbackStageSecondary.setVisibility(View.GONE);
      } else {
        playbackStageSecondary.setVisibility(View.VISIBLE);
        playbackStageSecondary.setText(secondaryText);
      }
    }

    if (playbackStageDotsRow != null) {
      playbackStageDotsRow.removeAllViews();
      if (totalDots <= 0) {
        playbackStageDotsRow.setVisibility(View.GONE);
      } else {
        playbackStageDotsRow.setVisibility(View.VISIBLE);
        for (int index = 0; index < totalDots; index += 1) {
          View dot = new View(this);
          LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(10), dp(10));
          if (index > 0) {
            params.leftMargin = dp(8);
          }
          dot.setLayoutParams(params);
          dot.setBackgroundResource(
              index < Math.max(completedDots, 0)
                  ? R.drawable.bg_stage_dot_filled
                  : R.drawable.bg_stage_dot_hollow);
          playbackStageDotsRow.addView(dot);
        }
      }
    }
  }

  private void updateTrainingPlayback(CourseScript course, int elapsedSeconds) {
    TrainingPlaybackState state = buildTrainingPlaybackState(course, elapsedSeconds);
    if (state == null) {
      showPlaybackMessage("0", "TRAINING", "当前课程没有正式训练脚本。");
      return;
    }
    maybePlayTrainingCue(state);

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      if (state.fullScreenTransition) {
        showHorizontalTransitionState(state);
      } else {
        showHorizontalTrainingState(course, state);
      }
      return;
    }

    if (state.fullScreenTransition) {
      showFullScreenTransitionState(state);
      return;
    }

    applyPlaybackTheme(getThemeForState(state));
    playbackCountdownText.setText(String.valueOf(Math.max(state.remainingSeconds, 0)));
    playbackStageLabel.setText(state.stageLabel);
    playbackStageProgress.setText(state.stageProgress);
    renderStageMeta(state.stageSecondaryText, state.completedDots, state.totalDots);
    playbackHint.setText(state.hintText);
    playbackHint.setVisibility(
        state.hintText == null || state.hintText.trim().isEmpty() ? View.GONE : View.VISIBLE);

    if (state.messageOnly) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
      showPlaybackChrome(true, false);
      showPlaybackScroller();
      clearWaterfallRows();
      warmupRowsContainer.setVisibility(View.GONE);
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.GONE);
      lastTrainingSignature = "";
      return;
    }

    if (state.waterfallLayout) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_black));
      showPlaybackChrome(true, false);
      showPlaybackScroller();
      String waterfallSignature = buildTrainingWaterfallSignature(state.displayCards);
      if (!"TRAINING_WATERFALL".equals(lastPlaybackMode) || !waterfallSignature.equals(lastWaterfallSignature)) {
        lastPlaybackMode = "TRAINING_WATERFALL";
        lastWaterfallSignature = waterfallSignature;
        lastWaterfallIndex = -1;
        lastWaterfallWindowStart = -1;
        lastTrainingSignature = "";
        trainingCardsContainer.removeAllViews();
        trainingCardsContainer.setVisibility(View.GONE);
        warmupRowsContainer.setVisibility(View.VISIBLE);
        buildTrainingWaterfallRows(state.displayCards);
      }

      int maxWindowStart = Math.max(state.displayCards.size() - 3, 0);
      int windowStart = Math.min(Math.max(state.activeCardIndex - 1, 0), maxWindowStart);
      if (state.activeCardIndex != lastWaterfallIndex || windowStart != lastWaterfallWindowStart) {
        lastWaterfallIndex = state.activeCardIndex;
        lastWaterfallWindowStart = windowStart;
        updateWaterfallRows(state.activeCardIndex, windowStart);
        scrollWaterfallToWindowStart(windowStart);
      } else {
        updateWaterfallActiveState(state.activeCardIndex);
      }
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    showPlaybackChrome(true, false);
    showPlaybackScroller();
    if (!"TRAINING".equals(lastPlaybackMode)) {
      lastPlaybackMode = "TRAINING";
      clearWaterfallRows();
      warmupRowsContainer.setVisibility(View.GONE);
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.VISIBLE);
      lastTrainingSignature = "";
    }

    String layoutSignature = buildTrainingLayoutSignature(state.displayCards);
    if (!layoutSignature.equals(lastTrainingSignature)) {
      renderTrainingCards(state);
      lastTrainingSignature = layoutSignature;
    }
  }

  private TrainingPlaybackState buildTrainingPlaybackState(CourseScript course, int elapsedSeconds) {
    if (course.pods == null || course.pods.isEmpty()) {
      return null;
    }

    int cursor = 0;
    int displayScreenIndex = getDisplayScreenIndex();
    for (int podIndex = 0; podIndex < course.pods.size(); podIndex += 1) {
      CourseScript.Pod pod = course.pods.get(podIndex);
      CourseScript.VideoGroup group = findVideoGroup(course, pod.videoGroupId);
      EffectivePodScreen effectiveScreen = materializePodScreen(pod, group, displayScreenIndex);
      int podDurationSeconds = getPodDurationSeconds(effectiveScreen);
      EffectivePodScreen nextEffectiveScreen = null;
      if (podIndex + 1 < course.pods.size()) {
        CourseScript.Pod nextPod = course.pods.get(podIndex + 1);
        nextEffectiveScreen =
            materializePodScreen(
                nextPod,
                findVideoGroup(course, nextPod.videoGroupId),
                displayScreenIndex);
      }

      if (elapsedSeconds < cursor + podDurationSeconds) {
        return buildPodRunningState(pod, effectiveScreen, elapsedSeconds - cursor);
      }
      cursor += podDurationSeconds;

      int endingDurationSeconds = getPodEndingDurationSeconds(course, pod);
      if (endingDurationSeconds > 0 && elapsedSeconds < cursor + endingDurationSeconds) {
        return buildPodEndingState(
            pod,
            effectiveScreen,
            nextEffectiveScreen,
            elapsedSeconds - cursor,
            endingDurationSeconds);
      }
      cursor += endingDurationSeconds;
    }

    return null;
  }

  private TrainingPlaybackState buildPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen != null && !effectiveScreen.waterfallLayout) {
      return buildStationPodRunningState(pod, effectiveScreen, podElapsedSeconds);
    }
    return buildWaterfallPodRunningState(pod, effectiveScreen, podElapsedSeconds);
  }

  private TrainingPlaybackState buildWaterfallPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return new TrainingPlaybackState(
          pod.name + "|empty",
          "TRAINING",
          "",
          "当前屏幕没有可播放的视频组内容。",
          0,
          new ArrayList<>(),
          -1,
          false,
          true,
          false,
          false,
          "");
    }

    List<CourseScript.VideoCard> actionSequence =
        buildActionSequence(effectiveScreen.videoCards, Math.max(effectiveScreen.rule.loopCount, 1));
    int workSeconds =
        effectiveScreen.rule.setConfigs != null && !effectiveScreen.rule.setConfigs.isEmpty()
            ? Math.max(effectiveScreen.rule.setConfigs.get(0).workSeconds, 0)
            : 0;
    int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
    int cursor = 0;
    int actionCountPerLoop = Math.max(effectiveScreen.videoCards.size(), 1);

    for (int actionIndex = 0; actionIndex < actionSequence.size(); actionIndex += 1) {
      CourseScript.VideoCard currentCard = actionSequence.get(actionIndex);
      int roundIndex = actionIndex / actionCountPerLoop + 1;
      if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
        int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
        return new TrainingPlaybackState(
            pod.name + "|wf-work|" + actionIndex,
            "REMAINING",
            "WORK",
            buildTrainingHint(
                pod.name,
                currentCard.actionName,
                currentCard.stationNumber,
                roundIndex,
                Math.max(effectiveScreen.rule.loopCount, 1),
                false,
                false),
            remainingSeconds,
            actionSequence,
            actionIndex,
            true,
            true,
            false,
            false,
            "");
      }
      cursor += workSeconds;

      boolean hasNextAction = actionIndex < actionSequence.size() - 1;
      if (hasNextAction && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        CourseScript.VideoCard nextCard = actionSequence.get(actionIndex + 1);
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        return new TrainingPlaybackState(
            pod.name + "|wf-move|" + actionIndex,
            "REMAINING",
            "REST",
            buildTrainingHint(
                pod.name,
                nextCard.actionName,
                nextCard.stationNumber,
                roundIndex,
                Math.max(effectiveScreen.rule.loopCount, 1),
                true,
                false),
            remainingSeconds,
            actionSequence,
            actionIndex + 1,
            false,
            true,
            false,
            false,
            "");
      }
      if (hasNextAction) {
        cursor += stationRestSeconds;
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|wf-idle",
        "TRAINING",
        "",
        "正式训练准备中",
        0,
        actionSequence,
        actionSequence.isEmpty() ? -1 : actionSequence.size() - 1,
        false,
        true,
        false,
        false,
        "");
  }

  private TrainingPlaybackState buildStationPodRunningState(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen, int podElapsedSeconds) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return new TrainingPlaybackState(
          pod.name + "|empty",
          "TRAINING",
          "",
          "当前屏幕没有可播放的视频组内容。",
          0,
          new ArrayList<>(),
          -1,
          false);
    }

    List<CourseScript.VideoCard> baseCards = effectiveScreen.videoCards;
    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int cursor = 0;

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        int workSeconds = Math.max(setConfig.workSeconds, 0);
        if (workSeconds > 0 && podElapsedSeconds < cursor + workSeconds) {
          int remainingSeconds = Math.max(cursor + workSeconds - podElapsedSeconds, 0);
          return new TrainingPlaybackState(
              pod.name + "|station-work|" + loopIndex + "|" + setIndex,
              "REMAINING",
              "WORK",
              buildStationTrainingHint(pod.name, loopIndex + 1, safeLoops, setIndex + 1, setConfigs.size(), false, false),
              remainingSeconds,
              baseCards,
              -1,
              true,
              false,
              false,
              false,
              "",
              "SET " + (setIndex + 1),
              0,
              0);
        }
        cursor += workSeconds;

        boolean hasNextSet = setIndex < setConfigs.size() - 1;
        int setRestSeconds = Math.max(setConfig.restSeconds, 0);
        if (hasNextSet && setRestSeconds > 0 && podElapsedSeconds < cursor + setRestSeconds) {
          int remainingSeconds = Math.max(cursor + setRestSeconds - podElapsedSeconds, 0);
          return new TrainingPlaybackState(
              pod.name + "|station-set-rest|" + loopIndex + "|" + setIndex,
              "REMAINING",
              "REST",
              buildStationTrainingHint(pod.name, loopIndex + 1, safeLoops, setIndex + 1, setConfigs.size(), true, false),
              remainingSeconds,
              baseCards,
              -1,
              false,
              false,
              false,
              false,
              "",
              "",
              setIndex + 1,
              setConfigs.size());
        }
        if (hasNextSet) {
          cursor += setRestSeconds;
        }
      }

      boolean hasNextLoop = loopIndex < safeLoops - 1;
      int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
      if (hasNextLoop && stationRestSeconds > 0 && podElapsedSeconds < cursor + stationRestSeconds) {
        int remainingSeconds = Math.max(cursor + stationRestSeconds - podElapsedSeconds, 0);
        boolean fullScreenTransition = remainingSeconds > Math.max((stationRestSeconds + 1) / 2, 1);
        return new TrainingPlaybackState(
            pod.name + "|station-move|" + loopIndex,
            "REMAINING",
            "MOVE STATION",
            fullScreenTransition ? "" : "准备前往下一个站点。",
            remainingSeconds,
            baseCards,
            -1,
            false,
            false,
            false,
            fullScreenTransition,
            "MOVE_STATION");
      }
      if (hasNextLoop) {
        cursor += stationRestSeconds;
      }
    }

    return new TrainingPlaybackState(
        pod.name + "|station-idle",
        "TRAINING",
        "",
        "正式训练准备中",
        0,
        baseCards,
        -1,
        false);
  }

  private TrainingPlaybackState buildPodEndingState(
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      EffectivePodScreen nextEffectiveScreen,
      int endingElapsedSeconds,
      int endingDurationSeconds) {
    EffectivePodScreen previewScreen = nextEffectiveScreen != null ? nextEffectiveScreen : effectiveScreen;
    List<CourseScript.VideoCard> cards =
        previewScreen == null || previewScreen.videoCards == null
            ? new ArrayList<>()
            : previewScreen.videoCards;
    int remainingSeconds = Math.max(endingDurationSeconds - endingElapsedSeconds, 0);
    boolean fullScreenTransition = remainingSeconds > Math.max((endingDurationSeconds + 1) / 2, 1);
    boolean previewWaterfall = previewScreen != null && previewScreen.waterfallLayout;

    if ("MOVE_ZONE".equals(pod.ending)) {
      return new TrainingPlaybackState(
          pod.name + "|move-zone",
          "REMAINING",
          "MOVE ZONE",
          fullScreenTransition ? "" : "准备前往下一个区域。",
          remainingSeconds,
          cards,
          previewWaterfall ? 0 : -1,
          false,
          previewWaterfall,
          false,
          fullScreenTransition,
          "MOVE_ZONE");
    }

    return new TrainingPlaybackState(
        pod.name + "|hydrate",
        "REMAINING",
        "HYDRATE",
        fullScreenTransition ? "" : "补水后继续下一段训练。",
        remainingSeconds,
        cards,
        previewWaterfall ? 0 : -1,
        false,
        previewWaterfall,
        false,
        fullScreenTransition,
        "HYDRATE");
  }

  private String buildTrainingHint(
      String podName,
      String actionName,
      String stationNumber,
      int roundIndex,
      int totalRounds,
      boolean restPhase,
      boolean moveStation) {
    String safeAction = actionName == null || actionName.trim().isEmpty() ? "未命名动作" : actionName;
    String safeStation = stationNumber == null || stationNumber.trim().isEmpty() ? "" : " · 站点 " + stationNumber;
    String prefix = "正式训练";

    if (moveStation) {
      return prefix + safeStation + " · MOVE STATION · " + safeAction;
    }
    if (restPhase) {
      return prefix + safeStation + " · REST · " + safeAction + " · 第 " + roundIndex + "/" + totalRounds + " 轮";
    }
    return prefix + safeStation + " · " + safeAction + " · 第 " + roundIndex + "/" + totalRounds + " 轮";
  }

  private String buildStationTrainingHint(
      String podName,
      int roundIndex,
      int totalRounds,
      int setIndex,
      int totalSets,
      boolean restPhase,
      boolean moveStation) {
    String prefix = "正式训练";
    if (moveStation) {
      return prefix + " · MOVE STATION · 第 " + roundIndex + "/" + totalRounds + " 轮后换站";
    }
    if (restPhase) {
      return prefix + " · 组间休息 · 第 " + setIndex + "/" + totalSets + " 组";
    }
    return prefix + " · 第 " + roundIndex + "/" + totalRounds + " 轮 · 第 " + setIndex + "/" + totalSets + " 组";
  }

  private void renderTrainingCards(TrainingPlaybackState state) {
    trainingCardsContainer.removeAllViews();
    if (state.displayCards == null || state.displayCards.isEmpty()) {
      TextView emptyText = new TextView(this);
      emptyText.setText("当前屏幕没有可展示的视频组。");
      emptyText.setTextColor(getColor(R.color.tv_text_subtle));
      emptyText.setTextSize(16f);
      emptyText.setGravity(android.view.Gravity.CENTER);
      emptyText.setPadding(0, dp(30), 0, dp(10));
      trainingCardsContainer.addView(emptyText);
      return;
    }

    int cardCount = state.displayCards.size();
    int columns = cardCount <= 3 ? 1 : 2;
    int previewHeight = columns == 1 ? calculateWideTrainingRowHeight() : calculateGridTrainingRowHeight();

    for (int rowStart = 0; rowStart < cardCount; rowStart += columns) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      if (rowStart > 0) {
        rowParams.topMargin = dp(10);
      }
      row.setLayoutParams(rowParams);

      for (int column = 0; column < columns; column += 1) {
        int cardIndex = rowStart + column;
        if (cardIndex >= cardCount) {
          View spacer = new View(this);
          spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 0, 1f));
          row.addView(spacer);
          continue;
        }

        View card =
            columns == 1
                ? createTrainingWideCard(state.displayCards.get(cardIndex), cardIndex, previewHeight)
                : createTrainingGridCard(state.displayCards.get(cardIndex), cardIndex, previewHeight);
        row.addView(card);
      }
      trainingCardsContainer.addView(row);
    }
  }

  private View createTrainingWideCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    LinearLayout wrapper = new LinearLayout(this);
    wrapper.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, previewHeight);
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    TextView index = new TextView(this);
    LinearLayout.LayoutParams indexParams =
        new LinearLayout.LayoutParams(dp(60), LinearLayout.LayoutParams.MATCH_PARENT);
    index.setLayoutParams(indexParams);
    index.setBackgroundResource(R.drawable.bg_playback_index_card);
    index.setGravity(android.view.Gravity.CENTER);
    index.setText(safeStationLabel(card.stationNumber, cardIndex + 1));
    index.setTextColor(getColor(R.color.tv_text_main));
    index.setTextSize(20f);
    index.setTypeface(index.getTypeface(), android.graphics.Typeface.BOLD);
    wrapper.addView(index);

    FrameLayout preview = new FrameLayout(this);
    LinearLayout.LayoutParams previewParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
    previewParams.leftMargin = dp(6);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);

    return wrapper;
  }

  private View createTrainingGridCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    LinearLayout wrapper = new LinearLayout(this);
    wrapper.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, previewHeight, 1f);
    if (cardIndex % 2 == 0) {
      params.rightMargin = dp(5);
    } else {
      params.leftMargin = dp(5);
    }
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    TextView index = new TextView(this);
    LinearLayout.LayoutParams indexParams =
        new LinearLayout.LayoutParams(dp(44), LinearLayout.LayoutParams.MATCH_PARENT);
    index.setLayoutParams(indexParams);
    index.setBackgroundResource(R.drawable.bg_playback_index_card);
    index.setGravity(android.view.Gravity.CENTER);
    index.setText(safeStationLabel(card.stationNumber, cardIndex + 1));
    index.setTextColor(getColor(R.color.tv_text_main));
    index.setTextSize(18f);
    index.setTypeface(index.getTypeface(), android.graphics.Typeface.BOLD);
    wrapper.addView(index);

    FrameLayout preview = new FrameLayout(this);
    LinearLayout.LayoutParams previewParams =
        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
    previewParams.leftMargin = dp(6);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);

    return wrapper;
  }

  private void bindTrainingPreview(FrameLayout preview, CourseScript.VideoCard card) {
    boolean hasMedia = card != null && card.mediaUrl != null && !card.mediaUrl.trim().isEmpty();
    if (hasMedia) {
      VideoView videoView = new VideoView(this);
      videoView.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      preview.addView(videoView);
      videoView.setOnPreparedListener(
          mediaPlayer -> {
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(0f, 0f);
            videoView.start();
          });
      videoView.setOnErrorListener((mediaPlayer, what, extra) -> true);
      videoView.setVideoPath(card.mediaUrl);
      videoView.start();
    } else {
      View dim = new View(this);
      dim.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      dim.setBackgroundColor(getColor(R.color.tv_playback_caption));
      preview.addView(dim);

      TextView placeholder = new TextView(this);
      placeholder.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      placeholder.setGravity(android.view.Gravity.CENTER);
      placeholder.setPadding(dp(16), dp(16), dp(16), dp(16));
      placeholder.setText(safeStationLabel(card == null ? null : card.stationNumber, 1));
      placeholder.setTextColor(getColor(R.color.tv_text_main));
      placeholder.setTextSize(24f);
      placeholder.setTypeface(placeholder.getTypeface(), android.graphics.Typeface.BOLD);
      preview.addView(placeholder);
    }
  }

  private String buildTrainingLayoutSignature(List<CourseScript.VideoCard> cards) {
    if (cards == null || cards.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(cards.size());
    for (int index = 0; index < cards.size(); index += 1) {
      CourseScript.VideoCard card = cards.get(index);
      builder
          .append("|")
          .append(safeStationLabel(card == null ? null : card.stationNumber, index + 1))
          .append(":")
          .append(card == null || card.mediaUrl == null ? "" : card.mediaUrl);
    }
    return builder.toString();
  }

  private int calculateWideTrainingRowHeight() {
    int contentWidth = getResources().getDisplayMetrics().widthPixels - dp(36);
    int previewWidth = Math.max(contentWidth - dp(66), dp(220));
    return Math.max(Math.round(previewWidth * 9f / 16f), dp(170));
  }

  private int calculateGridTrainingRowHeight() {
    int contentWidth = getResources().getDisplayMetrics().widthPixels - dp(36);
    int columnWidth = Math.max((contentWidth - dp(10)) / 2, dp(180));
    int previewWidth = Math.max(columnWidth - dp(50), dp(120));
    return Math.max(Math.round(previewWidth * 9f / 16f), dp(116));
  }

  private String safeStationLabel(String stationNumber, int fallbackIndex) {
    if (stationNumber == null || stationNumber.trim().isEmpty()) {
      return String.valueOf(fallbackIndex);
    }
    return stationNumber;
  }

  private List<CourseScript.VideoCard> buildActionSequence(
      List<CourseScript.VideoCard> videoCards, int loopCount) {
    List<CourseScript.VideoCard> sequence = new ArrayList<>();
    if (videoCards == null || videoCards.isEmpty()) {
      return sequence;
    }

    int safeLoops = Math.max(loopCount, 1);
    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      sequence.addAll(videoCards);
    }
    return sequence;
  }

  private List<CourseScript.PodSetConfig> getEffectiveSetConfigs(CourseScript.PodScreen rule) {
    List<CourseScript.PodSetConfig> setConfigs = new ArrayList<>();
    if (rule != null && rule.setConfigs != null && !rule.setConfigs.isEmpty()) {
      setConfigs.addAll(rule.setConfigs);
      return setConfigs;
    }

    setConfigs.add(new CourseScript.PodSetConfig(0, 0));
    return setConfigs;
  }

  private int getTrainingTotalSeconds(CourseScript course) {
    if (course == null || course.pods == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.Pod pod : course.pods) {
      total += getPodDurationSeconds(materializeProgressPodScreen(course, pod));
      total += getPodEndingDurationSeconds(course, pod);
    }
    return total;
  }

  private int getPodDurationSeconds(EffectivePodScreen effectiveScreen) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return 0;
    }

    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int duration = 0;
    int loopCount = Math.max(effectiveScreen.rule.loopCount, 1);

    if (!effectiveScreen.waterfallLayout) {
      for (int loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
        for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
          duration += Math.max(setConfig.workSeconds, 0);
          if (setIndex < setConfigs.size() - 1) {
            duration += Math.max(setConfig.restSeconds, 0);
          }
        }
        if (loopIndex < loopCount - 1) {
          duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
        }
      }
      return duration;
    }

    int totalActions = effectiveScreen.videoCards.size() * loopCount;
    for (int actionIndex = 0; actionIndex < totalActions; actionIndex += 1) {
      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        duration += Math.max(setConfig.workSeconds, 0);
        if (setIndex < setConfigs.size() - 1) {
          duration += Math.max(setConfig.restSeconds, 0);
        }
      }
      if (actionIndex < totalActions - 1) {
        duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
      }
    }
    return duration;
  }

  private int getPodEndingDurationSeconds(CourseScript course, CourseScript.Pod pod) {
    if (course == null || course.metadata == null || pod == null) {
      return 0;
    }

    if ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending)) {
      return Math.max(course.metadata.defaultHydrateSeconds, 0);
    }
    return 0;
  }

  private CourseScript.VideoGroup findVideoGroup(CourseScript course, String videoGroupId) {
    if (course == null || course.videoGroups == null || videoGroupId == null) {
      return null;
    }

    for (CourseScript.VideoGroup group : course.videoGroups) {
      if (group != null && videoGroupId.equals(group.id)) {
        return group;
      }
    }
    return null;
  }

  private CourseScript.VideoGroupScreen findVideoGroupScreen(
      CourseScript.VideoGroup group, int screenIndex) {
    if (group == null || group.screens == null) {
      return null;
    }

    for (CourseScript.VideoGroupScreen screen : group.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  private CourseScript.PodScreen findPodScreen(CourseScript.Pod pod, int screenIndex) {
    if (pod == null || pod.screens == null) {
      return null;
    }

    for (CourseScript.PodScreen screen : pod.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  private EffectivePodScreen materializePodScreen(
      CourseScript.Pod pod, CourseScript.VideoGroup group, int displayScreenIndex) {
    if (pod == null || group == null || group.screens == null || group.screens.isEmpty()) {
      return null;
    }

    if (group.screenCount <= 1) {
      CourseScript.PodScreen rule =
          pod.screens != null && !pod.screens.isEmpty() ? pod.screens.get(0) : null;
      CourseScript.VideoGroupScreen sourceScreen = group.screens.get(0);
      if (rule == null || sourceScreen == null) {
        return null;
      }
      return new EffectivePodScreen(displayScreenIndex, rule, sourceScreen, true);
    }

    CourseScript.PodScreen rule = findPodScreen(pod, displayScreenIndex);
    CourseScript.VideoGroupScreen sourceScreen = findVideoGroupScreen(group, displayScreenIndex);
    if (rule == null || sourceScreen == null) {
      return null;
    }
    return new EffectivePodScreen(displayScreenIndex, rule, sourceScreen, false);
  }

  private boolean safeEquals(String left, String right) {
    if (left == null) {
      return right == null;
    }
    return left.equals(right);
  }

  private void showPlaybackMessage(String countdown, String stageLabel, String hintText) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          activePlaybackItem == null ? null : activePlaybackItem.course,
          parseSafeInt(countdown),
          stageLabel == null || stageLabel.trim().isEmpty() ? "WAITING" : stageLabel,
          hintText,
          0,
          0);
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, true);
    hideFinishPanel();
    showPlaybackScroller();
    playbackCountdownText.setText(countdown);
    playbackStageLabel.setText(stageLabel);
    playbackStageProgress.setText("");
    renderStageMeta("", 0, 0);
    playbackHint.setText(hintText);
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    lastTrainingSignature = "";
  }

  private void showFinishState() {
    if (!finishCuePlayed) {
      playCueSound(CueSound.END);
      finishCuePlayed = true;
    }
    scheduleFinishReturn();
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalFinishState();
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(false, false);
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.GONE);
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    playbackScrollView.setVisibility(View.GONE);
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    if (finishPanel != null) {
      finishPanel.setVisibility(View.VISIBLE);
    }
    bindFinishContent(activePlaybackItem == null ? "" : activePlaybackItem.logoSource);
    lastTrainingSignature = "";
  }

  private void returnToScheduleListAfterFinish() {
    int screenNumber = activeScreenNumber;
    stopPlayback();
    if (screenNumber < 1 || screenNumber > 5) {
      showSelector();
      return;
    }

    applyResponsiveLayout();
    if (isVerticalCourseScreen(screenNumber)) {
      contentPanel.setBackgroundColor(getColor(R.color.tv_schedule_background));
      showScheduleChrome();
      showVerticalScheduleList();
      pageTitle.setText("今日课程表");
      pageSubtitle.setText(LocalDate.now().format(dateFormatter));
      bindScheduleItems(new ArrayList<>(syncedTodaySchedules));
      return;
    }

    contentPanel.setBackgroundColor(getColor(R.color.tv_playback_background));
    showHorizontalChrome();
    bindHorizontalSchedule(new ArrayList<>(syncedTodaySchedules));
  }

  private void hideFinishPanel() {
    cancelFinishReturn();
    finishLogoRequestKey = "";
    if (finishPanel != null) {
      finishPanel.setVisibility(View.GONE);
    }
    if (finishLogoImage != null) {
      finishLogoImage.setImageDrawable(null);
      finishLogoImage.setVisibility(View.GONE);
    }
    if (finishFallbackText != null) {
      finishFallbackText.setVisibility(View.GONE);
    }
  }

  private void bindFinishContent(String logoSource) {
    if (finishFallbackText == null || finishLogoImage == null) {
      return;
    }

    if (logoSource == null || logoSource.trim().isEmpty()) {
      showFinishFallback();
      return;
    }

    String requestKey = logoSource.trim();
    finishLogoRequestKey = requestKey;
    finishLogoImage.setImageDrawable(null);
    finishLogoImage.setVisibility(View.GONE);
    finishFallbackText.setVisibility(View.GONE);

    new Thread(
            () -> {
              Bitmap bitmap = loadBitmapFromSource(requestKey);
              runOnUiThread(
                  () -> {
                    if (!safeEquals(finishLogoRequestKey, requestKey)) {
                      return;
                    }

                    if (bitmap != null) {
                      finishLogoImage.setImageBitmap(bitmap);
                      finishLogoImage.setVisibility(View.VISIBLE);
                      setFinishTitleTopMargin(dp(18));
                      finishFallbackText.setVisibility(View.VISIBLE);
                    } else {
                      showFinishFallback();
                    }
                  });
            })
        .start();
  }

  private void showFinishFallback() {
    if (finishLogoImage != null) {
      finishLogoImage.setImageDrawable(null);
      finishLogoImage.setVisibility(View.GONE);
    }
    if (finishFallbackText != null) {
      setFinishTitleTopMargin(0);
      finishFallbackText.setText("CONGRATULATION");
      finishFallbackText.setVisibility(View.VISIBLE);
    }
  }

  private void setFinishTitleTopMargin(int topMargin) {
    if (finishFallbackText == null) {
      return;
    }

    ViewGroup.LayoutParams rawParams = finishFallbackText.getLayoutParams();
    if (!(rawParams instanceof ViewGroup.MarginLayoutParams)) {
      return;
    }

    ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) rawParams;
    if (params.topMargin == topMargin) {
      return;
    }
    params.topMargin = topMargin;
    finishFallbackText.setLayoutParams(params);
  }

  private Bitmap loadBitmapFromSource(String source) {
    if (source == null || source.trim().isEmpty()) {
      return null;
    }

    String normalized = source.trim();
    try {
      File localFile = new File(normalized);
      if (localFile.isFile()) {
        return BitmapFactory.decodeFile(localFile.getAbsolutePath());
      }

      HttpURLConnection connection = (HttpURLConnection) new URL(normalized).openConnection();
      connection.setConnectTimeout(6000);
      connection.setReadTimeout(12000);
      connection.setRequestMethod("GET");
      connection.setDoInput(true);

      int responseCode = connection.getResponseCode();
      if (responseCode < 200 || responseCode >= 300) {
        connection.disconnect();
        return null;
      }

      try (InputStream inputStream = new BufferedInputStream(connection.getInputStream())) {
        return BitmapFactory.decodeStream(inputStream);
      } finally {
        connection.disconnect();
      }
    } catch (Exception ignored) {
      return null;
    }
  }

  private void clearWaterfallRows() {
    for (WaterfallRowView row : waterfallRows) {
      stopWaterfallVideo(row);
    }
    waterfallRows.clear();
    warmupRowsContainer.removeAllViews();
    playbackScrollView.scrollTo(0, 0);
  }

  private void stopPlaybackLoop() {
    playbackLoopRunning = false;
    playbackHandler.removeCallbacks(playbackTicker);
    resetPlaybackStateCaches();
  }

  private void stopPlayback() {
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
    if (horizontalProgressRow != null) {
      horizontalProgressRow.removeAllViews();
    }
    configureVerticalPlaybackHeader(false);
    dispatchScreenHeartbeat(false);
  }

  private int getWaterfallTotalSeconds(CourseScript.WaterfallSection section) {
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
    stopPlayback();
    unregisterNetworkMonitoring();
    if (mqttManager != null) {
      mqttManager.disconnect();
    }
    releaseCueSounds();
    super.onDestroy();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private static class WaterfallRowView {
    final FrameLayout container;
    final VideoView videoView;
    final TextView placeholderText;
    final View dimOverlay;
    String boundUrl = "";
    CourseScript.WaterfallItem item;
    int itemIndex = -1;

    WaterfallRowView(
        FrameLayout container, VideoView videoView, TextView placeholderText, View dimOverlay) {
      this.container = container;
      this.videoView = videoView;
      this.placeholderText = placeholderText;
      this.dimOverlay = dimOverlay;
    }
  }

  private static class EffectivePodScreen {
    final int displayScreenIndex;
    final CourseScript.PodScreen rule;
    final CourseScript.VideoGroupScreen sourceScreen;
    final List<CourseScript.VideoCard> videoCards;
    final boolean waterfallLayout;

    EffectivePodScreen(
        int displayScreenIndex,
        CourseScript.PodScreen rule,
        CourseScript.VideoGroupScreen sourceScreen,
        boolean waterfallLayout) {
      this.displayScreenIndex = displayScreenIndex;
      this.rule = rule;
      this.sourceScreen = sourceScreen;
      this.waterfallLayout = waterfallLayout;
      this.videoCards =
          sourceScreen == null || sourceScreen.videoCards == null
              ? new ArrayList<>()
              : sourceScreen.videoCards;
    }
  }

  private static class HorizontalTimelineSegment {
    final int durationSeconds;

    HorizontalTimelineSegment(int durationSeconds) {
      this.durationSeconds = durationSeconds;
    }
  }

  private static class TrainingPlaybackState {
    final String renderKey;
    final String stageLabel;
    final String stageProgress;
    final String hintText;
    final int remainingSeconds;
    final List<CourseScript.VideoCard> displayCards;
    final int activeCardIndex;
    final boolean playActiveCard;
    final boolean waterfallLayout;
    final boolean messageOnly;
    final boolean fullScreenTransition;
    final String transitionType;
    final String stageSecondaryText;
    final int completedDots;
    final int totalDots;

    TrainingPlaybackState(
        String renderKey,
        String stageLabel,
        String stageProgress,
        String hintText,
        int remainingSeconds,
        List<CourseScript.VideoCard> displayCards,
        int activeCardIndex,
        boolean playActiveCard) {
      this(
          renderKey,
          stageLabel,
          stageProgress,
          hintText,
          remainingSeconds,
          displayCards,
          activeCardIndex,
          playActiveCard,
          false,
          false,
          false,
          "",
          "",
          0,
          0);
    }

    TrainingPlaybackState(
        String renderKey,
        String stageLabel,
        String stageProgress,
        String hintText,
        int remainingSeconds,
        List<CourseScript.VideoCard> displayCards,
        int activeCardIndex,
        boolean playActiveCard,
        boolean waterfallLayout,
        boolean messageOnly,
        boolean fullScreenTransition,
        String transitionType) {
      this(
          renderKey,
          stageLabel,
          stageProgress,
          hintText,
          remainingSeconds,
          displayCards,
          activeCardIndex,
          playActiveCard,
          waterfallLayout,
          messageOnly,
          fullScreenTransition,
          transitionType,
          "",
          0,
          0);
    }

    TrainingPlaybackState(
        String renderKey,
        String stageLabel,
        String stageProgress,
        String hintText,
        int remainingSeconds,
        List<CourseScript.VideoCard> displayCards,
        int activeCardIndex,
        boolean playActiveCard,
        boolean waterfallLayout,
        boolean messageOnly,
        boolean fullScreenTransition,
        String transitionType,
        String stageSecondaryText,
        int completedDots,
        int totalDots) {
      this.renderKey = renderKey;
      this.stageLabel = stageLabel;
      this.stageProgress = stageProgress;
      this.hintText = hintText;
      this.remainingSeconds = remainingSeconds;
      this.displayCards = displayCards;
      this.activeCardIndex = activeCardIndex;
      this.playActiveCard = playActiveCard;
      this.waterfallLayout = waterfallLayout;
      this.messageOnly = messageOnly;
      this.fullScreenTransition = fullScreenTransition;
      this.transitionType = transitionType == null ? "" : transitionType;
      this.stageSecondaryText = stageSecondaryText == null ? "" : stageSecondaryText;
      this.completedDots = completedDots;
      this.totalDots = totalDots;
    }
  }

  private enum PlaybackTheme {
    NORMAL,
    READY,
    MOVE_STATION,
    MOVE_ZONE,
    HYDRATE
  }

  private enum CueSound {
    WARM,
    COOL,
    DING,
    END
  }
}
