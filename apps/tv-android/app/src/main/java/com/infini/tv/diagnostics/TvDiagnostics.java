package com.infini.tv.diagnostics;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import com.infini.tv.BuildConfig;
import com.infini.tv.repository.DiagnosticUploadClient;
import java.io.File;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/** Single application-scoped facade. Playback/request sites emit events, never HTTP uploads. */
public final class TvDiagnostics {
  private static volatile TvDiagnostics instance;
  private final SharedPreferences preferences;
  private final DiagnosticOutbox outbox;
  private final ScheduledThreadPoolExecutor worker = new ScheduledThreadPoolExecutor(1);
  private final Semaphore pendingWrites = new Semaphore(64);
  private final Map<String, Long> recent = new LinkedHashMap<>();
  private volatile Map<String, Object> playback = new HashMap<>();

  private TvDiagnostics(Context context) {
    preferences = context.getSharedPreferences("infini_tv_app", Context.MODE_PRIVATE);
    outbox = new DiagnosticOutbox(new File(context.getFilesDir(), "tv-diagnostic-outbox"), System::currentTimeMillis);
  }

  /** Installs once before Activity startup so startup crashes can be captured too. */
  public static synchronized void initialize(Context context) {
    if (instance != null) return;
    try {
      TvDiagnostics reporter = new TvDiagnostics(context.getApplicationContext());
      instance = reporter;
      Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
      if (previous == null) previous = (thread, error) -> {
        android.os.Process.killProcess(android.os.Process.myPid());
        System.exit(10);
      };
      Thread.setDefaultUncaughtExceptionHandler(new DiagnosticCrashHandler(reporter::saveCrash, previous));
      DiagnosticUploadPump pump = new DiagnosticUploadPump(reporter.outbox, new DiagnosticUploadClient(),
          reporter::identity, () -> reporter.preferences.getString("pair_token", ""), SystemClock::elapsedRealtime);
      reporter.worker.scheduleWithFixedDelay(() -> {
        try { pump.tick(); } catch (Throwable ignored) { }
      }, 15, 30, TimeUnit.SECONDS);
    } catch (Throwable ignored) { /* Diagnostics must never prevent the app from starting. */ }
  }

  /** Copies the latest session snapshot; never retains an Activity or View. */
  public static void updatePlayback(String scheduleId, String sessionId, String state, int version) {
    TvDiagnostics reporter = instance;
    if (reporter == null) return;
    Map<String, Object> values = new HashMap<>();
    values.put("scheduleId", scheduleId == null ? "" : scheduleId);
    values.put("sessionId", sessionId == null ? "" : sessionId);
    values.put("playbackState", state == null ? "" : state);
    values.put("sessionVersion", version);
    reporter.playback = values;
  }

  /** Enqueues a bounded write without blocking the caller on disk or network. */
  public static void report(DiagnosticEvent.Type type, String code, String message,
      Throwable error, Map<String, Object> details) {
    TvDiagnostics reporter = instance;
    if (reporter == null) return;
    try { reporter.enqueue(type, code, message, error, details); } catch (Throwable ignored) { }
  }

  /** Limits repeated errors and pending writes independently from the on-disk queue. */
  private void enqueue(DiagnosticEvent.Type type, String code, String message, Throwable error, Map<String, Object> details) {
    Map<String, Object> context = context(details);
    String fingerprint = type + "|" + code + "|" + context.get("endpoint") + "|" + context.get("mediaFile")
        + "|" + context.get("sessionId");
    long now = SystemClock.elapsedRealtime();
    synchronized (recent) {
      Long last = recent.get(fingerprint);
      if (last != null && now - last < 60_000L) return;
      if (recent.size() >= 128) recent.remove(recent.keySet().iterator().next());
      recent.put(fingerprint, now);
    }
    Map<String, Object> identity = identity();
    long occurredAt = System.currentTimeMillis();
    if (!pendingWrites.tryAcquire()) return;
    try {
      worker.execute(() -> {
        try { outbox.save(DiagnosticEvent.create(type, code, message, error, context, identity, occurredAt)); }
        catch (Throwable ignored) { }
        finally { pendingWrites.release(); }
      });
    } catch (RuntimeException rejected) { pendingWrites.release(); }
  }

  /** Best-effort bounded crash write is synchronous, but uploads wait for the next process. */
  private void saveCrash(Thread thread, Throwable error) {
    try {
      Map<String, Object> details = new HashMap<>();
      details.put("thread", thread.getName());
      outbox.save(DiagnosticEvent.create(DiagnosticEvent.Type.CRASH, "UNCAUGHT_JAVA_EXCEPTION",
          error.getClass().getName(), error, context(details), identity(), System.currentTimeMillis()));
    } catch (Throwable ignored) { }
  }

  /** Snapshots non-secret binding data at occurrence time; credentials are never written to disk. */
  private Map<String, Object> identity() {
    Map<String, Object> result = new HashMap<>();
    result.put("deviceId", preferences.getString("device_id", ""));
    result.put("accountNamespace", preferences.getString("account_namespace", ""));
    result.put("screenNumber", preferences.getInt("screen_number", 0));
    result.put("appVersion", BuildConfig.VERSION_NAME);
    return result;
  }

  /** Adds only diagnostic context, never course scripts or member information. */
  private Map<String, Object> context(Map<String, Object> details) {
    Map<String, Object> result = new HashMap<>(playback);
    result.put("androidVersion", Build.VERSION.RELEASE);
    result.put("model", Build.MANUFACTURER + " " + Build.MODEL);
    if (details != null) result.putAll(details);
    return result;
  }
}
