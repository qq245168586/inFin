package com.infini.tv.diagnostics;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Small, portable error records; never includes HTTP headers or request/response bodies. */
public final class DiagnosticEvent {
  public enum Type { PLAYBACK_ERROR, NETWORK_ERROR, API_ERROR, DOWNLOAD_ERROR, CRASH, MQTT_ERROR }
  private static final Pattern URL = Pattern.compile("\\b(?:https?|wss?|tcp)://[^\\s\"'<>]+", Pattern.CASE_INSENSITIVE);
  private static final Pattern AUTH = Pattern.compile("\\b(?:Bearer|Basic)\\s+[A-Za-z0-9+/_=.:-]+", Pattern.CASE_INSENSITIVE);
  private static final Pattern SECRET = Pattern.compile(
      "([\"']?(?:authorization|cookie|password|pairToken|accessToken|refreshToken|token|secret|signature|accessKeyId|accessKeySecret)[\"']?\\s*[:=]\\s*)(?:\"[^\"\\r\\n]*\"|'[^'\\r\\n]*'|[^\\s,;}]+)", Pattern.CASE_INSENSITIVE);

  private DiagnosticEvent() {}

  /** Strips signed URL queries and credentials before truncating any persisted text. */
  public static String redact(String text, int limit) {
    String value = text == null ? "" : text;
    Matcher matcher = URL.matcher(value);
    StringBuffer clean = new StringBuffer();
    while (matcher.find()) {
      String replacement = "[redacted-url]";
      try {
        URI uri = URI.create(matcher.group());
        replacement = uri.getScheme() + "://" + uri.getHost()
            + (uri.getPort() < 0 ? "" : ":" + uri.getPort()) + (uri.getRawPath() == null ? "" : uri.getRawPath());
      } catch (IllegalArgumentException ignored) { }
      matcher.appendReplacement(clean, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(clean);
    value = AUTH.matcher(clean.toString()).replaceAll("[redacted-auth]");
    value = SECRET.matcher(value).replaceAll("$1[redacted]");
    value = value.replaceAll("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]", "");
    return value.substring(0, Math.min(value.length(), limit));
  }

  /** Builds a bounded JSONL record; the uploader supplies credentials separately. */
  public static JSONObject create(Type type, String code, String message, Throwable error,
      Map<String, Object> context, Map<String, Object> identity, long now) throws Exception {
    JSONObject details = new JSONObject();
    if (context != null) for (Map.Entry<String, Object> entry : context.entrySet()) {
      Object value = entry.getValue();
      details.put(entry.getKey(), value instanceof String ? redact((String) value, 512) : value);
    }
    String stack = "";
    if (error != null) {
      // Limit traversal and frames even for corrupt/cyclic or exceptionally deep exceptions.
      StringWriter writer = new StringWriter();
      PrintWriter printer = new PrintWriter(writer);
      Throwable current = error;
      for (int cause = 0; current != null && cause < 4; cause++, current = current.getCause()) {
        printer.println(current.getClass().getName() + ": " + redact(current.getMessage(), 1024));
        StackTraceElement[] frames = current.getStackTrace();
        for (int i = 0; i < Math.min(frames.length, 40); i++) printer.println("  at " + frames[i]);
      }
      stack = redact(writer.toString(), 8192);
      details.put("exceptionClass", error.getClass().getName());
    }
    JSONObject event = new JSONObject(identity);
    event.put("id", UUID.randomUUID().toString());
    event.put("occurredAt", Instant.ofEpochMilli(now).toString());
    event.put("type", type.name());
    event.put("code", code);
    event.put("message", redact(message, 2048));
    event.put("stackTrace", stack);
    event.put("context", details);
    return event;
  }
}
