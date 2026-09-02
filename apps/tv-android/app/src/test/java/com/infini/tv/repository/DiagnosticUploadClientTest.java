package com.infini.tv.repository;

import static org.junit.Assert.*;
import com.infini.tv.diagnostics.DiagnosticEvent;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class DiagnosticUploadClientTest {
  @Rule public TemporaryFolder temp = new TemporaryFolder();

  private JSONObject event() throws Exception {
    Map<String, Object> identity = new HashMap<>();
    identity.put("deviceId", "TV-TEST"); identity.put("accountNamespace", "venue-test");
    identity.put("screenNumber", 1); identity.put("appVersion", "1.0.72");
    return DiagnosticEvent.create(DiagnosticEvent.Type.API_ERROR, "HTTP_503", "API unavailable", null,
        Collections.emptyMap(), identity, 1_788_000_000_000L);
  }

  private File file(JSONObject event) throws Exception {
    File file = temp.newFile(); Files.write(file.toPath(), (event.toString() + "\n").getBytes(StandardCharsets.UTF_8)); return file;
  }

  private Response response(Interceptor.Chain chain, int status, String body) {
    return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
        .code(status).message("fixture").body(ResponseBody.create(body, MediaType.get("application/json"))).build();
  }

  private ApiClient client(Interceptor interceptor) {
    return new ApiClient(new OkHttpClient.Builder().addInterceptor(interceptor).build());
  }

  @Test public void productionUploaderCanInitializeWithoutMakingAnyRequest() {
    assertNotNull(new DiagnosticUploadClient());
  }

  @Test public void sendsNdjsonFileWithBindingHeadersAndRequiresMatchingAcknowledgement() throws Exception {
    JSONObject record = event(); File file = file(record); AtomicInteger calls = new AtomicInteger();
    DiagnosticUploadClient uploader = new DiagnosticUploadClient(client(chain -> {
      calls.incrementAndGet();
      assertEquals("POST", chain.request().method());
      assertEquals("/api/tv/diagnostics", chain.request().url().encodedPath());
      assertEquals("TV-TEST", chain.request().header("X-Infini-Device-Id"));
      assertEquals("venue-test", chain.request().header("X-Infini-Namespace"));
      assertEquals("CREDENTIAL", chain.request().header("X-Infini-Pair-Token"));
      assertEquals("1.0.72", chain.request().header("X-Infini-App-Version"));
      assertEquals("application/x-ndjson", chain.request().body().contentType().type() + "/" + chain.request().body().contentType().subtype());
      Buffer buffer = new Buffer(); chain.request().body().writeTo(buffer);
      assertEquals(record.toString() + "\n", buffer.readUtf8());
      return response(chain, 201, "{\"data\":{\"logId\":\"" + record.optString("id") + "\"}}");
    }));
    assertEquals(200, uploader.upload(file, record, " credential "));
    assertEquals(1, calls.get()); assertTrue(file.exists());
  }

  @Test public void missingAcknowledgementRetainsFile() throws Exception {
    JSONObject record = event(); File file = file(record);
    DiagnosticUploadClient uploader = new DiagnosticUploadClient(client(chain -> response(chain, 200, "{\"data\":{\"logId\":\"wrong\"}}")));
    assertThrows(IOException.class, () -> uploader.upload(file, record, "credential"));
    assertTrue(file.exists());
  }

  @Test public void httpFailureReturnsStatusWithoutRetryingOverAnotherOrigin() throws Exception {
    JSONObject record = event(); File file = file(record); AtomicInteger calls = new AtomicInteger();
    ApiClient transport = client(chain -> { calls.incrementAndGet(); return response(chain, 403, "{}"); });
    assertEquals(403, new DiagnosticUploadClient(transport).upload(file, record, "credential"));
    assertEquals(1, calls.get()); assertFalse(transport.shouldUseHttpBackup());
  }

  @Test public void transportFailureUsesExistingTwoFailureFallbackOnlyForThisClient() throws Exception {
    JSONObject record = event(); File file = file(record); AtomicInteger calls = new AtomicInteger();
    ApiClient transport = client(chain -> { calls.incrementAndGet(); throw new IOException("offline"); });
    DiagnosticUploadClient uploader = new DiagnosticUploadClient(transport);
    assertThrows(IOException.class, () -> uploader.upload(file, record, "credential"));
    assertEquals(1, calls.get());
    assertThrows(IOException.class, () -> uploader.upload(file, record, "credential"));
    assertEquals(3, calls.get()); assertTrue(transport.shouldUseHttpBackup());
    assertFalse(new ApiClient(null).shouldUseHttpBackup());
  }

  @Test public void existingJsonRequestsKeepHeadersBodyParsingAndFallbackBehavior() throws Exception {
    ApiClient transport = client(chain -> {
      assertEquals("application/json", chain.request().header("Accept"));
      assertEquals("tv-android", chain.request().header("X-Infini-Client"));
      Buffer buffer = new Buffer(); chain.request().body().writeTo(buffer);
      assertEquals("{\"screenNumber\":1}", buffer.readUtf8());
      return response(chain, 200, "{\"ok\":true}");
    });
    assertTrue(transport.requestJson("/tv/screens/heartbeat", "POST", new JSONObject().put("screenNumber", 1)).getBoolean("ok"));
    ApiClient malformed = client(chain -> response(chain, 200, "not json"));
    assertThrows(IOException.class, () -> malformed.requestJson("/tv/daily-bundle", "GET", null));
  }
}
