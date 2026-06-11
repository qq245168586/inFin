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

abstract class TvScriptRepositoryPart02 extends TvScriptRepositoryPart01 {
  protected TvScriptRepositoryPart02(Context context) {
    super(context);
  }

  public List<AppPackageInfo> listAppPackages() throws IOException {
    JSONObject response = requestJson("/app-packages?platform=tv");
    JSONObject data = response.optJSONObject("data");
    JSONArray packagesArray = data == null ? null : data.optJSONArray("packages");
    List<AppPackageInfo> packages = new ArrayList<>();
    if (packagesArray == null) {
      return packages;
    }

    for (int index = 0; index < packagesArray.length(); index += 1) {
      JSONObject item = packagesArray.optJSONObject(index);
      if (item == null) {
        continue;
      }
      packages.add(
          new AppPackageInfo(
              item.optString("id", ""),
              item.optString("version", ""),
              item.optString("label", ""),
              item.optString("filename", ""),
              item.optString("downloadPath", ""),
              item.optString("checksum", ""),
              item.optLong("sizeBytes", 0L),
              item.optString("updateTime", "")));
    }
    return packages;
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
        if (!tempFile.exists() || tempFile.length() <= 0L || downloadedBytes <= 0L) {
          throw new IOException("安装包下载失败，文件为空。url=" + resolvedUrl);
        }
        Log.d(
            TAG,
            "App package downloaded via "
                + resolvedUrl
                + ", bytes="
                + downloadedBytes
                + ", contentLength="
                + totalBytes);
        lastError = null;
        break;
      } catch (IOException error) {
        lastError = error;
        if (tempFile.exists()) {
          tempFile.delete();
        }
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

  protected List<TvScheduleItem> parseBundleSchedules(
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

  protected void ensureAppUpdateRoot() {
    if (!appUpdateRoot.exists()) {
      appUpdateRoot.mkdirs();
    }
  }

  protected void clearStaleAppPackages(String keepFilename) {
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

  protected String calculateSha256(File targetFile) throws IOException {
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

  protected List<String> resolveAbsoluteUrlCandidates(String downloadUrl) {
    String url = downloadUrl == null ? "" : downloadUrl.trim();
    if (url.isEmpty()) {
      return Collections.emptyList();
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      List<String> candidates = new ArrayList<>();
      candidates.add(url);
      for (String baseUrl : baseUrlCandidates()) {
        if (!url.startsWith(baseUrl + "/") && url.startsWith(ServerConfig.BASE_URL + "/")) {
          candidates.add(baseUrl + url.substring(ServerConfig.BASE_URL.length()));
        }
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

  protected TvScheduleItem parseScheduleItem(
      JSONObject scheduleObject, Map<String, String> localMediaMap, boolean requireToday) {
    if (scheduleObject == null) {
      return null;
    }

    JSONObject courseObject = scheduleObject.optJSONObject("course");
    JSONObject scriptObject = courseObject != null ? courseObject.optJSONObject("script") : null;
    CourseScript course =
        scriptObject != null
            ? localizeCourseScript(withCourseListingMetadata(parseCourseScript(scriptObject), courseObject), localMediaMap)
            : null;

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
        extractCourseLogoSource(courseObject, localMediaMap),
        readScheduleDisplayFields(scheduleObject, courseObject));
  }

  protected TvScheduleItem.ScheduleDisplayFields readScheduleDisplayFields(
      JSONObject scheduleObject, JSONObject courseObject) {
    return new TvScheduleItem.ScheduleDisplayFields(
        readDisplayText("set", scheduleObject, courseObject),
        readDisplayText("work", scheduleObject, courseObject),
        readDisplayText("rest", scheduleObject, courseObject),
        readDisplayText("switch", scheduleObject, courseObject),
        readDisplayText("port", scheduleObject, courseObject),
        readDisplayText("leader", scheduleObject, courseObject));
  }

  protected String readDisplayText(String field, JSONObject scheduleObject, JSONObject courseObject) {
    if (field == null) {
      return "";
    }
    String lower = field.trim().toLowerCase(Locale.US);
    String title = lower.substring(0, 1).toUpperCase(Locale.US) + lower.substring(1);
    String[] keys =
        new String[] {
          lower,
          title,
          lower + "Text",
          title + "Text",
          "manual" + title,
          "schedule" + title
        };
    String value = firstDisplayText(scheduleObject, keys);
    if (!value.isEmpty()) {
      return value;
    }
    value = firstDisplayText(courseObject, keys);
    if (!value.isEmpty()) {
      return value;
    }
    value = firstNestedDisplayText(scheduleObject, keys);
    if (!value.isEmpty()) {
      return value;
    }
    return firstNestedDisplayText(courseObject, keys);
  }

  protected String firstNestedDisplayText(JSONObject object, String[] keys) {
    if (object == null) {
      return "";
    }
    String[] containers =
        new String[] {
          "scheduleDisplay",
          "display",
          "displayFields",
          "stationRules",
          "siteRules",
          "tvDisplay",
          "tvSchedule",
          "trainingPanel"
        };
    for (String container : containers) {
      JSONObject nested = object.optJSONObject(container);
      String value = firstDisplayText(nested, keys);
      if (!value.isEmpty()) {
        return value;
      }
    }
    JSONObject script = object.optJSONObject("script");
    JSONObject metadata = script == null ? null : script.optJSONObject("metadata");
    String value = firstDisplayText(metadata, keys);
    if (!value.isEmpty()) {
      return value;
    }
    for (String container : containers) {
      JSONObject nested = metadata == null ? null : metadata.optJSONObject(container);
      value = firstDisplayText(nested, keys);
      if (!value.isEmpty()) {
        return value;
      }
    }
    return "";
  }

  protected String firstDisplayText(JSONObject object, String[] keys) {
    if (object == null || keys == null) {
      return "";
    }
    for (String key : keys) {
      if (key == null || key.trim().isEmpty() || !object.has(key)) {
        continue;
      }
      String value = object.optString(key, "").trim();
      if (!value.isEmpty()) {
        return value;
      }
    }
    return "";
  }

  protected CourseScript withCourseListingMetadata(CourseScript source, JSONObject courseObject) {
    if (source == null || source.metadata == null) {
      return source;
    }

    String description = firstNonBlank(courseObject != null ? courseObject.optString("description", "") : "", source.metadata.description);
    String topic =
        firstNonBlank(
            courseObject != null ? courseObject.optString("topic", "") : "",
            source.metadata.topic,
            inferCourseTopic(courseObject));
    String rotationType =
        normalizeRotationType(
            firstNonBlank(
                courseObject != null ? courseObject.optString("rotationType", "") : "",
                source.metadata.rotationType,
                "REGION"));
    CourseScript.Metadata metadata =
        new CourseScript.Metadata(
            source.metadata.id,
            firstNonBlank(source.metadata.name, courseObject != null ? courseObject.optString("name", "") : ""),
            source.metadata.version,
            source.metadata.creator,
            source.metadata.defaultHydrateSeconds,
            source.metadata.readyWarmupSeconds,
            source.metadata.readyWorkoutSeconds,
            source.metadata.readyCooldownSeconds,
            source.metadata.setCount,
            source.metadata.breakCount,
            source.metadata.workSeconds,
            source.metadata.restSeconds,
            description,
            topic,
            rotationType);
    return new CourseScript(
        metadata, source.warmup, source.cooldown, source.videoGroups, source.pods, source.plan);
  }

  protected String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }
    for (String value : values) {
      if (value != null && !value.trim().isEmpty()) {
        return value.trim();
      }
    }
    return "";
  }

  protected String normalizeRotationType(String value) {
    String normalized = value == null ? "" : value.trim().toUpperCase(Locale.US);
    if ("LANE".equals(normalized) || "SNAKE".equals(normalized) || "REGION".equals(normalized)) {
      return normalized;
    }
    return "REGION";
  }

  protected String inferCourseTopic(JSONObject courseObject) {
    if (courseObject == null) {
      return "";
    }
    JSONArray typesArray = courseObject.optJSONArray("types");
    if (typesArray == null) {
      typesArray = courseObject.optJSONArray("courseTypes");
    }
    if (typesArray == null || typesArray.length() == 0) {
      return "";
    }
    JSONObject firstTypeObject = typesArray.optJSONObject(0);
    if (firstTypeObject != null) {
      return firstNonBlank(firstTypeObject.optString("name", ""), firstTypeObject.optString("title", ""));
    }
    return typesArray.optString(0, "");
  }
}
