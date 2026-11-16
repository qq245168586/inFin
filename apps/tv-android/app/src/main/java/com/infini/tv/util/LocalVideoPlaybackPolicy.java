package com.infini.tv.util;

import java.io.File;
import java.net.URI;

/** Prevents VideoView from opening remote media and validates local cached files. */
public final class LocalVideoPlaybackPolicy {
  private LocalVideoPlaybackPolicy() {}

  public static String resolvePlayablePath(String mediaPath) {
    if (mediaPath == null || mediaPath.trim().isEmpty()) {
      return "";
    }

    String normalized = mediaPath.trim();
    String lower = normalized.toLowerCase(java.util.Locale.US);
    if (lower.startsWith("http://") || lower.startsWith("https://")) {
      return "";
    }

    File mediaFile;
    try {
      mediaFile = lower.startsWith("file://") ? new File(URI.create(normalized)) : new File(normalized);
    } catch (IllegalArgumentException error) {
      return "";
    }

    if (!mediaFile.isFile() || !mediaFile.canRead() || mediaFile.length() <= 0L) {
      return "";
    }
    return mediaFile.getAbsolutePath();
  }
}
