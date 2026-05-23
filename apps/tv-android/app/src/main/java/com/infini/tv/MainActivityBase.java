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

abstract class MainActivityBase extends MainActivityContracts {
  protected static final String TAG = "InfiniTv";
  protected static final String EXTRA_SCREEN_NUMBER = "screenNumber";
  protected static final String EXTRA_AUTO_START_FIRST_SCHEDULE = "autoStartFirstSchedule";
  protected static final long CHECKSUM_POLL_INTERVAL_MS = 5 * 60 * 1000L;
  protected static final long SCREEN_HEARTBEAT_INTERVAL_MS = 15 * 1000L;
  protected static final long PAIRING_PRESENCE_INTERVAL_MS = 10 * 1000L;
  protected static final long FINISH_RETURN_DELAY_MS = 60 * 1000L;
  protected static final int WARMUP_READY_SECONDS = 15;
  protected static final int TRAINING_READY_SECONDS = 15;
  protected static final int COOLDOWN_READY_SECONDS = 10;
  protected static final String PREFS_NAME = "infini_tv_app";
  protected static final String PREF_DEVICE_ID = "device_id";
  protected static final String PREF_SCREEN_NUMBER = "screen_number";
  protected static final String PREF_ACCOUNT_NAMESPACE = "account_namespace";
  protected static final String PREF_PAIR_TOKEN = "pair_token";
  protected TvScriptRepository repository;
  protected TvMqttManager mqttManager;
  protected final DateTimeFormatter dateFormatter =
      DateTimeFormatter.ofPattern("yyyy.MM.dd  EEEE", Locale.CHINA);
  protected ConnectivityManager connectivityManager;
  protected ConnectivityManager.NetworkCallback networkCallback;
  protected final Runnable playbackTicker =
      new Runnable() {
        @Override
        public void run() {
          if (!playbackLoopRunning) {
            return;
          }
          refreshPlayback();
          if (playbackLoopRunning) {
            playbackHandler.postDelayed(this, nextPlaybackTickDelayMs());
          }
        }
      };
  protected final Runnable finishReturnTicker =
      new Runnable() {
        @Override
        public void run() {
          returnToScheduleListAfterFinish();
        }
      };
  protected final Runnable checksumTicker =
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
  protected final Runnable screenHeartbeatTicker =
      new Runnable() {
        @Override
        public void run() {
          dispatchScreenHeartbeat(false);
          scheduleScreenHeartbeat();
        }
      };
  protected final Runnable pairingPresenceTicker =
      new Runnable() {
        @Override
        public void run() {
          if (mqttManager != null && selectorPanel != null && selectorPanel.getVisibility() == View.VISIBLE) {
            mqttManager.publishPairingPresence(deviceId, currentPairToken);
            pairingPresenceHandler.postDelayed(this, PAIRING_PRESENCE_INTERVAL_MS);
          }
        }
      };
  protected View selectorPanel;
  protected LinearLayout contentPanel;
  protected View contentTopBar;
  protected View pageDividerRow;
  protected View verticalSchedulePanel;
  protected View verticalPlaybackPanel;
  protected View horizontalPlaceholderPanel;
  protected View horizontalPlaybackPanel;
  protected View getReadyPanel;
  protected View finishPanel;
  protected View updatePanel;
  protected FrameLayout coursePlanPanel;
  protected View updateCard;
  protected View playbackTimerCard;
  protected View playbackStageCard;
  protected ScrollView scheduleScrollView;
  protected ScrollView playbackScrollView;
  protected View playbackStatusGroup;
  protected TextView pageTitle;
  protected TextView pageSubtitle;
  protected TextView screenTag;
  protected TextView screenDeviceMetaText;
  protected TextView selectorDeviceIdText;
  protected TextView selectorPairCodeText;
  protected TextView selectorPairHintText;
  protected ImageView selectorQrImage;
  protected TextView horizontalTitle;
  protected TextView horizontalCopy;
  protected TextView horizontalLoadingText;
  protected ScrollView horizontalScheduleScroll;
  protected View horizontalSchedulePanel;
  protected TextView horizontalScheduleTitle;
  protected TextView horizontalScheduleSubtitle;
  protected LinearLayout horizontalScheduleList;
  protected TextView playbackCountdownText;
  protected TextView playbackStageLabel;
  protected TextView playbackStageProgress;
  protected TextView playbackStageSecondary;
  protected LinearLayout playbackStageDotsRow;
  protected View horizontalContentPanel;
  protected View horizontalTransitionPanel;
  protected View transitionDesignPanel;
  protected ImageView transitionDesignIcon;
  protected View transitionDesignRingContainer;
  protected com.infini.tv.ui.RingProgressView transitionDesignRing;
  protected TextView transitionDesignCountdown;
  protected TextView transitionDesignTitle;
  protected TextView transitionDesignSubtitle;
  protected TextView transitionDesignLogo;
  protected FrameLayout switchTransitionDiagram;
  protected String transitionDesignProgressKey = "";
  protected int transitionDesignTotalSeconds = 0;
  protected View horizontalRingContainer;
  protected View horizontalStateColumn;
  protected View horizontalTransitionCircle;
  protected TextView horizontalCountdownText;
  protected com.infini.tv.ui.RingProgressView horizontalRingProgress;
  protected ImageView horizontalStateIcon;
  protected TextView horizontalStateText;
  protected TextView horizontalStateSecondary;
  protected LinearLayout horizontalStateDotsRow;
  protected LinearLayout horizontalProgressRow;
  protected TextView horizontalLogoText;
  protected TextView horizontalTransitionCountdownText;
  protected TextView horizontalTransitionTitle;
  protected TextView horizontalTransitionHint;
  protected ImageView horizontalTransitionIcon;
  protected TextView playbackHint;
  protected TextView getReadyCountdownText;
  protected TextView getReadyLabelText;
  protected TextView getReadySubtext;
  protected View getReadyCircle;
  protected TextView finishFallbackText;
  protected TextView updateTitleText;
  protected TextView updateVersionText;
  protected TextView updateStatusText;
  protected TextView updateProgressText;
  protected TextView scheduleStateText;
  protected ImageView finishLogoImage;
  protected ProgressBar updateProgressBar;
  protected View updateActionRow;
  protected View updateActionSpacer;
  protected Button updatePermissionButton;
  protected Button updateManualInstallButton;
  protected LinearLayout scheduleList;
  protected LinearLayout warmupRowsContainer;
  protected LinearLayout trainingCardsContainer;
  protected int activeScreenNumber = 0;
  protected boolean launchAutoStartFirstSchedule = false;
  protected TvScheduleItem activePlaybackItem;
  protected int lastWaterfallIndex = -1;
  protected int lastWaterfallWindowStart = -1;
  protected String lastPlaybackMode = "";
  protected String lastTrainingSignature = "";
  protected String lastWaterfallSignature = "";
  protected String finishLogoRequestKey = "";
  protected String currentBundleChecksum = "";
  protected String deviceId = "";
  protected String activeAccountNamespace = "";
  protected String currentPairToken = "";
  protected boolean syncInProgress = false;
  protected boolean lastScheduleSyncFailed = false;
  protected boolean resourceCacheDirty = false;
  protected int currentBundleScheduleCount = -1;
  protected long lastNetworkRecoverySyncAtMs = 0L;
  protected volatile boolean screenHeartbeatInFlight = false;
  protected boolean previewMode = false;
  protected boolean playbackPaused = false;
  protected long playbackStartElapsedRealtimeMs = 0L;
  protected long accumulatedPauseElapsedRealtimeMs = 0L;
  protected long pauseStartedElapsedRealtimeMs = 0L;
  protected long frozenElapsedMs = 0L;
  protected String activePlaybackSessionId = "";
  protected int activePlaybackSessionVersion = 0;
  protected String activePlaybackSessionState = "";
  protected boolean sessionDrivenPlayback = false;
  protected long sessionServerNowBaseMs = 0L;
  protected long sessionServerNowBaseElapsedRealtimeMs = 0L;
  protected long sessionServerStartAtMs = 0L;
  protected long sessionPausedAccumulatedMs = 0L;
  protected long sessionPausedAtMs = 0L;
  protected long sessionEndedAtMs = 0L;
  protected long sessionTerminatedAtMs = 0L;
  protected boolean sessionRestoreInFlight = false;
  protected String activeBundleChecksum = "";
  protected String currentUpdateState = "IDLE";
  protected String currentUpdateTargetVersion = "";
  protected int currentUpdateProgressPercent = 0;
  protected String currentUpdateMessage = "";
  protected File lastDownloadedUpdateApkFile;
  protected String lastDownloadedUpdateVersion = "";
  protected int currentCourseElapsedSeconds = 0;
  protected int currentCourseTotalSeconds = 0;
  protected int currentTrainingElapsedSeconds = 0;
  protected int currentTrainingTotalSeconds = 0;
  protected String horizontalRingProgressKey = "";
  protected int horizontalRingTotalSeconds = 0;
  protected boolean playbackLoopRunning = false;
  protected SoundPool cueSoundPool;
  protected int warmCueSoundId = 0;
  protected int coolCueSoundId = 0;
  protected int dingCueSoundId = 0;
  protected int activeCueStreamId = 0;
  protected String lastCuePlaybackKey = "";
  protected String lastWaterfallAudioMode = "";
  protected int lastWaterfallAudioIndex = -1;
  protected String lastTrainingAudioRenderKey = "";
  protected String lastTrainingAudioPhase = "";
  protected final DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
  protected final Handler playbackHandler = new Handler(Looper.getMainLooper());
  protected final Handler syncHandler = new Handler(Looper.getMainLooper());
  protected final Handler screenHeartbeatHandler = new Handler(Looper.getMainLooper());
  protected final Handler pairingPresenceHandler = new Handler(Looper.getMainLooper());
  protected final List<WaterfallRowView> waterfallRows = new ArrayList<>();
  protected final List<TvScheduleItem> syncedTodaySchedules = new ArrayList<>();
  protected final Set<Integer> loadedCueSoundIds = new HashSet<>();

  protected long nextPlaybackTickDelayMs() {
    long nowElapsedRealtime = SystemClock.elapsedRealtime();
    long anchorElapsedRealtimeMs = 0L;
    long pauseOffsetMs = 0L;
    if (!previewMode && activePlaybackItem != null && !playbackPaused) {
      if (sessionDrivenPlayback
          && sessionServerStartAtMs > 0L
          && sessionServerNowBaseMs > 0L
          && sessionServerNowBaseElapsedRealtimeMs > 0L) {
        anchorElapsedRealtimeMs =
            sessionServerNowBaseElapsedRealtimeMs + (sessionServerStartAtMs - sessionServerNowBaseMs);
        pauseOffsetMs = Math.max(sessionPausedAccumulatedMs, 0L);
      } else if (playbackStartElapsedRealtimeMs > 0L) {
        anchorElapsedRealtimeMs = playbackStartElapsedRealtimeMs;
        pauseOffsetMs = Math.max(accumulatedPauseElapsedRealtimeMs, 0L);
      }
    }
    if (anchorElapsedRealtimeMs > 0L) {
      long adjustedAnchorMs = anchorElapsedRealtimeMs + pauseOffsetMs;
      if (nowElapsedRealtime < adjustedAnchorMs) {
        long untilStartMs = adjustedAnchorMs - nowElapsedRealtime + 16L;
        return Math.max(16L, Math.min(untilStartMs, 1024L));
      }
      long elapsedSinceAnchorMs = Math.max(nowElapsedRealtime - adjustedAnchorMs, 0L);
      long anchorRemainder = elapsedSinceAnchorMs % 1000L;
      long anchorDelayMs = 1000L - anchorRemainder + 24L;
      if (anchorDelayMs < 90L) {
        anchorDelayMs += 1000L;
      }
      return Math.max(90L, Math.min(anchorDelayMs, 1024L));
    }
    long elapsedMs = Math.max(currentPlaybackElapsedMs(), 0L);
    long remainder = elapsedMs % 1000L;
    long delayMs = 1000L - remainder + 24L;
    if (delayMs < 90L) {
      delayMs += 1000L;
    }
    return Math.max(90L, Math.min(delayMs, 1024L));
  }
}
