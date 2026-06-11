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

abstract class TvScriptRepositoryPart04 extends TvScriptRepositoryPart03 {
  private static int secureApiFailureCount = 0;

  protected TvScriptRepositoryPart04(Context context) {
    super(context);
  }

  protected JSONObject buildScreenPayload(
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

  protected void ensureCacheRoot() {
    if (!mediaCacheRoot.exists()) {
      mediaCacheRoot.mkdirs();
    }
  }

  protected ScreenRegistration parseScreenRegistration(JSONObject response) {
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

  protected CurrentPlaybackSession parseCurrentPlaybackSession(JSONObject response) {
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

  protected PlaybackSessionSnapshot parsePlaybackSessionSnapshot(JSONObject sessionObject) {
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

  protected JSONObject requestJson(String relativePath, String method, JSONObject body) throws IOException {
    IOException lastError = null;
    List<String> candidates = apiBaseUrlCandidates();
    for (int index = 0; index < candidates.size(); index += 1) {
      String apiBaseUrl = candidates.get(index);
      try {
        JSONObject result = requestJsonWithBase(apiBaseUrl, relativePath, method, body);
        if (ServerConfig.API_BASE_URL.equals(apiBaseUrl)) {
          resetSecureApiFailures();
        }
        return result;
      } catch (IOException error) {
        lastError = error;
        Log.w(TAG, "API request failed via " + apiBaseUrl + relativePath, error);
        if (ServerConfig.API_BASE_URL.equals(apiBaseUrl)) {
          recordSecureApiFailure();
          if (shouldUseHttpBackup() && !candidates.contains(ServerConfig.BACKUP_API_BASE_URL)) {
            candidates.add(ServerConfig.BACKUP_API_BASE_URL);
          }
        }
      }
    }
    throw lastError == null ? new IOException("TV 端未拿到课程数据。") : lastError;
  }

  protected String resolveMediaUrl(String url) {
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

  protected JSONObject requestJsonWithBase(
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

  protected List<String> apiBaseUrlCandidates() {
    List<String> candidates = new ArrayList<>();
    candidates.add(ServerConfig.API_BASE_URL);
    if (shouldUseHttpBackup() && !ServerConfig.BACKUP_API_BASE_URL.equals(ServerConfig.API_BASE_URL)) {
      candidates.add(ServerConfig.BACKUP_API_BASE_URL);
    }
    return candidates;
  }

  protected List<String> baseUrlCandidates() {
    List<String> candidates = new ArrayList<>();
    candidates.add(ServerConfig.BASE_URL);
    if (shouldUseHttpBackup() && !ServerConfig.BACKUP_BASE_URL.equals(ServerConfig.BASE_URL)) {
      candidates.add(ServerConfig.BACKUP_BASE_URL);
    }
    return candidates;
  }

  protected List<String> resolveMediaUrlCandidates(String url) {
    List<String> candidates = new ArrayList<>();
    if (url == null) {
      return candidates;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      candidates.add(url);
      if (shouldUseHttpBackup() && url.startsWith(ServerConfig.BASE_URL + "/")) {
        candidates.add(ServerConfig.BACKUP_BASE_URL + url.substring(ServerConfig.BASE_URL.length()));
      } else if (shouldUseHttpBackup() && url.startsWith(ServerConfig.API_BASE_URL + "/")) {
        candidates.add(ServerConfig.BACKUP_API_BASE_URL + url.substring(ServerConfig.API_BASE_URL.length()));
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

  private static synchronized void recordSecureApiFailure() {
    secureApiFailureCount += 1;
  }

  private static synchronized void resetSecureApiFailures() {
    secureApiFailureCount = 0;
  }

  private static synchronized boolean shouldUseHttpBackup() {
    return secureApiFailureCount >= ServerConfig.SECURE_FALLBACK_FAILURE_THRESHOLD;
  }
}
