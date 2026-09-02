package com.infini.tv.diagnostics;

import static org.junit.Assert.*;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class DiagnosticQueueTest {
  @Rule public TemporaryFolder temp = new TemporaryFolder();
  private final AtomicLong now = new AtomicLong(1_788_000_000_000L);

  private Map<String, Object> identity() {
    Map<String, Object> values = new HashMap<>();
    values.put("deviceId", "TV-TEST01"); values.put("accountNamespace", "venue-test");
    values.put("screenNumber", 1); values.put("appVersion", "1.0.72");
    return values;
  }

  private JSONObject event() throws Exception {
    return DiagnosticEvent.create(DiagnosticEvent.Type.PLAYBACK_ERROR, "MEDIA_1_-1004",
        "Local video failed", null, Collections.singletonMap("mediaFile", "340.mp4"), identity(), now.get());
  }

  @Test public void redactsCredentialsAndSignedUrlsAndBoundsEvents() throws Exception {
    String secret = "https://user:pw@host.test/video.mp4?token=hidden#secret Bearer bearerValue password=private pairToken=pairSecret";
    String clean = DiagnosticEvent.redact(secret, 2048);
    assertTrue(clean.contains("https://host.test/video.mp4"));
    for (String value : new String[] {"hidden", "bearerValue", "private", "pairSecret", "user:pw", "#secret"}) {
      assertFalse(clean.contains(value));
    }
    assertEquals("hello", DiagnosticEvent.redact("hello world", 5));
    JSONObject record = DiagnosticEvent.create(DiagnosticEvent.Type.CRASH, "UNCAUGHT_JAVA_EXCEPTION",
        String.join("", Collections.nCopies(3000, "x")), new IOException(secret),
        Collections.singletonMap("endpoint", "https://host/api?token=hidden"), identity(), now.get());
    assertEquals(2048, record.getString("message").length());
    assertFalse(record.toString().contains("hidden"));
    assertTrue(record.getString("stackTrace").contains("IOException"));
    assertTrue(record.getString("occurredAt").endsWith("Z"));
  }

  @Test public void outboxSurvivesRestartAndExpiresBySaveTime() throws Exception {
    File root = temp.newFolder(); DiagnosticOutbox queue = new DiagnosticOutbox(root, now::get);
    JSONObject item = event().put("occurredAt", "2000-01-01T00:00:00Z");
    queue.save(item);
    DiagnosticOutbox restarted = new DiagnosticOutbox(root, now::get);
    assertEquals(1, restarted.pending().size());
    assertEquals(item.getString("id"), restarted.read(restarted.pending().get(0)).getString("id"));
    now.addAndGet(DiagnosticOutbox.RETENTION_MS - 1);
    assertEquals(1, restarted.pending().size());
    now.incrementAndGet(); assertTrue(restarted.pending().isEmpty());
  }

  @Test public void outboxCapsFileCountAndDeletesOldestNotForeignFiles() throws Exception {
    File root = temp.newFolder(); DiagnosticOutbox queue = new DiagnosticOutbox(root, now::get);
    File foreign = new File(root, "video.mp4"); Files.write(foreign.toPath(), new byte[] {1});
    JSONObject oldest = event(); queue.save(oldest);
    for (int i = 0; i < 140; i++) { now.incrementAndGet(); queue.save(event()); }
    assertEquals(DiagnosticOutbox.MAX_FILES, queue.pending().size());
    assertFalse(new File(root, oldest.getString("id") + ".jsonl").exists());
    assertTrue(foreign.exists());
  }

  @Test public void outboxCapsTotalBytesAndRejectsOversizeOrTraversal() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get);
    for (int i = 0; i < 60; i++) {
      now.incrementAndGet(); queue.save(event().put("message", String.join("", Collections.nCopies(45_000, "x"))));
    }
    assertTrue(queue.pending().stream().mapToLong(File::length).sum() <= DiagnosticOutbox.MAX_BYTES);
    assertTrue(queue.pending().size() < 60);
    assertThrows(IOException.class, () -> queue.save(event().put("id", "../../db.json")));
    assertThrows(IOException.class, () -> queue.save(event().put("message", String.join("", Collections.nCopies(50_000, "x")))));
  }

  @Test public void uploadDeletesOnlyAcknowledgedFilesAndRetriesWithoutChangingId() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get); queue.save(event());
    AtomicLong elapsed = new AtomicLong(1); AtomicInteger calls = new AtomicInteger();
    String id = queue.read(queue.pending().get(0)).getString("id");
    DiagnosticUploadPump pump = new DiagnosticUploadPump(queue, (file, record, token) -> {
      assertEquals(id, record.getString("id")); assertEquals("credential", token);
      return calls.incrementAndGet() == 1 ? 503 : 201;
    }, this::identity, () -> "credential", elapsed::get);
    pump.tick(); assertEquals(1, queue.pending().size());
    pump.tick(); assertEquals(1, calls.get());
    elapsed.addAndGet(30_000); pump.tick();
    assertEquals(2, calls.get()); assertTrue(queue.pending().isEmpty());
  }

  @Test public void timeoutAuthAndOldServerFailuresRemainQueuedWithCappedBackoff() throws Exception {
    for (int status : new int[] {403, 404, 429, 500}) {
      DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get); queue.save(event());
      AtomicLong elapsed = new AtomicLong(1); AtomicInteger calls = new AtomicInteger();
      DiagnosticUploadPump pump = new DiagnosticUploadPump(queue, (file, record, token) -> { calls.incrementAndGet(); return status; },
          this::identity, () -> "credential", elapsed::get);
      for (long delay : new long[] {30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000}) {
        pump.tick(); int count = calls.get();
        elapsed.addAndGet(delay - 1); pump.tick(); assertEquals(count, calls.get());
        elapsed.incrementAndGet();
      }
      assertEquals(1, queue.pending().size());
    }
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get); queue.save(event());
    new DiagnosticUploadPump(queue, (file, record, token) -> { throw new IOException("offline"); },
        this::identity, () -> "credential", () -> 0).tick();
    assertEquals(1, queue.pending().size());
  }

  @Test public void corruptOrRejectedFilesDoNotBlockNewLogs() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get); queue.save(event());
    Files.write(queue.pending().get(0).toPath(), "broken".getBytes(StandardCharsets.UTF_8));
    now.incrementAndGet(); queue.save(event());
    AtomicInteger calls = new AtomicInteger();
    new DiagnosticUploadPump(queue, (file, record, token) -> { calls.incrementAndGet(); return 400; },
        this::identity, () -> "credential", () -> 0).tick();
    assertEquals(1, calls.get()); assertTrue(queue.pending().isEmpty());
  }

  @Test public void unboundDeviceDoesNotUploadButStillCleansExpiredLogs() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get); queue.save(event());
    DiagnosticUploadPump pump = new DiagnosticUploadPump(queue, (file, record, token) -> { fail("must not upload"); return 200; },
        this::identity, () -> "", () -> 0);
    pump.tick(); assertEquals(1, queue.pending().size());
    now.addAndGet(DiagnosticOutbox.RETENTION_MS); pump.tick(); assertTrue(queue.pending().isEmpty());
  }

  @Test public void rebindDiscardsOldVenueLogAndLimitsUploadsPerTick() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get);
    queue.save(event().put("accountNamespace", "other-venue"));
    for (int i = 0; i < 8; i++) { now.incrementAndGet(); queue.save(event()); }
    AtomicInteger calls = new AtomicInteger();
    DiagnosticUploadPump pump = new DiagnosticUploadPump(queue, (file, record, token) -> { calls.incrementAndGet(); return 200; },
        this::identity, () -> "credential", () -> 0);
    pump.tick(); assertTrue(calls.get() <= 4); assertTrue(queue.pending().size() >= 4);
    pump.tick(); pump.tick(); assertTrue(queue.pending().isEmpty()); assertEquals(8, calls.get());
  }

  @Test public void crashHandlerWritesBeforeDelegatingEvenWhenLogWriteFails() throws Exception {
    DiagnosticOutbox queue = new DiagnosticOutbox(temp.newFolder(), now::get);
    AtomicInteger delegates = new AtomicInteger();
    Throwable fatal = new IllegalStateException("decoder failed");
    DiagnosticCrashHandler handler = new DiagnosticCrashHandler((thread, error) -> {
      try { queue.save(event()); } catch (Exception ignored) { fail(); }
    }, (thread, error) -> { assertSame(fatal, error); assertEquals(1, queue.pending().size()); delegates.incrementAndGet(); });
    handler.uncaughtException(Thread.currentThread(), fatal);
    new DiagnosticCrashHandler((thread, error) -> { throw new RuntimeException("disk failed"); },
        (thread, error) -> delegates.incrementAndGet()).uncaughtException(Thread.currentThread(), fatal);
    assertEquals(2, delegates.get());
  }
}
