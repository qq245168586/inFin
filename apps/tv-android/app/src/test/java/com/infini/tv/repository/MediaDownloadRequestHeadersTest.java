package com.infini.tv.repository;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.util.Map;
import org.junit.Test;

public class MediaDownloadRequestHeadersTest {
  @Test
  public void create_includesStableTvMediaIdentity() {
    Map<String, String> headers =
        MediaDownloadRequestHeaders.create("TV-ABC123", 3, "checksum-1", "1.0.69");

    assertEquals("cache", headers.get(MediaDownloadRequestHeaders.HEADER_INTENT));
    assertEquals("TV-ABC123", headers.get(MediaDownloadRequestHeaders.HEADER_DEVICE_ID));
    assertEquals("3", headers.get(MediaDownloadRequestHeaders.HEADER_SCREEN_NUMBER));
    assertEquals("checksum-1", headers.get(MediaDownloadRequestHeaders.HEADER_CHECKSUM));
    assertEquals("1.0.69", headers.get(MediaDownloadRequestHeaders.HEADER_APP_VERSION));
  }

  @Test
  public void create_omitsUnknownOptionalIdentity() {
    Map<String, String> headers = MediaDownloadRequestHeaders.create("", 0, "", "1.0.69");

    assertEquals("cache", headers.get(MediaDownloadRequestHeaders.HEADER_INTENT));
    assertFalse(headers.containsKey(MediaDownloadRequestHeaders.HEADER_DEVICE_ID));
    assertFalse(headers.containsKey(MediaDownloadRequestHeaders.HEADER_SCREEN_NUMBER));
    assertFalse(headers.containsKey(MediaDownloadRequestHeaders.HEADER_CHECKSUM));
  }
}
