package com.infini.tv.repository;

import com.infini.tv.diagnostics.DiagnosticUploadPump;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import okhttp3.EventListener;
import org.json.JSONObject;

/** Isolated log transport: no recursive reporting and no changes to business API fallback state. */
public final class DiagnosticUploadClient implements DiagnosticUploadPump.Transport {
  private final ApiClient client;

  /** Uses a separate fallback counter and suppresses observers only on the log client. */
  public DiagnosticUploadClient() {
    this(new ApiClient(TvScriptRepositoryCoreApi.API_HTTP_CLIENT.newBuilder()
        .eventListener(EventListener.NONE).retryOnConnectionFailure(false)
        .callTimeout(15, TimeUnit.SECONDS).build()));
  }

  DiagnosticUploadClient(ApiClient client) { this.client = client; }

  /** Deletes a queued file only after the server acknowledges this exact retry-stable log id. */
  @Override public int upload(File file, JSONObject event, String pairToken) throws IOException {
    Map<String, String> headers = new HashMap<>();
    headers.put("X-Infini-Device-Id", event.optString("deviceId"));
    headers.put("X-Infini-Namespace", event.optString("accountNamespace"));
    headers.put("X-Infini-Screen-Number", String.valueOf(event.optInt("screenNumber")));
    headers.put("X-Infini-App-Version", event.optString("appVersion"));
    headers.put("X-Infini-Pair-Token", pairToken.trim().toUpperCase(Locale.US));
    headers.put("X-Infini-Log-Id", event.optString("id"));
    try {
      JSONObject result = client.requestFile("/tv/diagnostics", file, headers);
      JSONObject data = result.optJSONObject("data");
      if (data == null || !event.optString("id").equals(data.optString("logId"))) {
        throw new IOException("Diagnostic upload acknowledgement missing");
      }
      return 200;
    } catch (ApiClient.HttpFailure error) { return error.status; }
  }
}
