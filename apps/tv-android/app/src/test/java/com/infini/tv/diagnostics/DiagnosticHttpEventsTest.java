package com.infini.tv.diagnostics;

import static org.junit.Assert.*;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import javax.net.ssl.SSLException;
import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import org.junit.Test;

public class DiagnosticHttpEventsTest {
  private final OkHttpClient client = new OkHttpClient();
  private Call call(String path) { return client.newCall(new Request.Builder().url("https://test.invalid" + path).build()); }
  private Response response(Call call, int status) {
    return new Response.Builder().request(call.request()).protocol(Protocol.HTTP_1_1).code(status).message("fixture").build();
  }

  @Test public void classifiesTransportAndHttpErrorsWithoutReadingBodies() {
    List<String> events = new ArrayList<>();
    DiagnosticHttpEvents observer = new DiagnosticHttpEvents((type, code, message, error, context) -> {
      assertFalse(context.get("endpoint").toString().contains("token="));
      events.add(type + ":" + code);
    });
    Call api = call("/api/tv/daily-bundle?token=secret");
    observer.callFailed(api, new SocketTimeoutException());
    observer.callFailed(api, new UnknownHostException());
    observer.callFailed(api, new SSLException("cert"));
    observer.callFailed(api, new IOException());
    observer.responseHeadersEnd(api, response(api, 503));
    Call media = call("/api/media/video.mp4?signature=hidden");
    observer.responseHeadersEnd(media, response(media, 404));
    observer.responseHeadersEnd(api, response(api, 200));
    assertEquals(java.util.Arrays.asList("NETWORK_ERROR:TIMEOUT", "NETWORK_ERROR:DNS", "NETWORK_ERROR:TLS",
        "NETWORK_ERROR:IO", "API_ERROR:HTTP_503", "DOWNLOAD_ERROR:HTTP_404"), events);
  }

  @Test public void excludesDiagnosticUploadAndCancelledCalls() {
    DiagnosticHttpEvents observer = new DiagnosticHttpEvents((type, code, message, error, context) -> fail("recursive event"));
    Call upload = call("/api/tv/diagnostics");
    observer.callFailed(upload, new IOException()); observer.responseHeadersEnd(upload, response(upload, 503));
    Call cancelled = call("/api/tv/daily-bundle"); cancelled.cancel();
    observer.callFailed(cancelled, new IOException());
  }

  @Test public void brokenReporterCannotBreakRequests() {
    DiagnosticHttpEvents observer = new DiagnosticHttpEvents((type, code, message, error, context) -> { throw new IllegalStateException(); });
    observer.callFailed(call("/api/tv/current"), new IOException());
  }

  @Test public void playerAdapterPreservesExistingRecovery() {
    java.util.concurrent.atomic.AtomicBoolean recovered = new java.util.concurrent.atomic.AtomicBoolean();
    assertTrue(PlayerDiagnostics.errorListener("training", "/local/video.mp4", "340", "1A", () -> recovered.set(true))
        .onError(null, 1, -1004));
    assertTrue(recovered.get());
    PlayerDiagnostics.missingLocalMedia("training", "");
  }
}
