package com.infini.tv.repository;

import android.content.Context;
import android.os.Environment;
import android.util.Log;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import java.io.BufferedOutputStream;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import okhttp3.ConnectionSpec;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

abstract class TvScriptRepositoryTypes {
  protected static final String TAG = "TvRepository";
  public interface SyncProgressListener {
    void onStatus(String message, int completed, int total);
  }
  public interface AppPackageProgressListener {
    void onProgress(String message, int progressPercent);
  }
  public static class AppPackageInfo {
    public final String id;
    public final String version;
    public final String label;
    public final String filename;
    public final String downloadPath;
    public final String checksum;
    public final long sizeBytes;
    public final String updateTime;

    public AppPackageInfo(
        String id,
        String version,
        String label,
        String filename,
        String downloadPath,
        String checksum,
        long sizeBytes,
        String updateTime) {
      this.id = id == null ? "" : id;
      this.version = version == null ? "" : version;
      this.label = label == null ? "" : label;
      this.filename = filename == null ? "" : filename;
      this.downloadPath = downloadPath == null ? "" : downloadPath;
      this.checksum = checksum == null ? "" : checksum;
      this.sizeBytes = Math.max(sizeBytes, 0L);
      this.updateTime = updateTime == null ? "" : updateTime;
    }
  }
  public static class SyncResult {
    public final String date;
    public final String checksum;
    public final int resourceCount;
    public final List<TvScheduleItem> schedules;
    public final boolean resourcesCached;
    public SyncResult(String date, String checksum, int resourceCount, List<TvScheduleItem> schedules) {
      this(date, checksum, resourceCount, schedules, true);
    }
    public SyncResult(
        String date,
        String checksum,
        int resourceCount,
        List<TvScheduleItem> schedules,
        boolean resourcesCached) {
      this.date = date;
      this.checksum = checksum;
      this.resourceCount = resourceCount;
      this.schedules = schedules;
      this.resourcesCached = resourcesCached;
    }
  }
  public static class DailyChecksum {
    public final String date;
    public final String checksum;
    public final int scheduleCount;
    public final List<TvScheduleItem> schedules;
    public DailyChecksum(String date, String checksum, int scheduleCount) {
      this(date, checksum, scheduleCount, new ArrayList<>());
    }
    public DailyChecksum(
        String date, String checksum, int scheduleCount, List<TvScheduleItem> schedules) {
      this.date = date;
      this.checksum = checksum;
      this.scheduleCount = scheduleCount;
      this.schedules = schedules == null ? new ArrayList<>() : schedules;
    }
  }
  public static class CacheStats {
    public final long totalBytes;
    public final int fileCount;
    public final String updatedAt;
    public CacheStats(long totalBytes, int fileCount, String updatedAt) {
      this.totalBytes = totalBytes;
      this.fileCount = fileCount;
      this.updatedAt = updatedAt;
    }
  }
  public static class ScreenRegistration {
    public final String accountNamespace;
    public final int screenNumber;
    public final String deviceId;
    public final boolean online;
    public final long serverNowMs;
    public final boolean sessionOutdated;
    public final PlaybackSessionSnapshot session;

    public ScreenRegistration(String accountNamespace, int screenNumber, String deviceId, boolean online) {
      this(accountNamespace, screenNumber, deviceId, online, 0L, false, null);
    }

    public ScreenRegistration(
        String accountNamespace,
        int screenNumber,
        String deviceId,
        boolean online,
        long serverNowMs,
        boolean sessionOutdated,
        PlaybackSessionSnapshot session) {
      this.accountNamespace = accountNamespace == null ? "" : accountNamespace;
      this.screenNumber = screenNumber;
      this.deviceId = deviceId == null ? "" : deviceId;
      this.online = online;
      this.serverNowMs = serverNowMs;
      this.sessionOutdated = sessionOutdated;
      this.session = session;
    }
  }
  public static class PlaybackSessionSnapshot {
    public final String id;
    public final String state;
    public final int version;
    public final String scheduleId;
    public final int courseId;
    public final String bundleChecksum;
    public final long serverStartAtMs;
    public final long pausedAccumulatedMs;
    public final long pausedAtMs;
    public final long endedAtMs;
    public final long terminatedAtMs;
    public PlaybackSessionSnapshot(
        String id,
        String state,
        int version,
        String scheduleId,
        int courseId,
        String bundleChecksum,
        long serverStartAtMs,
        long pausedAccumulatedMs,
        long pausedAtMs,
        long endedAtMs,
        long terminatedAtMs) {
      this.id = id == null ? "" : id;
      this.state = state == null ? "" : state;
      this.version = version;
      this.scheduleId = scheduleId == null ? "" : scheduleId;
      this.courseId = courseId;
      this.bundleChecksum = bundleChecksum == null ? "" : bundleChecksum;
      this.serverStartAtMs = serverStartAtMs;
      this.pausedAccumulatedMs = pausedAccumulatedMs;
      this.pausedAtMs = pausedAtMs;
      this.endedAtMs = endedAtMs;
      this.terminatedAtMs = terminatedAtMs;
    }
  }
  public static class CurrentPlaybackSession {
    public final long serverNowMs;
    public final PlaybackSessionSnapshot session;
    public final long requestStartedElapsedRealtimeMs;
    public final long responseReceivedElapsedRealtimeMs;
    public CurrentPlaybackSession(long serverNowMs, PlaybackSessionSnapshot session) {
      this(serverNowMs, session, 0L, 0L);
    }
    public CurrentPlaybackSession(
        long serverNowMs,
        PlaybackSessionSnapshot session,
        long requestStartedElapsedRealtimeMs,
        long responseReceivedElapsedRealtimeMs) {
      this.serverNowMs = serverNowMs;
      this.session = session;
      this.requestStartedElapsedRealtimeMs = requestStartedElapsedRealtimeMs;
      this.responseReceivedElapsedRealtimeMs = responseReceivedElapsedRealtimeMs;
    }
  }
  protected static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

  protected static class CachedResource {
    final String key;
    final String url;
    final String filename;
    final String extension;
    final String actionName;
    final String checksum;
    final long sizeBytes;

    CachedResource(
        String key,
        String url,
        String filename,
        String extension,
        String actionName,
        String checksum,
        long sizeBytes) {
      this.key = key == null || key.trim().isEmpty() ? String.valueOf(url.hashCode()) : key;
      this.url = url;
      this.filename = filename;
      this.extension = extension;
      this.actionName = actionName;
      this.checksum = checksum == null ? "" : checksum.trim();
      this.sizeBytes = Math.max(sizeBytes, 0L);
    }

    String cacheKey() {
      if (checksum != null && !checksum.isEmpty()) {
        return checksum;
      }
      return key;
    }

    String displayName() {
      if (actionName != null && !actionName.trim().isEmpty()) {
        return actionName;
      }
      if (filename != null && !filename.trim().isEmpty()) {
        return filename;
      }
      return key;
    }
  }
}
