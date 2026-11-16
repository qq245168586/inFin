package com.infini.tv.repository;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ServerConfigTest {
  @Test
  public void normalizeAccountNamespace_trimsAndLowercasesVenueIds() {
    assertEquals("venue-abc", ServerConfig.normalizeAccountNamespace("  Venue-ABC  "));
    assertEquals("", ServerConfig.normalizeAccountNamespace(null));
  }

  @Test
  public void buildTopics_useUnboundTopicWhenNamespaceIsMissing() {
    assertEquals("infini/tv/control/__unbound__", ServerConfig.buildControlTopic(""));
    assertEquals("infini/tv/session/__unbound__", ServerConfig.buildSessionTopic(null));
  }

  @Test
  public void buildTopics_appendNormalizedBoundNamespace() {
    assertEquals("infini/tv/control/venue-1", ServerConfig.buildControlTopic(" Venue-1 "));
    assertEquals("infini/tv/session/venue-1", ServerConfig.buildSessionTopic(" Venue-1 "));
  }

  @Test
  public void mqttBrokerUris_keepsPrimaryFirstAndBackupSecond() {
    assertArrayEquals(
        new String[] {ServerConfig.MQTT_WSS_URL},
        ServerConfig.mqttBrokerUris(false));
    assertArrayEquals(
        new String[] {ServerConfig.MQTT_WSS_URL},
        ServerConfig.mqttBrokerUris(true));
  }

  @Test
  public void normalizeRemoteUrl_upgradesLegacyProductionHttpUrls() {
    assertEquals(
        ServerConfig.BASE_URL + "/api/media/example.mp4",
        ServerConfig.normalizeRemoteUrl("http://8.130.65.113:80/api/media/example.mp4"));
    assertEquals(
        "https://cdn.example.test/example.mp4",
        ServerConfig.normalizeRemoteUrl("http://cdn.example.test/example.mp4"));
    assertEquals(
        ServerConfig.BASE_URL + "/api/media/example.mp4",
        ServerConfig.normalizeRemoteUrl("https://api.infintraining.work/api/media/example.mp4"));
    assertEquals(
        ServerConfig.BASE_URL + "/api/media/example.mp4",
        ServerConfig.normalizeRemoteUrl("https://114.215.185.184/api/media/example.mp4"));
    assertEquals(
        ServerConfig.BASE_URL + "/api/media/example.mp4",
        ServerConfig.normalizeRemoteUrl("https://course.infintraining.work/api/media/example.mp4"));
    assertEquals(
        ServerConfig.BASE_URL + "/api/media/example.mp4",
        ServerConfig.normalizeRemoteUrl("/infini/api/media/example.mp4"));
    assertEquals(
        "https://cdn.example.test:8443/example.mp4",
        ServerConfig.normalizeRemoteUrl("https://cdn.example.test:8443/example.mp4"));
  }
}
