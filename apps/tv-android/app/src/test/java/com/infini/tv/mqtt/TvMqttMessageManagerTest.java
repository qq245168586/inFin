package com.infini.tv.mqtt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.infini.tv.repository.ServerConfig;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;
import org.junit.Test;

public class TvMqttMessageManagerTest {
  @Test
  public void handleMessage_deliversAccountScopedRefreshOnlyForBoundVenue() {
    RecordingListener listener = new RecordingListener();
    TestMqttManager manager = new TestMqttManager("venue-a", true, listener);

    manager.receive(
        ServerConfig.buildControlTopic("venue-a"),
        "{\"type\":\"refresh_checksum\",\"venueId\":\"venue-a\"}");
    manager.receive(
        ServerConfig.buildControlTopic("venue-b"),
        "{\"type\":\"refresh_checksum\",\"venueId\":\"venue-b\"}");

    assertEquals(1, listener.refreshCount);
  }

  @Test
  public void handleMessage_deliversPairingAndUpdateCommandsWithoutAccountScope() {
    RecordingListener listener = new RecordingListener();
    TestMqttManager manager = new TestMqttManager("", false, listener);

    manager.receive(
        ServerConfig.buildControlTopic(""),
        "{\"type\":\"assign_screen\",\"deviceId\":\"tv-1\",\"screenNumber\":2,\"venueId\":\"venue-a\"}");
    manager.receive(
        ServerConfig.buildControlTopic(""),
        "{\"type\":\"install_app_update\",\"deviceId\":\"tv-1\",\"screenNumber\":2,"
            + "\"packageId\":\"pkg-1\",\"version\":\"1.0.64\",\"downloadUrl\":\"https://cdn/app.apk\","
            + "\"checksum\":\"abc\"}");

    assertEquals("tv-1", listener.assignedDeviceId);
    assertEquals(2, listener.assignedScreenNumber);
    assertEquals("venue-a", listener.assignedNamespace);
    assertEquals("pkg-1", listener.packageId);
    assertEquals("1.0.64", listener.packageVersion);
    assertEquals("https://cdn/app.apk", listener.downloadUrl);
    assertEquals("abc", listener.checksum);
  }

  @Test
  public void handleMessage_deliversPlaybackCommandsOnlyForCurrentVenue() {
    RecordingListener listener = new RecordingListener();
    TestMqttManager manager = new TestMqttManager("venue-a", true, listener);

    manager.receive(
        ServerConfig.buildControlTopic("venue-a"),
        "{\"type\":\"start_course\",\"venueId\":\"venue-a\",\"scheduleId\":\"s-1\","
            + "\"courseId\":9,\"scheduledStartAtMs\":10,\"playbackStartAtMs\":20,"
            + "\"serverNowMs\":30,\"playbackSessionId\":\"ps-1\",\"bundleChecksum\":\"sum\"}");
    manager.receive(
        ServerConfig.buildControlTopic("venue-b"),
        "{\"type\":\"terminate_course\",\"venueId\":\"venue-b\",\"scheduleId\":\"s-2\","
            + "\"courseId\":10,\"playbackSessionId\":\"ps-2\"}");

    assertEquals("s-1", listener.startedScheduleId);
    assertEquals(9, listener.startedCourseId);
    assertEquals(10L, listener.scheduledStartAtMs);
    assertEquals(20L, listener.playbackStartAtMs);
    assertEquals(30L, listener.serverNowMs);
    assertEquals("ps-1", listener.playbackSessionId);
    assertEquals("sum", listener.bundleChecksum);
    assertEquals("", listener.terminatedScheduleId);
  }

  @Test
  public void handleMessage_extractsNamespaceFromTopicWhenPayloadOmitsVenue() {
    RecordingListener listener = new RecordingListener();
    TestMqttManager manager = new TestMqttManager("venue-a", true, listener);

    manager.receive(
        ServerConfig.buildSessionTopic("venue-a"),
        "{\"type\":\"session_updated\",\"sessionId\":\"session-1\",\"version\":4,"
            + "\"state\":\"RUNNING\",\"serverNowMs\":99}");

    assertEquals("session-1", listener.sessionId);
    assertEquals(4, listener.sessionVersion);
    assertEquals("RUNNING", listener.sessionState);
    assertEquals(99L, listener.sessionServerNowMs);
  }

  @Test
  public void accountScope_rejectsUnboundOrUnmatchedMessages() throws Exception {
    TestMqttManager unbound = new TestMqttManager("venue-a", false, new RecordingListener());
    TestMqttManager bound = new TestMqttManager("venue-a", true, new RecordingListener());

    assertFalse(
        unbound.shouldHandleAccountScopedMessage(
            ServerConfig.buildControlTopic("venue-a"), new JSONObject("{\"venueId\":\"venue-a\"}")));
    assertFalse(
        bound.shouldHandleAccountScopedMessage(
            ServerConfig.buildControlTopic("venue-b"), new JSONObject("{\"venueId\":\"venue-b\"}")));
    assertTrue(
        bound.shouldHandleAccountScopedMessage(
            ServerConfig.buildControlTopic("venue-a"), new JSONObject("{}")));
  }

  @Test
  public void publishPresenceEvents_normalizeIdentifiersAndClampScreenNumber() throws Exception {
    TestMqttManager manager = new TestMqttManager("venue-a", true, new RecordingListener());

    manager.publishPairingPresence(" tv-1 ", " pair ");
    manager.publishUnboundEvent(" tv-2 ", " Venue-A ", -3, " token ");

    assertEquals(2, manager.publishedPayloads.size());
    JSONObject pairing = new JSONObject(manager.publishedPayloads.get(0));
    assertEquals("tv_pairing_presence", pairing.optString("type"));
    assertEquals("TV-1", pairing.optString("deviceId"));
    assertEquals("PAIR", pairing.optString("pairToken"));

    JSONObject unbound = new JSONObject(manager.publishedPayloads.get(1));
    assertEquals("tv_unbound", unbound.optString("type"));
    assertEquals("TV-2", unbound.optString("deviceId"));
    assertEquals("venue-a", unbound.optString("venueId"));
    assertEquals(0, unbound.optInt("screenNumber"));
    assertEquals("TOKEN", unbound.optString("pairToken"));
  }

  @Test
  public void getSubscribedTopics_usesBoundOrUnboundRoutes() {
    assertEquals(
        "infini/tv/control/venue-a",
        new TestMqttManager(" Venue-A ", true, new RecordingListener()).topics().get(0));
    assertEquals(
        "infini/tv/control/__unbound__",
        new TestMqttManager("", false, new RecordingListener()).topics().get(0));
  }

  private static final class TestMqttManager extends TvMqttMessageManager {
    final List<String> publishedPayloads = new ArrayList<>();

    TestMqttManager(String accountNamespace, boolean accountBound, Listener listener) {
      super("client-test", "", "", accountNamespace, accountBound, listener);
    }

    void receive(String topic, String payload) {
      handleMessage(topic, payload);
    }

    List<String> topics() {
      return getSubscribedTopics();
    }

    @Override
    protected void publish(String topic, String payload) {
      publishedPayloads.add(payload);
    }
  }

  private static final class RecordingListener implements TvMqttManagerTypes.Listener {
    int refreshCount;
    String assignedDeviceId = "";
    int assignedScreenNumber;
    String assignedNamespace = "";
    String packageId = "";
    String packageVersion = "";
    String downloadUrl = "";
    String checksum = "";
    String startedScheduleId = "";
    int startedCourseId;
    long scheduledStartAtMs;
    long playbackStartAtMs;
    long serverNowMs;
    String playbackSessionId = "";
    String bundleChecksum = "";
    String terminatedScheduleId = "";
    String sessionId = "";
    int sessionVersion;
    String sessionState = "";
    long sessionServerNowMs;

    @Override
    public void onMqttConnected() {}

    @Override
    public void onRefreshRequested() {
      refreshCount += 1;
    }

    @Override
    public void onAssignScreenRequested(String deviceId, int screenNumber, String accountNamespace) {
      assignedDeviceId = deviceId;
      assignedScreenNumber = screenNumber;
      assignedNamespace = accountNamespace;
    }

    @Override
    public void onUnbindScreenRequested(String deviceId) {}

    @Override
    public void onClearCacheRequested(String deviceId) {}

    @Override
    public void onInstallAppUpdateRequested(
        String deviceId,
        int screenNumber,
        String packageId,
        String version,
        String downloadUrl,
        String checksum) {
      this.packageId = packageId;
      this.packageVersion = version;
      this.downloadUrl = downloadUrl;
      this.checksum = checksum;
    }

    @Override
    public void onPreviewCourseRequested(
        String scheduleId,
        int courseId,
        long scheduledStartAtMs,
        String playbackSessionId,
        String bundleChecksum) {}

    @Override
    public void onStartCourseRequested(
        String scheduleId,
        int courseId,
        long scheduledStartAtMs,
        long playbackStartAtMs,
        long serverNowMs,
        String playbackSessionId,
        String bundleChecksum) {
      this.startedScheduleId = scheduleId;
      this.startedCourseId = courseId;
      this.scheduledStartAtMs = scheduledStartAtMs;
      this.playbackStartAtMs = playbackStartAtMs;
      this.serverNowMs = serverNowMs;
      this.playbackSessionId = playbackSessionId;
      this.bundleChecksum = bundleChecksum;
    }

    @Override
    public void onPauseCourseRequested(String scheduleId, int courseId, long pausedAtMs, String playbackSessionId) {}

    @Override
    public void onResumeCourseRequested(String scheduleId, int courseId, long resumedAtMs, String playbackSessionId) {}

    @Override
    public void onTerminateCourseRequested(String scheduleId, int courseId, String playbackSessionId) {
      terminatedScheduleId = scheduleId;
    }

    @Override
    public void onPlaybackSessionUpdated(String sessionId, int version, String state, long serverNowMs) {
      this.sessionId = sessionId;
      this.sessionVersion = version;
      this.sessionState = state;
      this.sessionServerNowMs = serverNowMs;
    }

    @Override
    public void onShowCoursePlanRequested(
        String scheduleId,
        int courseId,
        String courseName,
        String playbackSessionId,
        JSONObject coursePlan) {}
  }
}
