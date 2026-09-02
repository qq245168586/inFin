package com.infini.tv.diagnostics;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.function.LongSupplier;
import org.json.JSONObject;

/** Private app files survive a crash; bounded storage never grows into the media cache. */
public final class DiagnosticOutbox {
  public static final long RETENTION_MS = 10L * 24 * 60 * 60 * 1000;
  public static final int MAX_FILES = 128;
  public static final long MAX_BYTES = 2L * 1024 * 1024;
  private final File root;
  private final LongSupplier now;

  public DiagnosticOutbox(File root, LongSupplier now) { this.root = root; this.now = now; }

  /** Atomically seals one small event file, also used synchronously by the crash handler. */
  public synchronized void save(JSONObject event) throws IOException {
    String id = event.optString("id");
    if (!id.matches("[a-f0-9-]{36}")) throw new IOException("Invalid diagnostic id");
    byte[] bytes = (event.toString() + "\n").getBytes(StandardCharsets.UTF_8);
    if (bytes.length > 48 * 1024) throw new IOException("Diagnostic event too large");
    if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Diagnostic directory unavailable");
    prune(bytes.length, 1);
    File temp = new File(root, id + ".tmp");
    try {
      try (FileOutputStream stream = new FileOutputStream(temp)) {
        stream.write(bytes);
        stream.getFD().sync();
      }
      if (!temp.renameTo(new File(root, id + ".jsonl"))) throw new IOException("Cannot seal diagnostic file");
      new File(root, id + ".jsonl").setLastModified(now.getAsLong());
    } finally { temp.delete(); }
  }

  /** Returns oldest pending files after TTL/quota cleanup; no file is removed on read. */
  public synchronized List<File> pending() {
    prune(0, 0);
    return list();
  }

  /** Reads bounded app-owned files; corrupted or oversized files cannot inflate heap usage. */
  public JSONObject read(File file) throws Exception {
    if (file.length() > 48 * 1024 || file.length() <= 0) throw new IOException("Invalid queued file");
    return new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
  }

  /** Drops only a file in this outbox after success, invalid data, or a binding change. */
  public synchronized void remove(File file) {
    if (file.getParentFile().equals(root)) file.delete();
  }

  /** Sorts the fixed-capacity queue without loading event bodies. */
  private List<File> list() {
    File[] files = root.listFiles(file -> file.isFile() && file.getName().matches("[a-f0-9-]{36}\\.jsonl"));
    if (files == null) return new ArrayList<>();
    Arrays.sort(files, Comparator.comparingLong(File::lastModified).thenComparing(File::getName));
    return new ArrayList<>(Arrays.asList(files));
  }

  /** Deletes expired/oldest owned files, including abandoned temporary writes after crashes. */
  private void prune(long reserveBytes, int reserveFiles) {
    long cutoff = now.getAsLong() - RETENTION_MS;
    File[] temps = root.listFiles(file -> file.getName().matches("[a-f0-9-]{36}\\.tmp"));
    if (temps != null) for (File temp : temps) temp.delete();
    List<File> files = list();
    long bytes = 0;
    for (File file : files) bytes += file.length();
    int count = files.size();
    for (File file : files) {
      if (file.lastModified() <= cutoff || count + reserveFiles > MAX_FILES || bytes + reserveBytes > MAX_BYTES) {
        long size = file.length();
        if (file.delete()) { bytes -= size; count--; }
      }
    }
  }
}
