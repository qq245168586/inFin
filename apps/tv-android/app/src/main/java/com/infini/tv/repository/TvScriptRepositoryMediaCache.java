package com.infini.tv.repository;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import android.util.Log;
import com.infini.tv.BuildConfig;
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

abstract class TvScriptRepositoryMediaCache extends TvScriptRepositoryAppPackages {
  private static final String APP_PREFS_NAME = "infini_tv_app";
  private static final String PREF_DEVICE_ID = "device_id";
  private static final String PREF_SCREEN_NUMBER = "screen_number";

  protected TvScriptRepositoryMediaCache(Context context) {
    super(context);
  }

  protected synchronized Map<String, String> ensureResourcesCached(
      List<CachedResource> resources, SyncProgressListener listener) throws IOException {
    Map<String, String> localMediaMap = new HashMap<>();
    int total = resources.size();

    if (listener != null) {
      listener.onStatus(total == 0 ? "今天没有课程资源需要下载。" : "正在校验今日课程资源...", 0, total);
    }

    for (int index = 0; index < resources.size(); index += 1) {
      CachedResource resource = resources.get(index);
      File targetFile = resolveCacheFile(resource);
      if (targetFile.exists() && isCachedResourceValid(resource, targetFile)) {
        localMediaMap.put(resource.url, targetFile.getAbsolutePath());
        if (listener != null) {
          listener.onStatus(
              "已就绪 " + (index + 1) + "/" + total + " · " + resource.displayName(),
              index + 1,
              total);
        }
        continue;
      }
      if (targetFile.exists()) {
        targetFile.delete();
      }

      if (listener != null) {
        listener.onStatus(
            "正在下载 " + (index + 1) + "/" + total + " · " + resource.displayName(),
            index,
            total);
      }

      String failureCode = "DOWNLOAD_FAILED";
      try {
        downloadToFile(resource, targetFile);
        failureCode = "CHECKSUM_MISMATCH";
        if (!isCachedResourceValid(resource, targetFile)) {
          targetFile.delete();
          throw new IOException("课程资源校验失败，请重新同步课程资源。");
        }
      } catch (IOException error) {
        com.infini.tv.diagnostics.TvDiagnostics.report(
            com.infini.tv.diagnostics.DiagnosticEvent.Type.DOWNLOAD_ERROR,
            failureCode, "Course media cache failed", error,
            java.util.Collections.singletonMap("mediaFile", targetFile.getName()));
        throw error;
      }
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

  protected boolean isCachedResourceValid(CachedResource resource, File targetFile) {
    if (resource == null || targetFile == null || !targetFile.exists() || targetFile.length() <= 0L) {
      return false;
    }
    if (resource.sizeBytes > 0L && targetFile.length() != resource.sizeBytes) {
      return false;
    }
    if (resource.checksum != null && !resource.checksum.trim().isEmpty()) {
      try {
        return resource.checksum.equalsIgnoreCase(calculateSha256(targetFile));
      } catch (IOException error) {
        Log.w(TAG, "Unable to verify cached media checksum " + resource.displayName(), error);
        return false;
      }
    }
    return true;
  }

  protected void cleanupTemporaryDownloads() {
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

  protected void downloadToFile(CachedResource resource, File targetFile) throws IOException {
    if (targetFile.getParentFile() != null && !targetFile.getParentFile().exists()) {
      targetFile.getParentFile().mkdirs();
    }

    File tempFile = new File(targetFile.getAbsolutePath() + ".download");
    IOException lastError = null;
    SharedPreferences preferences = context.getSharedPreferences(APP_PREFS_NAME, Context.MODE_PRIVATE);
    Map<String, String> requestHeaders =
        MediaDownloadRequestHeaders.create(
            preferences.getString(PREF_DEVICE_ID, ""),
            Math.max(preferences.getInt(PREF_SCREEN_NUMBER, 0), 0),
            resource.checksum,
            BuildConfig.VERSION_NAME);

    for (String candidateUrl : resolveMediaUrlCandidates(resource.url)) {
      for (int attempt = 1; attempt <= MediaDownloadRetryPolicy.MAX_ATTEMPTS_PER_URL; attempt += 1) {
        if (tempFile.exists()) {
          tempFile.delete();
        }
        Request.Builder requestBuilder = new Request.Builder().url(candidateUrl).get();
        for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
          requestBuilder.header(header.getKey(), header.getValue());
        }

        try (Response response = DOWNLOAD_HTTP_CLIENT.newCall(requestBuilder.build()).execute()) {
          if (!response.isSuccessful()) {
            boolean retryableStatus = MediaDownloadRetryPolicy.isRetryableStatus(response.code());
            IOException statusError =
                new MediaDownloadHttpStatusException(
                    "下载视频资源失败，状态码 " + response.code(), retryableStatus);
            if (
                retryableStatus
                    && attempt < MediaDownloadRetryPolicy.MAX_ATTEMPTS_PER_URL) {
              lastError = statusError;
              waitBeforeMediaRetry(
                  candidateUrl,
                  attempt,
                  MediaDownloadRetryPolicy.delayMs(attempt, response.header("Retry-After")),
                  statusError);
              continue;
            }
            throw statusError;
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
          boolean retryable =
              !(error instanceof MediaDownloadHttpStatusException)
                  || ((MediaDownloadHttpStatusException) error).retryable;
          if (retryable && attempt < MediaDownloadRetryPolicy.MAX_ATTEMPTS_PER_URL) {
            waitBeforeMediaRetry(
                candidateUrl,
                attempt,
                MediaDownloadRetryPolicy.delayMs(attempt, ""),
                error);
            continue;
          }
          Log.w(TAG, "Media download failed via " + candidateUrl, error);
          break;
        }
      }
      if (lastError == null) {
        break;
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

  private void waitBeforeMediaRetry(
      String candidateUrl, int failedAttempt, long delayMs, IOException error) throws IOException {
    Log.w(
        TAG,
        "Media download retry url="
            + candidateUrl
            + " attempt="
            + failedAttempt
            + " delayMs="
            + delayMs,
        error);
    try {
      Thread.sleep(delayMs);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IOException("课程资源下载重试被中断。", interrupted);
    }
  }

  private static final class MediaDownloadHttpStatusException extends IOException {
    final boolean retryable;

    MediaDownloadHttpStatusException(String message, boolean retryable) {
      super(message);
      this.retryable = retryable;
    }
  }

  protected File resolveCacheFile(CachedResource resource) {
    String cacheKey = resource.cacheKey();
    return new File(mediaCacheRoot, cacheKey + resource.extension);
  }

  protected List<CachedResource> parseResources(JSONArray resourcesArray) {
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

  protected List<CachedResource> parseLogoResources(JSONArray schedulesArray) {
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

  protected String extractExtension(String filename, String url, String fallbackExtension) {
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

  protected JSONObject requestJson(String relativePath) throws IOException {
    return requestJson(relativePath, "GET", null);
  }
}
