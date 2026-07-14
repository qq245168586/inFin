package com.infini.tv.util;

import static org.junit.Assert.assertEquals;

import com.infini.tv.repository.MediaResourcePolicy;
import org.junit.Test;

public class ScreenMediaResourcePolicyTest {
  @Test
  public void infoScreensUseMetadataOnly() {
    assertEquals(MediaResourcePolicy.METADATA_ONLY, ScreenMediaResourcePolicy.forScreen(2));
    assertEquals(MediaResourcePolicy.METADATA_ONLY, ScreenMediaResourcePolicy.forScreen(4));
  }

  @Test
  public void videoScreensRequireCachedMedia() {
    assertEquals(MediaResourcePolicy.CACHE_REQUIRED, ScreenMediaResourcePolicy.forScreen(1));
    assertEquals(MediaResourcePolicy.CACHE_REQUIRED, ScreenMediaResourcePolicy.forScreen(3));
    assertEquals(MediaResourcePolicy.CACHE_REQUIRED, ScreenMediaResourcePolicy.forScreen(5));
  }
}
