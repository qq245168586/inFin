package com.infini.tv.repository;

import java.util.LinkedHashMap;
import java.util.Map;

/** Builds stable identity headers for TV media-cache downloads. */
final class MediaDownloadRequestHeaders {
  static final String HEADER_INTENT = "X-Infini-Media-Intent";
  static final String HEADER_DEVICE_ID = "X-Infini-Device-Id";
  static final String HEADER_SCREEN_NUMBER = "X-Infini-Screen-Number";
  static final String HEADER_CHECKSUM = "X-Infini-Media-Checksum";
  static final String HEADER_APP_VERSION = "X-Infini-App-Version";

  private MediaDownloadRequestHeaders() {}

  static Map<String, String> create(
      String deviceId, int screenNumber, String checksum, String appVersion) {
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put(HEADER_INTENT, "cache");
    putIfPresent(headers, HEADER_DEVICE_ID, deviceId);
    if (screenNumber > 0) {
      headers.put(HEADER_SCREEN_NUMBER, String.valueOf(screenNumber));
    }
    putIfPresent(headers, HEADER_CHECKSUM, checksum);
    putIfPresent(headers, HEADER_APP_VERSION, appVersion);
    return headers;
  }

  private static void putIfPresent(Map<String, String> headers, String name, String value) {
    String normalized = value == null ? "" : value.trim();
    if (!normalized.isEmpty()) {
      headers.put(name, normalized);
    }
  }
}
