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

abstract class MainActivitySessionInfrastructureController extends MainActivityInstallerAndAudioController {
  private static final long CURRENT_SESSION_MIN_INTERVAL_MS = 800L;
  private static final long CURRENT_SESSION_ERROR_BACKOFF_MS = 2000L;

  private long currentSessionLastRequestAtMs = 0L;
  private long currentSessionRetryBlockedUntilMs = 0L;
  private final Runnable delayedCurrentSessionRestoreRunnable =
      new Runnable() {
        @Override
        public void run() {
          final String queuedReason =
              TextUtils.isEmpty(pendingSessionRestoreReason)
                  ? "delayed_session_restore"
                  : pendingSessionRestoreReason;
          pendingSessionRestoreReason = "";
          requestCurrentPlaybackSession(queuedReason + "_delayed");
        }
      };

  protected Intent buildPackageInstallerIntent(Uri apkUri) {
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

  protected void appendKnownInstallerCandidates(
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

  protected ResolveInfo resolvePreferredInstaller(PackageManager packageManager, Intent intent) {
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

  protected String currentPlaybackState() {
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
      if (sessionDrivenPlayback && !TextUtils.isEmpty(activePlaybackSessionState)) {
        return activePlaybackSessionState;
      }
      return "RUNNING";
    }
    return "IDLE";
  }

  protected long resolveElapsedRealtimeForWallClock(long wallClockMs) {
    long nowElapsedRealtime = SystemClock.elapsedRealtime();
    if (wallClockMs <= 0L) {
      return nowElapsedRealtime;
    }
    return nowElapsedRealtime + (wallClockMs - System.currentTimeMillis());
  }

  protected long resolveElapsedRealtimeForServerWallClock(long wallClockMs, long serverNowMs) {
    long nowElapsedRealtime = SystemClock.elapsedRealtime();
    if (wallClockMs <= 0L) {
      return nowElapsedRealtime;
    }
    long effectiveServerNowMs =
        serverNowMs > 0L
            ? serverNowMs
            : (sessionServerNowBaseMs > 0L ? correctedServerNowMs() : System.currentTimeMillis());
    return nowElapsedRealtime + (wallClockMs - effectiveServerNowMs);
  }

  protected long currentPlaybackElapsedMs() {
    if (activePlaybackItem == null || previewMode) {
      return 0L;
    }
    if (sessionDrivenPlayback) {
      return currentSessionPlaybackElapsedMs();
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

  protected long correctedServerNowMs() {
    if (sessionServerNowBaseMs <= 0L || sessionServerNowBaseElapsedRealtimeMs <= 0L) {
      return System.currentTimeMillis();
    }
    return sessionServerNowBaseMs + Math.max(SystemClock.elapsedRealtime() - sessionServerNowBaseElapsedRealtimeMs, 0L);
  }

  protected long currentSessionPlaybackElapsedMs() {
    if (sessionServerStartAtMs <= 0L) {
      return 0L;
    }
    String state = activePlaybackSessionState == null ? "" : activePlaybackSessionState.toUpperCase(Locale.US);
    long effectiveNowMs;
    if ("PAUSED".equals(state) && sessionPausedAtMs > 0L) {
      effectiveNowMs = sessionPausedAtMs;
    } else if ("ENDED".equals(state) && sessionEndedAtMs > 0L) {
      effectiveNowMs = sessionEndedAtMs;
    } else if ("TERMINATED".equals(state) && sessionTerminatedAtMs > 0L) {
      effectiveNowMs = sessionTerminatedAtMs;
    } else {
      effectiveNowMs = correctedServerNowMs();
    }
    return Math.max(effectiveNowMs - sessionServerStartAtMs - Math.max(sessionPausedAccumulatedMs, 0L), 0L);
  }

  protected void dispatchScreenHeartbeat(boolean bind) {
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
    final int heartbeatSessionVersion = activePlaybackSessionVersion;
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
                      heartbeatSessionVersion,
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
                      heartbeatSessionVersion,
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

  protected void registerNetworkMonitoring() {
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
                  requestCurrentPlaybackSession("network_available");
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
                  requestCurrentPlaybackSession("network_capabilities");
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

  protected void unregisterNetworkMonitoring() {
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

  protected void scheduleScreenHeartbeat() {
    stopScreenHeartbeat();
    screenHeartbeatHandler.postDelayed(screenHeartbeatTicker, SCREEN_HEARTBEAT_INTERVAL_MS);
  }

  protected void syncBindingFromServer(TvScriptRepository.ScreenRegistration registration) {
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
    boolean selectorVisible = selectorPanel != null && selectorPanel.getVisibility() == View.VISIBLE;
    if (!accountChanged && !screenChanged && !selectorVisible) {
      applyHeartbeatSessionHint(registration);
      return;
    }

    activeAccountNamespace = serverNamespace;
    saveAccountNamespace(activeAccountNamespace);
    saveScreenNumber(serverScreenNumber);
    openScreen(serverScreenNumber, false);
  }

  protected void applyHeartbeatSessionHint(TvScriptRepository.ScreenRegistration registration) {
    if (registration == null || !registration.sessionOutdated) {
      return;
    }

    Log.d(
        TAG,
        "Heartbeat reported outdated playback session screen="
            + registration.screenNumber
            + " session="
            + (registration.session == null ? "" : registration.session.id)
            + " version="
            + (registration.session == null ? 0 : registration.session.version));
    requestCurrentPlaybackSession("heartbeat_session_outdated");
  }

  protected void markPendingSessionApply(String reason) {
    pendingSessionApplyAfterSync = true;
    pendingTerminalSessionApply = false;
    pendingSessionApplyReason =
        TextUtils.isEmpty(reason) ? "pending_session_after_sync" : reason;
  }

  protected void markPendingTerminalSessionApply(String reason, String playbackSessionId) {
    pendingSessionApplyAfterSync = false;
    pendingTerminalSessionApply = true;
    pendingSessionApplyReason =
        TextUtils.isEmpty(reason) ? "pending_terminal_after_sync" : reason;
    pendingTerminalPlaybackSessionId = playbackSessionId == null ? "" : playbackSessionId;
  }

  protected void clearPendingSessionApply() {
    pendingSessionApplyAfterSync = false;
    pendingTerminalSessionApply = false;
    pendingSessionApplyReason = "";
    pendingTerminalPlaybackSessionId = "";
  }

  protected boolean isTerminalPlaybackSessionState(String state) {
    if (state == null) {
      return false;
    }
    String normalized = state.trim().toUpperCase(Locale.US);
    return "TERMINATED".equals(normalized) || "ENDED".equals(normalized);
  }

  protected void requestCurrentPlaybackSession(String reason) {
    if (TextUtils.isEmpty(activeAccountNamespace)
        || activeScreenNumber < 1
        || activeScreenNumber > 5
        || selectorPanel == null
        || selectorPanel.getVisibility() == View.VISIBLE) {
      return;
    }
    final String requestReason =
        TextUtils.isEmpty(reason) ? "current_session_restore" : reason;
    if (sessionRestoreInFlight) {
      pendingSessionRestoreReason = requestReason;
      Log.d(TAG, "Playback session restore already in flight, queued reason=" + pendingSessionRestoreReason);
      return;
    }

    final long nowMs = SystemClock.elapsedRealtime();
    final long minIntervalDelayMs =
        Math.max(0L, CURRENT_SESSION_MIN_INTERVAL_MS - (nowMs - currentSessionLastRequestAtMs));
    final long backoffDelayMs = Math.max(0L, currentSessionRetryBlockedUntilMs - nowMs);
    final long delayMs = Math.max(minIntervalDelayMs, backoffDelayMs);
    if (delayMs > 0L) {
      pendingSessionRestoreReason = requestReason;
      syncHandler.removeCallbacks(delayedCurrentSessionRestoreRunnable);
      syncHandler.postDelayed(delayedCurrentSessionRestoreRunnable, delayMs);
      Log.d(
          TAG,
          "Playback session restore delayed reason="
              + requestReason
              + " delayMs="
              + delayMs);
      return;
    }

    final String requestAccountNamespace = activeAccountNamespace;
    final String requestDeviceId = deviceId;
    final int requestScreenNumber = activeScreenNumber;
    sessionRestoreInFlight = true;
    currentSessionLastRequestAtMs = nowMs;
    new Thread(
            () -> {
              boolean requestFailed = false;
              try {
                TvScriptRepository.CurrentPlaybackSession result =
                    repository.loadCurrentPlaybackSession(
                        requestAccountNamespace, requestDeviceId, requestScreenNumber);
                runOnUiThread(() -> applyCurrentPlaybackSession(result, requestReason));
              } catch (Exception error) {
                requestFailed = true;
                Log.d(TAG, "Current playback session unavailable reason=" + requestReason, error);
              } finally {
                final boolean failed = requestFailed;
                runOnUiThread(
                    () -> {
                      sessionRestoreInFlight = false;
                      if (failed) {
                        currentSessionRetryBlockedUntilMs =
                            Math.max(
                                currentSessionRetryBlockedUntilMs,
                                SystemClock.elapsedRealtime() + CURRENT_SESSION_ERROR_BACKOFF_MS);
                      } else {
                        currentSessionRetryBlockedUntilMs = 0L;
                      }
                      final String queuedReason = pendingSessionRestoreReason;
                      pendingSessionRestoreReason = "";
                      if (!TextUtils.isEmpty(queuedReason)) {
                        requestCurrentPlaybackSession(queuedReason + "_after_inflight");
                      }
                    });
              }
            })
        .start();
  }
}
