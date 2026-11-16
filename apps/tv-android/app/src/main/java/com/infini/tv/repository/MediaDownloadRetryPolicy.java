package com.infini.tv.repository;

/** Defines bounded retry behavior for recoverable media-cache download failures. */
final class MediaDownloadRetryPolicy {
  static final int MAX_ATTEMPTS_PER_URL = 3;
  private static final long MAX_DELAY_MS = 30_000L;

  private MediaDownloadRetryPolicy() {}

  static boolean isRetryableStatus(int statusCode) {
    return statusCode == 408
        || statusCode == 425
        || statusCode == 429
        || statusCode == 500
        || statusCode == 502
        || statusCode == 503
        || statusCode == 504;
  }

  static long delayMs(int failedAttempt, String retryAfterHeader) {
    long retryAfterMs = parseRetryAfterSeconds(retryAfterHeader);
    if (retryAfterMs > 0L) {
      return Math.min(retryAfterMs, MAX_DELAY_MS);
    }
    int exponent = Math.max(0, Math.min(failedAttempt - 1, 4));
    return Math.min(1_000L << exponent, MAX_DELAY_MS);
  }

  private static long parseRetryAfterSeconds(String value) {
    if (value == null || value.trim().isEmpty()) {
      return 0L;
    }
    try {
      return Math.max(Long.parseLong(value.trim()), 0L) * 1_000L;
    } catch (NumberFormatException ignored) {
      return 0L;
    }
  }
}
