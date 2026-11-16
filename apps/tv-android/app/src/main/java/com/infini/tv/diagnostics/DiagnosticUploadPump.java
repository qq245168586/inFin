package com.infini.tv.diagnostics;

import java.io.File;
import java.util.Map;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.json.JSONObject;

/** One background lane with bounded work and monotonic retry deadlines. */
public final class DiagnosticUploadPump {
  public interface Transport { int upload(File file, JSONObject event, String pairToken) throws Exception; }
  private final DiagnosticOutbox outbox;
  private final Transport transport;
  private final Supplier<Map<String, Object>> identity;
  private final Supplier<String> token;
  private final LongSupplier clock;
  private long nextAttemptAt;
  private int failures;

  public DiagnosticUploadPump(DiagnosticOutbox outbox, Transport transport,
      Supplier<Map<String, Object>> identity, Supplier<String> token, LongSupplier clock) {
    this.outbox = outbox; this.transport = transport; this.identity = identity; this.token = token; this.clock = clock;
  }

  /** Makes at most four uploads per tick; uploader errors never feed back into the reporter. */
  public void tick() {
    java.util.List<File> pending = outbox.pending();
    if (clock.getAsLong() < nextAttemptAt) return;
    Map<String, Object> current = identity.get();
    String pairToken = token.get();
    if (pairToken == null || pairToken.isEmpty() || String.valueOf(current.get("accountNamespace")).isEmpty()) return;
    int attempted = 0;
    for (File file : pending) {
      if (attempted++ >= 4) break;
      JSONObject event;
      try { event = outbox.read(file); }
      catch (Exception invalid) { outbox.remove(file); continue; }
      if (!sameBinding(event, current)) { outbox.remove(file); continue; }
      try {
        int status = transport.upload(file, event, pairToken);
        if (status >= 200 && status < 300) {
          outbox.remove(file);
          failures = 0;
        } else if (status == 400 || status == 409 || status == 413 || status == 415) {
          outbox.remove(file);
        } else { backoff(); break; }
      } catch (Exception unavailable) { backoff(); break; }
    }
  }

  /** Keeps crash files attributed to their original venue instead of a later rebind. */
  private boolean sameBinding(JSONObject event, Map<String, Object> current) {
    return event.optString("deviceId").equals(String.valueOf(current.get("deviceId")))
        && event.optString("accountNamespace").equals(String.valueOf(current.get("accountNamespace")))
        && event.optInt("screenNumber") == ((Number) current.get("screenNumber")).intValue();
  }

  /** Caps failure retries at one attempt per ten minutes, with no blocking sleep. */
  private void backoff() {
    failures = Math.min(failures + 1, 6);
    nextAttemptAt = clock.getAsLong() + Math.min(30_000L << (failures - 1), 600_000L);
  }
}
