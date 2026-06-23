package com.infini.tv.repository;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import org.junit.Test;

public class ApiClientTest {
  @Test
  public void apiClient_addsBackupCandidatesAfterSecureFailures() {
    ApiClient client = new ApiClient(null);

    assertFalse(client.shouldUseHttpBackup());
    assertEquals(Arrays.asList(ServerConfig.API_BASE_URL), client.apiBaseUrlCandidates());

    client.recordSecureApiFailure();
    assertFalse(client.shouldUseHttpBackup());
    assertEquals(Arrays.asList(ServerConfig.API_BASE_URL), client.apiBaseUrlCandidates());

    client.recordSecureApiFailure();
    assertTrue(client.shouldUseHttpBackup());
    assertEquals(
        Arrays.asList(ServerConfig.API_BASE_URL, ServerConfig.BACKUP_API_BASE_URL),
        client.apiBaseUrlCandidates());
    assertEquals(
        Arrays.asList(ServerConfig.BASE_URL, ServerConfig.BACKUP_BASE_URL),
        client.baseUrlCandidates());
  }

  @Test
  public void apiClient_resetsBackupStateAfterPrimaryRecovery() {
    ApiClient client = new ApiClient(null);

    client.recordSecureApiFailure();
    client.recordSecureApiFailure();
    assertTrue(client.shouldUseHttpBackup());

    client.resetSecureApiFailures();
    assertFalse(client.shouldUseHttpBackup());
    assertEquals(Arrays.asList(ServerConfig.API_BASE_URL), client.apiBaseUrlCandidates());
  }
}
