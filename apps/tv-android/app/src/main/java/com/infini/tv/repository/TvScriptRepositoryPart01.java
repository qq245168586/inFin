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

abstract class TvScriptRepositoryPart01 extends TvScriptRepositoryBase {
  protected TvScriptRepositoryPart01(Context context) {
    super(context);
  }

  protected static final ZoneId COURSE_ZONE = ZoneId.of(ServerConfig.COURSE_TIME_ZONE);

  protected static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");

  protected static final OkHttpClient API_HTTP_CLIENT =
      new OkHttpClient.Builder()
          .connectTimeout(8, TimeUnit.SECONDS)
          .readTimeout(20, TimeUnit.SECONDS)
          .writeTimeout(20, TimeUnit.SECONDS)
          .retryOnConnectionFailure(true)
          .protocols(Collections.singletonList(Protocol.HTTP_1_1))
          .connectionSpecs(Arrays.asList(ConnectionSpec.CLEARTEXT, ConnectionSpec.COMPATIBLE_TLS))
          .build();

  protected static final OkHttpClient DOWNLOAD_HTTP_CLIENT =
      API_HTTP_CLIENT.newBuilder().readTimeout(60, TimeUnit.SECONDS).build();

  public List<TvScheduleItem> loadTodaySchedule() throws IOException {
    return syncTodayBundle(null).schedules;
  }

  public SyncResult syncTodayBundle(SyncProgressListener listener) throws IOException {
    String today = LocalDate.now(COURSE_ZONE).format(DATE_FORMATTER);
    JSONObject payload =
        requestJson(
            "/tv/daily-bundle?date="
                + encode(today)
                + "&timeZone="
                + encode(COURSE_ZONE.getId()));

    JSONArray resourcesArray = payload.optJSONArray("resources");
    JSONArray schedulesArray = payload.optJSONArray("schedules");
    List<CachedResource> resources = parseResources(resourcesArray);
    resources.addAll(parseLogoResources(schedulesArray));
    Map<String, String> localMediaMap = ensureResourcesCached(resources, listener);
    cleanupTemporaryDownloads();

    List<TvScheduleItem> schedules = parseBundleSchedules(schedulesArray, localMediaMap);
    return new SyncResult(
        payload.optString("date", today),
        payload.optString("checksum", ""),
        resources.size(),
        schedules);
  }

  public DailyChecksum loadTodayChecksum() throws IOException {
    String today = LocalDate.now(COURSE_ZONE).format(DATE_FORMATTER);
    JSONObject payload =
        requestJson(
            "/tv/daily-checksum?date="
                + encode(today)
                + "&timeZone="
                + encode(COURSE_ZONE.getId()));
    return new DailyChecksum(
        payload.optString("date", today),
        payload.optString("checksum", ""),
        payload.optInt("scheduleCount", 0));
  }

  public TvScheduleItem loadScheduleById(String scheduleId) throws IOException {
    JSONObject payload =
        requestJson("/tv/schedule-bundle?scheduleId=" + encode(scheduleId == null ? "" : scheduleId));

    JSONObject scheduleObject = payload.optJSONObject("schedule");
    if (scheduleObject == null) {
      return null;
    }

    JSONArray scheduleArray = new JSONArray();
    scheduleArray.put(scheduleObject);
    List<CachedResource> resources = parseResources(payload.optJSONArray("resources"));
    resources.addAll(parseLogoResources(scheduleArray));
    Map<String, String> localMediaMap = ensureResourcesCached(resources, null);
    return parseScheduleItem(scheduleObject, localMediaMap, false);
  }

  public CurrentPlaybackSession loadCurrentPlaybackSession(
      String accountNamespace, String deviceId, int screenNumber) throws IOException {
    JSONObject payload =
        requestJson(
            "/tv/playback-sessions/current?accountNamespace="
                + encode(accountNamespace == null ? "" : accountNamespace)
                + "&deviceId="
                + encode(deviceId == null ? "" : deviceId)
                + "&screenNumber="
                + Math.max(screenNumber, 0));
    return parseCurrentPlaybackSession(payload);
  }

  public ScreenRegistration bindScreen(
      String accountNamespace,
      String deviceId,
      int screenNumber,
      String pairToken,
      String mqttClientId,
      String appVersion,
      String playbackState,
      String activeScheduleId,
      boolean previewMode,
      String playbackSessionId,
      int sessionVersion,
      String bundleChecksum,
      long playbackElapsedMs,
      String updateState,
      String updateTargetVersion,
      int updateProgressPercent,
      String updateMessage)
      throws IOException {
    return parseScreenRegistration(
        requestJson(
        "/tv/screens/bind",
        "POST",
        buildScreenPayload(
            accountNamespace,
            deviceId,
            screenNumber,
            pairToken,
            mqttClientId,
            appVersion,
            playbackState,
            activeScheduleId,
            previewMode,
            playbackSessionId,
            sessionVersion,
            bundleChecksum,
            playbackElapsedMs,
            updateState,
            updateTargetVersion,
            updateProgressPercent,
            updateMessage)));
  }

  public ScreenRegistration sendScreenHeartbeat(
      String accountNamespace,
      String deviceId,
      int screenNumber,
      String pairToken,
      String mqttClientId,
      String appVersion,
      String playbackState,
      String activeScheduleId,
      boolean previewMode,
      String playbackSessionId,
      int sessionVersion,
      String bundleChecksum,
      long playbackElapsedMs,
      String updateState,
      String updateTargetVersion,
      int updateProgressPercent,
      String updateMessage)
      throws IOException {
    return parseScreenRegistration(
        requestJson(
        "/tv/screens/heartbeat",
        "POST",
        buildScreenPayload(
            accountNamespace,
            deviceId,
            screenNumber,
            pairToken,
            mqttClientId,
            appVersion,
            playbackState,
            activeScheduleId,
            previewMode,
            playbackSessionId,
            sessionVersion,
            bundleChecksum,
            playbackElapsedMs,
            updateState,
            updateTargetVersion,
            updateProgressPercent,
            updateMessage)));
  }

  public CacheStats getCacheStats() {
    ensureCacheRoot();
    File[] cachedFiles = mediaCacheRoot.listFiles();
    long totalBytes = 0L;
    int fileCount = 0;
    long lastUpdatedMs = Math.max(mediaCacheRoot.lastModified(), 0L);
    if (cachedFiles != null) {
      for (File cachedFile : cachedFiles) {
        if (cachedFile == null || !cachedFile.isFile() || cachedFile.getName().endsWith(".download")) {
          continue;
        }
        fileCount += 1;
        totalBytes += Math.max(cachedFile.length(), 0L);
        lastUpdatedMs = Math.max(lastUpdatedMs, cachedFile.lastModified());
      }
    }

    String updatedAt = lastUpdatedMs > 0L ? Instant.ofEpochMilli(lastUpdatedMs).toString() : "";
    return new CacheStats(totalBytes, fileCount, updatedAt);
  }

  public CacheStats clearMediaCache() {
    ensureCacheRoot();
    File[] cachedFiles = mediaCacheRoot.listFiles();
    if (cachedFiles != null) {
      for (File cachedFile : cachedFiles) {
        if (cachedFile == null || !cachedFile.exists()) {
          continue;
        }
        if (cachedFile.isFile()) {
          cachedFile.delete();
        }
      }
    }
    mediaCacheRoot.setLastModified(System.currentTimeMillis());
    return getCacheStats();
  }
}
