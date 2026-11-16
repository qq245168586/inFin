package com.infini.tv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.Log;
import com.infini.tv.repository.TvScriptRepository;
import java.util.Locale;
import java.util.UUID;

public class KeepAliveService extends Service {
  private static final String TAG = "InfiniTvKeepAlive";
  private static final String CHANNEL_ID = "infini_tv_keep_alive";
  private static final int NOTIFICATION_ID = 2045;
  private static final long CHECK_INTERVAL_MS = 15 * 1000L;
  private static final long ACTIVITY_STALE_MS = 35 * 1000L;
  private static final long RELAUNCH_INTERVAL_MS = 30 * 1000L;

  private static volatile long lastActivityVisibleElapsedMs = 0L;
  private static volatile boolean activityVisible = false;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private TvScriptRepository repository;
  private boolean heartbeatInFlight = false;
  private long lastRelaunchElapsedMs = 0L;

  private final Runnable watchdogTicker =
      new Runnable() {
        @Override
        public void run() {
          checkMainActivity();
          handler.postDelayed(this, CHECK_INTERVAL_MS);
        }
      };

  public static void start(Context context) {
    if (context == null) {
      return;
    }
    Intent intent = new Intent(context.getApplicationContext(), KeepAliveService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.getApplicationContext().startForegroundService(intent);
    } else {
      context.getApplicationContext().startService(intent);
    }
  }

  public static void markActivityVisible() {
    activityVisible = true;
    lastActivityVisibleElapsedMs = SystemClock.elapsedRealtime();
  }

  public static void markActivityHidden() {
    activityVisible = false;
    lastActivityVisibleElapsedMs = SystemClock.elapsedRealtime();
  }

  @Override
  public void onCreate() {
    super.onCreate();
    repository = new TvScriptRepository(this);
    startAsForeground();
    handler.post(watchdogTicker);
    Log.d(TAG, "Keep alive service started");
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startAsForeground();
    return START_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(watchdogTicker);
    Log.w(TAG, "Keep alive service destroyed");
    super.onDestroy();
  }

  private void startAsForeground() {
    createNotificationChannel();
    Notification notification = buildNotification();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  private Notification buildNotification() {
    Intent launchIntent = new Intent(this, MainActivity.class);
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pendingIntent =
        PendingIntent.getActivity(
            this,
            2045,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE
                    : 0));

    Notification.Builder builder =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
    return builder
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Infini TV")
        .setContentText("TV app is running")
        .setContentIntent(pendingIntent)
        .setOngoing(true)
        .setShowWhen(false)
        .build();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
      return;
    }
    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_ID,
            "Infini TV Keep Alive",
            NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Keeps the TV app available for class playback.");
    manager.createNotificationChannel(channel);
  }

  private void checkMainActivity() {
    long now = SystemClock.elapsedRealtime();
    boolean recentlyVisible =
        activityVisible || (lastActivityVisibleElapsedMs > 0L && now - lastActivityVisibleElapsedMs < ACTIVITY_STALE_MS);
    if (recentlyVisible) {
      return;
    }

    dispatchRecoveryHeartbeat();
    if (now - lastRelaunchElapsedMs < RELAUNCH_INTERVAL_MS) {
      return;
    }
    lastRelaunchElapsedMs = now;
    launchMainActivity();
  }

  private void launchMainActivity() {
    try {
      Intent intent = new Intent(this, MainActivity.class);
      intent.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK
              | Intent.FLAG_ACTIVITY_CLEAR_TOP
              | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      startActivity(intent);
      Log.w(TAG, "MainActivity was stale, requested relaunch");
    } catch (Exception error) {
      Log.e(TAG, "Failed to relaunch MainActivity", error);
    }
  }

  private void dispatchRecoveryHeartbeat() {
    if (heartbeatInFlight || repository == null) {
      return;
    }
    heartbeatInFlight = true;
    new Thread(
            () -> {
              try {
                SharedPreferences preferences =
                    getSharedPreferences(MainActivityBase.PREFS_NAME, MODE_PRIVATE);
                String deviceId = ensureDeviceId(preferences);
                int screenNumber =
                    Math.max(0, preferences.getInt(MainActivityBase.PREF_SCREEN_NUMBER, 0));
                String accountNamespace =
                    trimAccountNamespace(
                        preferences.getString(MainActivityBase.PREF_ACCOUNT_NAMESPACE, ""));
                String pairToken =
                    TextUtils.isEmpty(accountNamespace)
                        ? ensurePairToken(preferences)
                        : "";
                repository.sendScreenHeartbeat(
                    accountNamespace,
                    deviceId,
                    screenNumber,
                    pairToken,
                    buildMqttClientId(deviceId),
                    resolveAppVersion(),
                    "APP_RECOVERING",
                    "",
                    false,
                    "",
                    0,
                    "",
                    0L,
                    "IDLE",
                    "",
                    0,
                    "");
                Log.d(TAG, "Recovery heartbeat sent screen=" + screenNumber);
              } catch (Exception error) {
                Log.w(TAG, "Recovery heartbeat failed", error);
              } finally {
                heartbeatInFlight = false;
              }
            })
        .start();
  }

  private String ensureDeviceId(SharedPreferences preferences) {
    String existing = preferences.getString(MainActivityBase.PREF_DEVICE_ID, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated =
        "TV-"
            + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 8)
                .toUpperCase(Locale.US);
    preferences.edit().putString(MainActivityBase.PREF_DEVICE_ID, generated).apply();
    return generated;
  }

  private String ensurePairToken(SharedPreferences preferences) {
    String existing = preferences.getString(MainActivityBase.PREF_PAIR_TOKEN, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated =
        UUID.randomUUID()
            .toString()
            .replace("-", "")
            .substring(0, 8)
            .toUpperCase(Locale.US);
    preferences.edit().putString(MainActivityBase.PREF_PAIR_TOKEN, generated).apply();
    return generated;
  }

  private String buildMqttClientId(String deviceId) {
    String compact =
        (deviceId == null ? "" : deviceId)
            .replaceAll("[^A-Za-z0-9]", "")
            .toLowerCase(Locale.US);
    return compact.isEmpty() ? "tv-unknown" : "tv-" + compact;
  }

  private String trimAccountNamespace(String accountNamespace) {
    return accountNamespace == null ? "" : accountNamespace.trim().toLowerCase(Locale.US);
  }

  private String resolveAppVersion() {
    try {
      PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
      return packageInfo == null ? "" : packageInfo.versionName;
    } catch (PackageManager.NameNotFoundException ignored) {
      return "";
    }
  }
}
