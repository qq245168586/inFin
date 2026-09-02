package com.infini.tv.diagnostics;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.Map;
import javax.net.ssl.SSLException;
import okhttp3.Call;
import okhttp3.EventListener;
import okhttp3.Response;

/** One observer for API and download clients, including errors while consuming response bodies. */
public final class DiagnosticHttpEvents extends EventListener {
  public interface Sink {
    void report(DiagnosticEvent.Type type, String code, String message, Throwable error, Map<String, Object> context);
  }
  private final Sink sink;
  public DiagnosticHttpEvents() { this(TvDiagnostics::report); }
  public DiagnosticHttpEvents(Sink sink) { this.sink = sink; }

  /** Records transport failures without changing requests, retries or response bodies. */
  @Override public void callFailed(Call call, IOException error) {
    if (ignored(call)) return;
    String code = error instanceof SocketTimeoutException ? "TIMEOUT"
        : error instanceof SSLException ? "TLS" : error instanceof UnknownHostException ? "DNS" : "IO";
    emit(DiagnosticEvent.Type.NETWORK_ERROR, code, "HTTP transport failed", error, details(call));
  }

  /** Captures status failures even when the caller handles the response without throwing. */
  @Override public void responseHeadersEnd(Call call, Response response) {
    if (ignored(call) || response.isSuccessful()) return;
    Map<String, Object> context = details(call);
    context.put("httpStatus", response.code());
    emit(isMedia(call) ? DiagnosticEvent.Type.DOWNLOAD_ERROR : DiagnosticEvent.Type.API_ERROR,
        "HTTP_" + response.code(), "HTTP response rejected request", null, context);
  }

  /** Excludes the reporter itself and deliberate cancellation during normal lifecycle changes. */
  private boolean ignored(Call call) {
    return call.isCanceled() || call.request().url().encodedPath().endsWith("/tv/diagnostics");
  }

  private boolean isMedia(Call call) {
    String path = call.request().url().encodedPath();
    return path.contains("/media/") || path.endsWith(".mp4") || path.endsWith(".apk");
  }

  private Map<String, Object> details(Call call) {
    Map<String, Object> result = new HashMap<>();
    result.put("component", isMedia(call) ? "download" : "api");
    result.put("endpoint", call.request().url().newBuilder().query(null).fragment(null).username("").password("").build().toString());
    result.put("method", call.request().method());
    return result;
  }

  /** Observability callbacks must not throw into OkHttp. */
  private void emit(DiagnosticEvent.Type type, String code, String message, Throwable error, Map<String, Object> context) {
    try { sink.report(type, code, message, error, context); } catch (Throwable ignored) { }
  }
}
