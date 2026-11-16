package com.infini.tv.repository;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class MediaDownloadRetryPolicyTest {
  @Test
  public void isRetryableStatus_onlyAllowsTemporaryFailures() {
    assertTrue(MediaDownloadRetryPolicy.isRetryableStatus(429));
    assertTrue(MediaDownloadRetryPolicy.isRetryableStatus(503));
    assertFalse(MediaDownloadRetryPolicy.isRetryableStatus(404));
    assertFalse(MediaDownloadRetryPolicy.isRetryableStatus(401));
  }

  @Test
  public void delayMs_prefersRetryAfterAndBoundsExponentialDelay() {
    assertEquals(5_000L, MediaDownloadRetryPolicy.delayMs(1, "5"));
    assertEquals(1_000L, MediaDownloadRetryPolicy.delayMs(1, ""));
    assertEquals(2_000L, MediaDownloadRetryPolicy.delayMs(2, "invalid"));
    assertEquals(30_000L, MediaDownloadRetryPolicy.delayMs(8, "120"));
  }
}
