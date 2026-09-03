package com.infini.tv.repository;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import org.junit.Test;

public class ConnectionFallbackPolicyTest {
  private static final String BASE = "https://primary.example.test";
  private static final String API = BASE + "/api";
  private static final String BACKUP = "https://backup.example.test";
  private static final String BACKUP_API = BACKUP + "/api";

  @Test
  public void shouldUseBackup_respectsFailureThresholdBoundary() {
    assertFalse(ConnectionFallbackPolicy.shouldUseBackup(1, 2));
    assertTrue(ConnectionFallbackPolicy.shouldUseBackup(2, 2));
  }

  @Test
  public void resolveMediaUrlCandidates_keepsPrimaryOnlyBeforeFallback() {
    assertEquals(
        Arrays.asList(API + "/bundle.json"),
        ConnectionFallbackPolicy.resolveMediaUrlCandidates(
            "bundle.json", BASE, API, BACKUP, BACKUP_API, false));
  }

  @Test
  public void resolveMediaUrlCandidates_rewritesRelativeAndAbsolutePrimaryUrlsForFallback() {
    assertEquals(
        Arrays.asList(BASE + "/media/a.mp4", BACKUP + "/media/a.mp4"),
        ConnectionFallbackPolicy.resolveMediaUrlCandidates(
            "/media/a.mp4", BASE, API, BACKUP, BACKUP_API, true));

    assertEquals(
        Arrays.asList(BASE + "/media/a.mp4", BACKUP + "/media/a.mp4"),
        ConnectionFallbackPolicy.resolveMediaUrlCandidates(
            BASE + "/media/a.mp4", BASE, API, BACKUP, BACKUP_API, true));

    assertEquals(
        Arrays.asList(API + "/bundle.json", BACKUP_API + "/bundle.json"),
        ConnectionFallbackPolicy.resolveMediaUrlCandidates(
            "bundle.json", BASE, API, BACKUP, BACKUP_API, true));
  }

  @Test
  public void brokerUris_addsMqttBackupOnlyWhenRequested() {
    assertArrayEquals(
        new String[] {"wss://primary.example.test/mqtt"},
        ConnectionFallbackPolicy.brokerUris(
            "wss://primary.example.test/mqtt", "wss://backup.example.test/mqtt", false));
    assertArrayEquals(
        new String[] {"wss://primary.example.test/mqtt", "wss://backup.example.test/mqtt"},
        ConnectionFallbackPolicy.brokerUris(
            "wss://primary.example.test/mqtt", "wss://backup.example.test/mqtt", true));
  }
}
