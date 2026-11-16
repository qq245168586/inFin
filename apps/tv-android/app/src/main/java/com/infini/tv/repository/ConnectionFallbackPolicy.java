package com.infini.tv.repository;

import java.util.ArrayList;
import java.util.List;

final class ConnectionFallbackPolicy {
  private ConnectionFallbackPolicy() {}

  static boolean shouldUseBackup(int secureFailureCount, int threshold) {
    return secureFailureCount >= Math.max(threshold, 0);
  }

  static List<String> baseUrlCandidates(String primaryBaseUrl, String backupBaseUrl, boolean includeBackup) {
    List<String> candidates = new ArrayList<>();
    addIfPresent(candidates, primaryBaseUrl);
    if (includeBackup) {
      addIfPresent(candidates, backupBaseUrl);
    }
    return candidates;
  }

  static List<String> resolveMediaUrlCandidates(
      String url,
      String primaryBaseUrl,
      String primaryApiBaseUrl,
      String backupBaseUrl,
      String backupApiBaseUrl,
      boolean includeBackup) {
    List<String> candidates = new ArrayList<>();
    if (url == null) {
      return candidates;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      addIfPresent(candidates, url);
      if (includeBackup && startsWithPath(url, primaryBaseUrl)) {
        addIfPresent(candidates, backupBaseUrl + url.substring(primaryBaseUrl.length()));
      } else if (includeBackup && startsWithPath(url, primaryApiBaseUrl)) {
        addIfPresent(candidates, backupApiBaseUrl + url.substring(primaryApiBaseUrl.length()));
      }
      return candidates;
    }

    if (url.startsWith("/")) {
      for (String baseUrl : baseUrlCandidates(primaryBaseUrl, backupBaseUrl, includeBackup)) {
        addIfPresent(candidates, baseUrl + url);
      }
      return candidates;
    }

    for (String apiBaseUrl : baseUrlCandidates(primaryApiBaseUrl, backupApiBaseUrl, includeBackup)) {
      addIfPresent(candidates, apiBaseUrl + "/" + url);
    }
    return candidates;
  }

  static String[] brokerUris(String primaryBrokerUri, String backupBrokerUri, boolean includeBackup) {
    List<String> uris = new ArrayList<>();
    addIfPresent(uris, primaryBrokerUri);
    if (includeBackup) {
      addIfPresent(uris, backupBrokerUri);
    }
    return uris.toArray(new String[0]);
  }

  private static boolean startsWithPath(String value, String prefix) {
    return prefix != null && !prefix.isEmpty() && value.startsWith(prefix + "/");
  }

  private static void addIfPresent(List<String> values, String value) {
    if (value == null || value.isEmpty() || values.contains(value)) {
      return;
    }
    values.add(value);
  }
}
