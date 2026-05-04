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

public class TvScriptRepository {
  private static final String TAG = "TvRepository";
  private static final ZoneId COURSE_ZONE = ZoneId.of(ServerConfig.COURSE_TIME_ZONE);
  private static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");
  private static final OkHttpClient API_HTTP_CLIENT =
      new OkHttpClient.Builder()
          .connectTimeout(8, TimeUnit.SECONDS)
          .readTimeout(20, TimeUnit.SECONDS)
          .writeTimeout(20, TimeUnit.SECONDS)
          .retryOnConnectionFailure(true)
          .protocols(Collections.singletonList(Protocol.HTTP_1_1))
          .connectionSpecs(Arrays.asList(ConnectionSpec.CLEARTEXT, ConnectionSpec.COMPATIBLE_TLS))
          .build();
  private static final OkHttpClient DOWNLOAD_HTTP_CLIENT =
      API_HTTP_CLIENT.newBuilder().readTimeout(60, TimeUnit.SECONDS).build();
  public interface SyncProgressListener {
    void onStatus(String message, int completed, int total);
  }

  public interface AppPackageProgressListener {
    void onProgress(String message, int progressPercent);
  }

  public static class SyncResult {
    public final String date;
    public final String checksum;
    public final int resourceCount;
    public final List<TvScheduleItem> schedules;

    public SyncResult(String date, String checksum, int resourceCount, List<TvScheduleItem> schedules) {
      this.date = date;
      this.checksum = checksum;
      this.resourceCount = resourceCount;
      this.schedules = schedules;
    }
  }

  public static class DailyChecksum {
    public final String date;
    public final String checksum;
    public final int scheduleCount;

    public DailyChecksum(String date, String checksum, int scheduleCount) {
      this.date = date;
      this.checksum = checksum;
      this.scheduleCount = scheduleCount;
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

    public ScreenRegistration(String accountNamespace, int screenNumber, String deviceId, boolean online) {
      this.accountNamespace = accountNamespace == null ? "" : accountNamespace;
      this.screenNumber = screenNumber;
      this.deviceId = deviceId == null ? "" : deviceId;
      this.online = online;
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

    public CurrentPlaybackSession(long serverNowMs, PlaybackSessionSnapshot session) {
      this.serverNowMs = serverNowMs;
      this.session = session;
    }
  }

  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
  private final Context context;
  private final File mediaCacheRoot;
  private final File appUpdateRoot;

  public TvScriptRepository(Context context) {
    this.context = context.getApplicationContext();
    this.mediaCacheRoot = new File(this.context.getFilesDir(), "tv-media-cache");
    File externalDownloadsRoot = this.context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
    if (externalDownloadsRoot != null) {
      this.appUpdateRoot = new File(externalDownloadsRoot, "tv-app-updates");
    } else {
      this.appUpdateRoot = new File(this.context.getFilesDir(), "tv-app-updates");
    }
    if (!mediaCacheRoot.exists()) {
      mediaCacheRoot.mkdirs();
    }
    if (!appUpdateRoot.exists()) {
      appUpdateRoot.mkdirs();
    }
  }

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

  public File downloadAppPackage(
      String packageId,
      String version,
      String downloadUrl,
      String checksum,
      AppPackageProgressListener listener)
      throws IOException {
    ensureAppUpdateRoot();
    String safePackageId = packageId == null || packageId.trim().isEmpty() ? "package" : packageId.trim();
    String safeVersion = version == null || version.trim().isEmpty() ? "build" : version.trim();
    String filename = "tv-" + safePackageId + "-" + safeVersion.replaceAll("[^A-Za-z0-9._-]", "-") + ".apk";
    File targetFile = new File(appUpdateRoot, filename);

    if (targetFile.exists() && targetFile.length() > 0L) {
      if (checksum == null || checksum.trim().isEmpty() || checksum.equalsIgnoreCase(calculateSha256(targetFile))) {
        if (listener != null) {
          listener.onProgress("安装包已就绪", 100);
        }
        return targetFile;
      }
      targetFile.delete();
    }

    clearStaleAppPackages(filename);
    File tempFile = new File(appUpdateRoot, filename + ".download");
    if (tempFile.exists()) {
      tempFile.delete();
    }

    IOException lastError = null;
    for (String resolvedUrl : resolveAbsoluteUrlCandidates(downloadUrl)) {
      long totalBytes = 0L;
      long downloadedBytes = 0L;
      byte[] buffer = new byte[16 * 1024];
      int lastProgress = -1;
      if (tempFile.exists()) {
        tempFile.delete();
      }
      Request request = new Request.Builder().url(resolvedUrl).get().build();
      try (Response response = DOWNLOAD_HTTP_CLIENT.newCall(request).execute()) {
        if (!response.isSuccessful()) {
          throw new IOException("安装包下载失败 (" + response.code() + ")");
        }

        ResponseBody responseBody = response.body();
        if (responseBody == null) {
          throw new IOException("安装包下载失败，响应体为空。");
        }

        totalBytes = Math.max(responseBody.contentLength(), 0L);
        try (InputStream inputStream = new BufferedInputStream(responseBody.byteStream());
            OutputStream outputStream = new BufferedOutputStream(new FileOutputStream(tempFile))) {
          int read;
          while ((read = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, read);
            downloadedBytes += read;
            if (listener != null && totalBytes > 0L) {
              int progress = (int) Math.min(100L, (downloadedBytes * 100L) / totalBytes);
              if (progress != lastProgress) {
                lastProgress = progress;
                listener.onProgress("正在下载更新包...", progress);
              }
            }
          }
        }
        lastError = null;
        break;
      } catch (IOException error) {
        lastError = error;
        Log.w(TAG, "App package download failed via " + resolvedUrl, error);
      }
    }

    if (lastError != null) {
      throw lastError;
    }

    if (!tempFile.exists() || tempFile.length() <= 0L) {
      throw new IOException("安装包下载失败，文件为空。");
    }

    if (checksum != null && !checksum.trim().isEmpty()) {
      String localChecksum = calculateSha256(tempFile);
      if (!checksum.equalsIgnoreCase(localChecksum)) {
        tempFile.delete();
        throw new IOException("安装包校验失败，请重新上传版本。");
      }
    }

    if (targetFile.exists()) {
      targetFile.delete();
    }
    if (!tempFile.renameTo(targetFile)) {
      throw new IOException("安装包保存失败。");
    }

    if (listener != null) {
      listener.onProgress("安装包下载完成", 100);
    }
    return targetFile;
  }

  private List<TvScheduleItem> parseBundleSchedules(
      JSONArray schedulesArray, Map<String, String> localMediaMap) {
    List<TvScheduleItem> result = new ArrayList<>();
    if (schedulesArray == null) {
      return result;
    }

    for (int index = 0; index < schedulesArray.length(); index += 1) {
      JSONObject scheduleObject = schedulesArray.optJSONObject(index);
      TvScheduleItem item = parseScheduleItem(scheduleObject, localMediaMap, true);
      if (item != null) {
        result.add(item);
      }
    }

    result.sort((left, right) -> left.startTime.compareTo(right.startTime));
    return result;
  }

  private void ensureAppUpdateRoot() {
    if (!appUpdateRoot.exists()) {
      appUpdateRoot.mkdirs();
    }
  }

  private void clearStaleAppPackages(String keepFilename) {
    ensureAppUpdateRoot();
    File[] files = appUpdateRoot.listFiles();
    if (files == null) {
      return;
    }
    for (File file : files) {
      if (file == null || !file.isFile()) {
        continue;
      }
      if (file.getName().equals(keepFilename) || file.getName().equals(keepFilename + ".download")) {
        continue;
      }
      file.delete();
    }
  }

  private String calculateSha256(File targetFile) throws IOException {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream inputStream = new BufferedInputStream(new java.io.FileInputStream(targetFile))) {
        byte[] buffer = new byte[16 * 1024];
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
          digest.update(buffer, 0, read);
        }
      }
      byte[] hash = digest.digest();
      StringBuilder builder = new StringBuilder(hash.length * 2);
      for (byte value : hash) {
        builder.append(String.format(Locale.US, "%02x", value));
      }
      return builder.toString();
    } catch (Exception error) {
      throw new IOException("计算安装包校验失败。", error);
    }
  }

  private List<String> resolveAbsoluteUrlCandidates(String downloadUrl) {
    String url = downloadUrl == null ? "" : downloadUrl.trim();
    if (url.isEmpty()) {
      return Collections.emptyList();
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      List<String> candidates = new ArrayList<>();
      candidates.add(url);
      if (url.startsWith(ServerConfig.BASE_URL + "/")) {
        candidates.add(ServerConfig.LEGACY_BASE_URL + url.substring(ServerConfig.BASE_URL.length()));
      }
      return candidates;
    }
    if (!url.startsWith("/")) {
      url = "/" + url;
    }
    List<String> candidates = new ArrayList<>();
    for (String baseUrl : baseUrlCandidates()) {
      candidates.add(baseUrl + url);
    }
    return candidates;
  }

  private TvScheduleItem parseScheduleItem(
      JSONObject scheduleObject, Map<String, String> localMediaMap, boolean requireToday) {
    if (scheduleObject == null) {
      return null;
    }

    JSONObject courseObject = scheduleObject.optJSONObject("course");
    JSONObject scriptObject = courseObject != null ? courseObject.optJSONObject("script") : null;
    CourseScript course =
        scriptObject != null ? localizeCourseScript(parseCourseScript(scriptObject), localMediaMap) : null;

    String beginTime = scheduleObject.optString("beginTime");
    OffsetDateTime startOffset = OffsetDateTime.parse(beginTime);
    LocalDateTime startTime = startOffset.atZoneSameInstant(COURSE_ZONE).toLocalDateTime();
    if (requireToday && !LocalDate.now(COURSE_ZONE).equals(startTime.toLocalDate())) {
      return null;
    }

    int durationMinutes = scheduleObject.optInt("duration", 0);
    String courseName = scheduleObject.optString("courseName");
    String version = scheduleObject.optString("version");
    return new TvScheduleItem(
        String.valueOf(scheduleObject.optInt("id")),
        course,
        scheduleObject.optInt("courseId", 0),
        courseName,
        version,
        scheduleObject.optString("contentChecksum", ""),
        startTime,
        startTime.plusMinutes(durationMinutes),
        isNowInside(startTime, durationMinutes),
        buildLogoText(courseName),
        extractCourseLogoSource(courseObject, localMediaMap));
  }

  private Map<String, String> ensureResourcesCached(
      List<CachedResource> resources, SyncProgressListener listener) throws IOException {
    Map<String, String> localMediaMap = new HashMap<>();
    int total = resources.size();

    if (listener != null) {
      listener.onStatus(total == 0 ? "今天没有课程资源需要下载。" : "正在校验今日课程资源...", 0, total);
    }

    for (int index = 0; index < resources.size(); index += 1) {
      CachedResource resource = resources.get(index);
      File targetFile = resolveCacheFile(resource);
      if (targetFile.exists() && targetFile.length() > 0) {
        localMediaMap.put(resource.url, targetFile.getAbsolutePath());
        if (listener != null) {
          listener.onStatus(
              "已就绪 " + (index + 1) + "/" + total + " · " + resource.displayName(),
              index + 1,
              total);
        }
        continue;
      }

      if (listener != null) {
        listener.onStatus(
            "正在下载 " + (index + 1) + "/" + total + " · " + resource.displayName(),
            index,
            total);
      }

      downloadToFile(resource.url, targetFile);
      localMediaMap.put(resource.url, targetFile.getAbsolutePath());

      if (listener != null) {
        listener.onStatus(
            "已缓存 " + (index + 1) + "/" + total + " · " + resource.displayName(),
            index + 1,
            total);
      }
    }

    return localMediaMap;
  }

  private void cleanupTemporaryDownloads() {
    File[] cachedFiles = mediaCacheRoot.listFiles();
    if (cachedFiles == null) {
      return;
    }

    for (File cachedFile : cachedFiles) {
      if (cachedFile == null || !cachedFile.isFile()) {
        continue;
      }
      if (cachedFile.getName().endsWith(".download")) {
        cachedFile.delete();
      }
    }
  }

  private void downloadToFile(String remoteUrl, File targetFile) throws IOException {
    if (targetFile.getParentFile() != null && !targetFile.getParentFile().exists()) {
      targetFile.getParentFile().mkdirs();
    }

    File tempFile = new File(targetFile.getAbsolutePath() + ".download");
    IOException lastError = null;
    for (String candidateUrl : resolveMediaUrlCandidates(remoteUrl)) {
      if (tempFile.exists()) {
        tempFile.delete();
      }
      Request request = new Request.Builder().url(candidateUrl).get().build();
      try (Response response = DOWNLOAD_HTTP_CLIENT.newCall(request).execute()) {
        if (!response.isSuccessful()) {
          throw new IOException("下载视频资源失败，状态码 " + response.code());
        }

        ResponseBody responseBody = response.body();
        if (responseBody == null) {
          throw new IOException("下载视频资源失败，响应体为空。");
        }

        try (InputStream inputStream = new BufferedInputStream(responseBody.byteStream());
            FileOutputStream outputStream = new FileOutputStream(tempFile)) {
          byte[] buffer = new byte[16 * 1024];
          int read;
          while ((read = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, read);
          }
          outputStream.flush();
        }
        lastError = null;
        break;
      } catch (IOException error) {
        lastError = error;
        Log.w(TAG, "Media download failed via " + candidateUrl, error);
      }
    }

    if (lastError != null) {
      throw lastError;
    }

    if (targetFile.exists()) {
      targetFile.delete();
    }
    if (!tempFile.renameTo(targetFile)) {
      throw new IOException("课程资源写入本地缓存失败。");
    }
  }

  private File resolveCacheFile(CachedResource resource) {
    String cacheKey = resource.cacheKey();
    return new File(mediaCacheRoot, cacheKey + resource.extension);
  }

  private List<CachedResource> parseResources(JSONArray resourcesArray) {
    List<CachedResource> resources = new ArrayList<>();
    if (resourcesArray == null) {
      return resources;
    }

    for (int index = 0; index < resourcesArray.length(); index += 1) {
      JSONObject resourceObject = resourcesArray.optJSONObject(index);
      if (resourceObject == null) {
        continue;
      }

      String url = resourceObject.optString("url");
      if (url == null || url.trim().isEmpty()) {
        continue;
      }

      String extension = resourceObject.optString("extension");
      if (extension == null || extension.trim().isEmpty()) {
        extension = ".mp4";
      } else if (!extension.startsWith(".")) {
        extension = "." + extension;
      }

      resources.add(
          new CachedResource(
              resourceObject.optString("key"),
              url,
              resourceObject.optString("filename"),
              extension,
              resourceObject.optString("actionName"),
              resourceObject.optString("checksum"),
              resourceObject.optLong("sizeBytes", 0L)));
    }

    return resources;
  }

  private List<CachedResource> parseLogoResources(JSONArray schedulesArray) {
    List<CachedResource> resources = new ArrayList<>();
    Set<String> seenUrls = new HashSet<>();
    if (schedulesArray == null) {
      return resources;
    }

    for (int index = 0; index < schedulesArray.length(); index += 1) {
      JSONObject scheduleObject = schedulesArray.optJSONObject(index);
      if (scheduleObject == null) {
        continue;
      }

      JSONObject courseObject = scheduleObject.optJSONObject("course");
      JSONObject logoMediaObject = courseObject != null ? courseObject.optJSONObject("logoMedia") : null;
      if (logoMediaObject == null) {
        continue;
      }

      String url = logoMediaObject.optString("url");
      if (url == null || url.trim().isEmpty() || seenUrls.contains(url)) {
        continue;
      }
      seenUrls.add(url);

      String filename = logoMediaObject.optString("filename");
      String extension = extractExtension(filename, url, ".png");
      String courseName = scheduleObject.optString("courseName");
      String resourceName =
          courseName == null || courseName.trim().isEmpty() ? "课程 logo" : courseName + " logo";
      resources.add(
          new CachedResource(
              "logo_" + logoMediaObject.optInt("id", index),
              url,
              filename,
              extension,
              resourceName,
              logoMediaObject.optString("checksum"),
              logoMediaObject.optLong("sizeBytes", 0L)));
    }

    return resources;
  }

  private String extractExtension(String filename, String url, String fallbackExtension) {
    String candidate = filename;
    if (candidate == null || candidate.trim().isEmpty()) {
      candidate = url;
    }
    if (candidate == null || candidate.trim().isEmpty()) {
      return fallbackExtension;
    }

    int queryIndex = candidate.indexOf('?');
    if (queryIndex >= 0) {
      candidate = candidate.substring(0, queryIndex);
    }

    int slashIndex = candidate.lastIndexOf('/');
    int dotIndex = candidate.lastIndexOf('.');
    if (dotIndex > slashIndex && dotIndex < candidate.length() - 1) {
      return candidate.substring(dotIndex);
    }
    return fallbackExtension;
  }

  private JSONObject requestJson(String relativePath) throws IOException {
    return requestJson(relativePath, "GET", null);
  }

  private JSONObject buildScreenPayload(
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
    CacheStats cacheStats = getCacheStats();
    try {
      return new JSONObject()
          .put(
              "accountNamespace",
              accountNamespace == null ? "" : accountNamespace.trim().toLowerCase(Locale.US))
          .put("deviceId", deviceId == null ? "" : deviceId)
          .put("screenNumber", screenNumber)
          .put("pairToken", pairToken == null ? "" : pairToken.trim().toUpperCase(Locale.US))
          .put("mqttClientId", mqttClientId == null ? "" : mqttClientId)
          .put("appVersion", appVersion == null ? "" : appVersion)
          .put("playbackState", playbackState == null ? "" : playbackState)
          .put("activeScheduleId", activeScheduleId == null ? "" : activeScheduleId)
          .put("previewMode", previewMode)
          .put("playbackSessionId", playbackSessionId == null ? "" : playbackSessionId)
          .put("sessionVersion", Math.max(sessionVersion, 0))
          .put("bundleChecksum", bundleChecksum == null ? "" : bundleChecksum)
          .put("playbackElapsedMs", Math.max(playbackElapsedMs, 0L))
          .put("updateState", updateState == null ? "" : updateState)
          .put("updateTargetVersion", updateTargetVersion == null ? "" : updateTargetVersion)
          .put("updateProgressPercent", Math.max(updateProgressPercent, 0))
          .put("updateMessage", updateMessage == null ? "" : updateMessage)
          .put("cacheBytes", cacheStats.totalBytes)
          .put("cacheFileCount", cacheStats.fileCount)
          .put("cacheUpdatedAt", cacheStats.updatedAt)
          .put("platform", "tv-android");
    } catch (JSONException error) {
      throw new IOException("TV 端构建屏幕状态数据失败。", error);
    }
  }

  private void ensureCacheRoot() {
    if (!mediaCacheRoot.exists()) {
      mediaCacheRoot.mkdirs();
    }
  }

  private ScreenRegistration parseScreenRegistration(JSONObject response) {
    if (response == null) {
      return null;
    }

    JSONObject data = response.optJSONObject("data");
    if (data == null) {
      return null;
    }

    return new ScreenRegistration(
        data.optString("accountNamespace", ""),
        data.optInt("screenNumber", 0),
        data.optString("deviceId", ""),
        data.optBoolean("online", false));
  }

  private CurrentPlaybackSession parseCurrentPlaybackSession(JSONObject response) {
    if (response == null) {
      return new CurrentPlaybackSession(0L, null);
    }
    long serverNowMs = response.optLong("serverNowMs", 0L);
    JSONObject sessionObject = response.optJSONObject("session");
    if (sessionObject == null) {
      JSONObject dataObject = response.optJSONObject("data");
      if (dataObject != null) {
        serverNowMs = dataObject.optLong("serverNowMs", serverNowMs);
        sessionObject = dataObject.optJSONObject("session");
      }
    }
    if (sessionObject == null) {
      return new CurrentPlaybackSession(serverNowMs, null);
    }
    return new CurrentPlaybackSession(serverNowMs, parsePlaybackSessionSnapshot(sessionObject));
  }

  private PlaybackSessionSnapshot parsePlaybackSessionSnapshot(JSONObject sessionObject) {
    if (sessionObject == null) {
      return null;
    }
    return new PlaybackSessionSnapshot(
        sessionObject.optString("id", sessionObject.optString("sessionId", "")),
        sessionObject.optString("state", ""),
        sessionObject.optInt("version", 0),
        sessionObject.optString("scheduleId", ""),
        sessionObject.optInt("courseId", 0),
        sessionObject.optString("bundleChecksum", ""),
        sessionObject.optLong("serverStartAtMs", 0L),
        sessionObject.optLong("pausedAccumulatedMs", 0L),
        sessionObject.optLong("pausedAtMs", 0L),
        sessionObject.optLong("endedAtMs", 0L),
        sessionObject.optLong("terminatedAtMs", 0L));
  }

  private JSONObject requestJson(String relativePath, String method, JSONObject body) throws IOException {
    IOException lastError = null;
    for (String apiBaseUrl : apiBaseUrlCandidates()) {
      try {
        return requestJsonWithBase(apiBaseUrl, relativePath, method, body);
      } catch (IOException error) {
        lastError = error;
        Log.w(TAG, "API request failed via " + apiBaseUrl + relativePath, error);
      }
    }
    throw lastError == null ? new IOException("TV 端未拿到课程数据。") : lastError;
  }

  private String resolveMediaUrl(String url) {
    if (url == null) {
      return "";
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("/")) {
      return ServerConfig.BASE_URL + url;
    }
    return ServerConfig.API_BASE_URL + "/" + url;
  }

  private JSONObject requestJsonWithBase(
      String apiBaseUrl, String relativePath, String method, JSONObject body) throws IOException {
    Request.Builder requestBuilder =
        new Request.Builder().url(apiBaseUrl + relativePath).header("Accept", "application/json");
    String normalizedMethod = method == null ? "GET" : method.toUpperCase(Locale.US);
    if (body != null) {
      requestBuilder.method(
          normalizedMethod,
          RequestBody.create(body.toString().getBytes(StandardCharsets.UTF_8), JSON_MEDIA_TYPE));
    } else if ("GET".equals(normalizedMethod)) {
      requestBuilder.get();
    } else {
      requestBuilder.method(normalizedMethod, null);
    }

    StringBuilder builder = new StringBuilder();
    try (Response response = API_HTTP_CLIENT.newCall(requestBuilder.build()).execute()) {
      ResponseBody responseBody = response.body();
      if (responseBody == null) {
        throw new IOException("TV 端未拿到课程数据。");
      }

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(responseBody.byteStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          builder.append(line);
        }
      }

      if (!response.isSuccessful()) {
        throw new IOException(
            "TV 接口请求失败 ("
                + response.code()
                + ") "
                + (builder.length() == 0 ? "未返回详情。" : builder.toString()));
      }
    }

    try {
      return new JSONObject(builder.toString());
    } catch (JSONException error) {
      throw new IOException("TV 端解析课程数据失败。", error);
    }
  }

  private List<String> apiBaseUrlCandidates() {
    List<String> candidates = new ArrayList<>();
    candidates.add(ServerConfig.API_BASE_URL);
    if (!ServerConfig.LEGACY_API_BASE_URL.equals(ServerConfig.API_BASE_URL)) {
      candidates.add(ServerConfig.LEGACY_API_BASE_URL);
    }
    return candidates;
  }

  private List<String> baseUrlCandidates() {
    List<String> candidates = new ArrayList<>();
    candidates.add(ServerConfig.BASE_URL);
    if (!ServerConfig.LEGACY_BASE_URL.equals(ServerConfig.BASE_URL)) {
      candidates.add(ServerConfig.LEGACY_BASE_URL);
    }
    return candidates;
  }

  private List<String> resolveMediaUrlCandidates(String url) {
    List<String> candidates = new ArrayList<>();
    if (url == null) {
      return candidates;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      candidates.add(url);
      if (url.startsWith(ServerConfig.BASE_URL + "/")) {
        candidates.add(ServerConfig.LEGACY_BASE_URL + url.substring(ServerConfig.BASE_URL.length()));
      } else if (url.startsWith(ServerConfig.API_BASE_URL + "/")) {
        candidates.add(ServerConfig.LEGACY_API_BASE_URL + url.substring(ServerConfig.API_BASE_URL.length()));
      }
      return candidates;
    }

    if (url.startsWith("/")) {
      for (String baseUrl : baseUrlCandidates()) {
        candidates.add(baseUrl + url);
      }
      return candidates;
    }

    for (String apiBaseUrl : apiBaseUrlCandidates()) {
      candidates.add(apiBaseUrl + "/" + url);
    }
    return candidates;
  }

  private String encode(String text) {
    try {
      return URLEncoder.encode(text, StandardCharsets.UTF_8.name());
    } catch (UnsupportedEncodingException error) {
      throw new IllegalStateException("UTF-8 should always be available", error);
    }
  }

  private boolean isNowInside(LocalDateTime startTime, int durationMinutes) {
    LocalDateTime now = LocalDateTime.now(COURSE_ZONE);
    LocalDateTime endTime = startTime.plusMinutes(durationMinutes);
    return !now.isBefore(startTime) && now.isBefore(endTime);
  }

  private String buildLogoText(String courseName) {
    if (courseName == null || courseName.trim().isEmpty()) {
      return "INFINI";
    }

    String normalized = courseName.trim().replaceAll("\\s+", " ");
    if (normalized.length() <= 10) {
      return normalized.replace(" ", "\n");
    }

    String[] parts = normalized.split(" ");
    if (parts.length >= 2) {
      return (parts[0] + "\n" + parts[1]).toUpperCase(Locale.US);
    }

    return normalized.substring(0, Math.min(10, normalized.length())).toUpperCase(Locale.US);
  }

  private String extractCourseLogoSource(JSONObject courseObject, Map<String, String> localMediaMap) {
    if (courseObject == null) {
      return "";
    }

    JSONObject logoMediaObject = courseObject.optJSONObject("logoMedia");
    if (logoMediaObject == null) {
      return "";
    }

    String url = logoMediaObject.optString("url");
    if (url == null || url.trim().isEmpty()) {
      return "";
    }

    String cachedPath = localMediaMap.get(url);
    if (cachedPath != null && !cachedPath.trim().isEmpty()) {
      return cachedPath;
    }

    return resolveMediaUrl(url);
  }

  private CourseScript parseCourseScript(JSONObject scriptObject) {
    JSONObject metadataObject = scriptObject.optJSONObject("metadata");
    JSONObject sectionsObject = scriptObject.optJSONObject("sections");
    JSONObject warmupObject = sectionsObject != null ? sectionsObject.optJSONObject("warmup") : null;
    JSONObject cooldownObject = sectionsObject != null ? sectionsObject.optJSONObject("cooldown") : null;
    JSONObject trainingObject = scriptObject.optJSONObject("training");
    JSONObject panelObject = metadataObject != null ? metadataObject.optJSONObject("trainingPanel") : null;

    return new CourseScript(
        new CourseScript.Metadata(
            metadataObject != null ? metadataObject.optString("id") : "",
            metadataObject != null ? metadataObject.optString("name") : "",
            metadataObject != null ? metadataObject.optString("version") : "",
            metadataObject != null ? metadataObject.optString("creator") : "",
            metadataObject != null ? metadataObject.optInt("defaultHydrateSeconds", 0) : 0,
            panelObject != null ? panelObject.optInt("setCount", 0) : 0,
            panelObject != null ? panelObject.optInt("breakCount", 0) : 0,
            panelObject != null ? panelObject.optInt("workSeconds", 0) : 0,
            panelObject != null ? panelObject.optInt("restSeconds", 0) : 0),
        parseWaterfallSection(warmupObject, "热身"),
        parseWaterfallSection(cooldownObject, "冷身"),
        parseVideoGroups(trainingObject != null ? trainingObject.optJSONArray("videoGroups") : null),
        parsePods(trainingObject != null ? trainingObject.optJSONArray("pods") : null));
  }

  private CourseScript localizeCourseScript(CourseScript source, Map<String, String> localMediaMap) {
    if (source == null) {
      return null;
    }

    return new CourseScript(
        source.metadata,
        localizeWaterfall(source.warmup, localMediaMap),
        localizeWaterfall(source.cooldown, localMediaMap),
        localizeVideoGroups(source.videoGroups, localMediaMap),
        source.pods);
  }

  private CourseScript.WaterfallSection localizeWaterfall(
      CourseScript.WaterfallSection source, Map<String, String> localMediaMap) {
    if (source == null) {
      return null;
    }

    List<CourseScript.WaterfallItem> items = new ArrayList<>();
    for (CourseScript.WaterfallItem item : source.items) {
      items.add(
          new CourseScript.WaterfallItem(
              item.actionId,
              item.actionName,
              localMediaMap.getOrDefault(item.mediaUrl, item.mediaUrl),
              item.seconds,
              item.cue));
    }
    return new CourseScript.WaterfallSection(source.title, items);
  }

  private List<CourseScript.VideoGroup> localizeVideoGroups(
      List<CourseScript.VideoGroup> source, Map<String, String> localMediaMap) {
    List<CourseScript.VideoGroup> groups = new ArrayList<>();
    if (source == null) {
      return groups;
    }

    for (CourseScript.VideoGroup group : source) {
      List<CourseScript.VideoGroupScreen> screens = new ArrayList<>();
      for (CourseScript.VideoGroupScreen screen : group.screens) {
        List<CourseScript.VideoCard> cards = new ArrayList<>();
        for (CourseScript.VideoCard card : screen.videoCards) {
          cards.add(
              new CourseScript.VideoCard(
                  card.actionId,
                  card.actionName,
                  localMediaMap.getOrDefault(card.mediaUrl, card.mediaUrl),
                  card.stationNumber));
        }
        screens.add(new CourseScript.VideoGroupScreen(screen.screenIndex, screen.stationLabel, cards));
      }
      groups.add(new CourseScript.VideoGroup(group.id, group.name, group.screenCount, screens));
    }

    return groups;
  }

  private CourseScript.WaterfallSection parseWaterfallSection(JSONObject sectionObject, String fallbackTitle) {
    JSONArray itemsArray = sectionObject != null ? sectionObject.optJSONArray("items") : null;
    List<CourseScript.WaterfallItem> items = new ArrayList<>();
    if (itemsArray != null) {
      for (int index = 0; index < itemsArray.length(); index += 1) {
        JSONObject itemObject = itemsArray.optJSONObject(index);
        if (itemObject == null) {
          continue;
        }

        items.add(
            new CourseScript.WaterfallItem(
                itemObject.optString("actionId"),
                itemObject.optString("actionName"),
                itemObject.optString("mediaUrl"),
                itemObject.optInt("seconds", 0),
                itemObject.optString("cue")));
      }
    }

    return new CourseScript.WaterfallSection(
        sectionObject != null ? sectionObject.optString("title", fallbackTitle) : fallbackTitle,
        items);
  }

  private List<CourseScript.VideoGroup> parseVideoGroups(JSONArray groupsArray) {
    List<CourseScript.VideoGroup> groups = new ArrayList<>();
    if (groupsArray == null) {
      return groups;
    }

    for (int index = 0; index < groupsArray.length(); index += 1) {
      JSONObject groupObject = groupsArray.optJSONObject(index);
      if (groupObject == null) {
        continue;
      }

      groups.add(
          new CourseScript.VideoGroup(
              groupObject.optString("id"),
              groupObject.optString("name"),
              groupObject.optInt("screenCount", 1),
              parseVideoGroupScreens(groupObject.optJSONArray("screens"))));
    }
    return groups;
  }

  private List<CourseScript.VideoGroupScreen> parseVideoGroupScreens(JSONArray screensArray) {
    List<CourseScript.VideoGroupScreen> screens = new ArrayList<>();
    if (screensArray == null) {
      return screens;
    }

    for (int index = 0; index < screensArray.length(); index += 1) {
      JSONObject screenObject = screensArray.optJSONObject(index);
      if (screenObject == null) {
        continue;
      }

      screens.add(
          new CourseScript.VideoGroupScreen(
              screenObject.optInt("screenIndex", index + 1),
              screenObject.optString("stationLabel"),
              parseVideoCards(screenObject.optJSONArray("videoCards"))));
    }

    return screens;
  }

  private List<CourseScript.VideoCard> parseVideoCards(JSONArray cardsArray) {
    List<CourseScript.VideoCard> cards = new ArrayList<>();
    if (cardsArray == null) {
      return cards;
    }

    for (int index = 0; index < cardsArray.length(); index += 1) {
      JSONObject cardObject = cardsArray.optJSONObject(index);
      if (cardObject == null) {
        continue;
      }

      cards.add(
          new CourseScript.VideoCard(
              cardObject.optString("actionId"),
              cardObject.optString("actionName"),
              cardObject.optString("mediaUrl"),
              cardObject.optString("stationNumber")));
    }

    return cards;
  }

  private List<CourseScript.Pod> parsePods(JSONArray podsArray) {
    List<CourseScript.Pod> pods = new ArrayList<>();
    if (podsArray == null) {
      return pods;
    }

    for (int index = 0; index < podsArray.length(); index += 1) {
      JSONObject podObject = podsArray.optJSONObject(index);
      if (podObject == null) {
        continue;
      }

      pods.add(
          new CourseScript.Pod(
              podObject.optString("name"),
              podObject.optString("videoGroupId"),
              podObject.optString("ending"),
              parsePodScreens(podObject.optJSONArray("screens"))));
    }

    return pods;
  }

  private List<CourseScript.PodScreen> parsePodScreens(JSONArray screensArray) {
    List<CourseScript.PodScreen> screens = new ArrayList<>();
    if (screensArray == null) {
      return screens;
    }

    for (int index = 0; index < screensArray.length(); index += 1) {
      JSONObject screenObject = screensArray.optJSONObject(index);
      if (screenObject == null) {
        continue;
      }

      screens.add(
          new CourseScript.PodScreen(
              screenObject.optInt("screenIndex", index + 1),
              screenObject.optInt("loopCount", 0),
              screenObject.optInt("stationRestSeconds", 0),
              parseSetConfigs(screenObject.optJSONArray("setConfigs"))));
    }

    return screens;
  }

  private List<CourseScript.PodSetConfig> parseSetConfigs(JSONArray setConfigsArray) {
    List<CourseScript.PodSetConfig> setConfigs = new ArrayList<>();
    if (setConfigsArray == null) {
      return setConfigs;
    }

    for (int index = 0; index < setConfigsArray.length(); index += 1) {
      JSONObject setConfigObject = setConfigsArray.optJSONObject(index);
      if (setConfigObject == null) {
        continue;
      }

      setConfigs.add(
          new CourseScript.PodSetConfig(
              setConfigObject.optInt("workSeconds", 0),
              setConfigObject.optInt("restSeconds", 0)));
    }

    return setConfigs;
  }

  private static class CachedResource {
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
