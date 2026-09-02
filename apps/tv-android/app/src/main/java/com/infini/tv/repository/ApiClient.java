package com.infini.tv.repository;

import android.util.Log;
import com.infini.tv.BuildConfig;
import com.infini.tv.diagnostics.DiagnosticEvent;
import com.infini.tv.diagnostics.TvDiagnostics;
import java.io.File;
import java.util.Collections;
import java.util.Map;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONException;
import org.json.JSONObject;

final class ApiClient {
  private static final String TAG = "InfiniApiClient";
  private static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");
  private final OkHttpClient httpClient;
  private int secureApiFailureCount = 0;

  ApiClient(OkHttpClient httpClient) {
    this.httpClient = httpClient;
  }

  JSONObject requestJson(String relativePath, String method, JSONObject body) throws IOException {
    return withFallback(relativePath, base -> requestJsonWithBase(base, relativePath, method, body), true);
  }

  /** Streams a retryable file through the same URL/fallback policy as ordinary API requests. */
  JSONObject requestFile(String relativePath, File file, Map<String, String> headers) throws IOException {
    return withFallback(relativePath, base -> requestWithBase(base, relativePath, "POST",
        RequestBody.create(file, MediaType.get("application/x-ndjson; charset=utf-8")), headers), false);
  }

  private interface Attempt { JSONObject run(String base) throws IOException; }

  /** Keeps all production/backup selection in the transport boundary. */
  private JSONObject withFallback(String relativePath, Attempt attempt, boolean retryHttpErrors) throws IOException {
    IOException lastError = null;
    List<String> candidates = apiBaseUrlCandidates();
    for (int index = 0; index < candidates.size(); index += 1) {
      String apiBaseUrl = candidates.get(index);
      try {
        JSONObject result = attempt.run(apiBaseUrl);
        if (isPrimaryApiBaseUrl(apiBaseUrl)) {
          resetSecureApiFailures();
        }
        return result;
      } catch (IOException error) {
        if (!retryHttpErrors && error instanceof HttpFailure) throw error;
        lastError = error;
        Log.w(TAG, "API request failed via " + apiBaseUrl + relativePath, error);
        if (isPrimaryApiBaseUrl(apiBaseUrl)) {
          recordSecureApiFailure();
          if (shouldUseHttpBackup() && !candidates.contains(ServerConfig.BACKUP_API_BASE_URL)) {
            candidates.add(ServerConfig.BACKUP_API_BASE_URL);
          }
        }
      }
    }
    throw lastError == null ? new IOException("TV 端未拿到课程数据。") : lastError;
  }

  JSONObject requestJsonWithBase(String apiBaseUrl, String relativePath, String method, JSONObject body)
      throws IOException {
    return requestWithBase(apiBaseUrl, relativePath, method,
        body == null ? null : RequestBody.create(body.toString().getBytes(StandardCharsets.UTF_8), JSON_MEDIA_TYPE),
        Collections.emptyMap());
  }

  /** Shared headers, response parsing and error classification for JSON and file uploads. */
  private JSONObject requestWithBase(String apiBaseUrl, String relativePath, String method,
      RequestBody body, Map<String, String> headers) throws IOException {
    Request.Builder requestBuilder =
        new Request.Builder()
            .url(apiBaseUrl + relativePath)
            .header("Accept", "application/json")
            .header("X-Infini-Client", "tv-android")
            .header("X-Infini-App-Version", BuildConfig.VERSION_NAME);
    for (Map.Entry<String, String> header : headers.entrySet()) {
      requestBuilder.header(header.getKey(), header.getValue());
    }
    String normalizedMethod = method == null ? "GET" : method.toUpperCase(Locale.US);
    if (body != null) {
      requestBuilder.method(normalizedMethod, body);
    } else if ("GET".equals(normalizedMethod)) {
      requestBuilder.get();
    } else {
      requestBuilder.method(normalizedMethod, null);
    }

    StringBuilder builder = new StringBuilder();
    try (Response response = httpClient.newCall(requestBuilder.build()).execute()) {
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
        throw new HttpFailure(response.code(),
            "TV 接口请求失败 ("
                + response.code()
                + ") "
                + (builder.length() == 0 ? "未返回详情。" : builder.toString()));
      }
    }

    try {
      return new JSONObject(builder.toString());
    } catch (JSONException error) {
      if (!relativePath.startsWith("/tv/diagnostics")) {
        TvDiagnostics.report(DiagnosticEvent.Type.API_ERROR, "INVALID_JSON", "API returned invalid JSON", error,
            Collections.singletonMap("endpoint", apiBaseUrl + relativePath));
      }
      throw new IOException("TV 端解析课程数据失败。", error);
    }
  }

  /** Exposes HTTP status to the diagnostic retry policy without parsing exception messages. */
  static final class HttpFailure extends IOException {
    final int status;
    HttpFailure(int status, String message) { super(message); this.status = status; }
  }

  List<String> apiBaseUrlCandidates() {
    return ConnectionFallbackPolicy.baseUrlCandidates(
        ServerConfig.API_BASE_URL, ServerConfig.BACKUP_API_BASE_URL, shouldUseHttpBackup());
  }

  List<String> baseUrlCandidates() {
    return ConnectionFallbackPolicy.baseUrlCandidates(
        ServerConfig.BASE_URL, ServerConfig.BACKUP_BASE_URL, shouldUseHttpBackup());
  }

  List<String> resolveMediaUrlCandidates(String url) {
    return ConnectionFallbackPolicy.resolveMediaUrlCandidates(
        url,
        ServerConfig.BASE_URL,
        ServerConfig.API_BASE_URL,
        ServerConfig.BACKUP_BASE_URL,
        ServerConfig.BACKUP_API_BASE_URL,
        shouldUseHttpBackup());
  }

  synchronized void recordSecureApiFailure() {
    secureApiFailureCount += 1;
  }

  synchronized void resetSecureApiFailures() {
    secureApiFailureCount = 0;
  }

  synchronized boolean shouldUseHttpBackup() {
    return ConnectionFallbackPolicy.shouldUseBackup(
        secureApiFailureCount, ServerConfig.SECURE_FALLBACK_FAILURE_THRESHOLD);
  }

  private boolean isPrimaryApiBaseUrl(String apiBaseUrl) {
    return ServerConfig.API_BASE_URL.equals(apiBaseUrl);
  }
}
