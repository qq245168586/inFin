package com.infini.tv.diagnostics;

import android.media.MediaPlayer;
import java.io.File;
import java.util.HashMap;
import java.util.Map;

/** Central player adapter; existing UI recovery stays with the owning renderer. */
public final class PlayerDiagnostics {
  private PlayerDiagnostics() { }

  /** Preserves the previous error-consumed contract while recording Android decoder codes. */
  public static MediaPlayer.OnErrorListener errorListener(String component, String path,
      String cardId, String station, Runnable recovery) {
    return (player, what, extra) -> {
      Map<String, Object> context = details(component, path);
      context.put("what", what); context.put("extra", extra);
      context.put("cardId", cardId); context.put("station", station);
      TvDiagnostics.report(DiagnosticEvent.Type.PLAYBACK_ERROR, "MEDIA_" + what + "_" + extra,
          "Local video playback failed", null, context);
      recovery.run();
      return true;
    };
  }

  /** Blank slots are normal; only expected media that cannot be played locally is an error. */
  public static void missingLocalMedia(String component, String mediaUrl) {
    if (mediaUrl == null || mediaUrl.trim().isEmpty()) return;
    TvDiagnostics.report(DiagnosticEvent.Type.PLAYBACK_ERROR, "CACHE_MISSING",
        "Expected local video is unavailable", null, details(component, mediaUrl));
  }

  /** Records recoverable player exceptions without changing lifecycle or retry behavior. */
  public static void exception(String operation, Throwable error) {
    TvDiagnostics.report(DiagnosticEvent.Type.PLAYBACK_ERROR, "PLAYER_EXCEPTION",
        operation, error, details("player", ""));
  }

  private static Map<String, Object> details(String component, String path) {
    Map<String, Object> context = new HashMap<>();
    context.put("component", component);
    context.put("mediaFile", new File(DiagnosticEvent.redact(path == null ? "" : path, 1024)).getName());
    return context;
  }
}
