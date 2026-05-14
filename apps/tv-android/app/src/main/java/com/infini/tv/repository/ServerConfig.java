package com.infini.tv.repository;

public final class ServerConfig {
  public static final String BASE_URL = "http://8.130.65.113";
  public static final String API_BASE_URL = BASE_URL + "/api";
  public static final String LEGACY_BASE_URL = BASE_URL;
  public static final String LEGACY_API_BASE_URL = LEGACY_BASE_URL + "/api";
  public static final String COURSE_TIME_ZONE = "Asia/Shanghai";
  public static final String MQTT_HOST = "8.130.65.113";
  public static final int MQTT_PORT = 1883;
  public static final String MQTT_USERNAME = "";
  public static final String MQTT_PASSWORD = "REDACTED_CONFIGURE_LOCALLY";
  public static final String MQTT_TOPIC_CONTROL = "infini/tv/control";
  public static final String MQTT_TOPIC_SESSION = "infini/tv/session";

  private ServerConfig() {}

  public static String normalizeAccountNamespace(String namespace) {
    return namespace == null ? "" : namespace.trim().toLowerCase();
  }

  public static String buildControlTopic(String namespace) {
    String normalized = normalizeAccountNamespace(namespace);
    if (normalized.isEmpty()) {
      return MQTT_TOPIC_CONTROL + "/__unbound__";
    }
    return MQTT_TOPIC_CONTROL + "/" + normalized;
  }

  public static String buildSessionTopic(String namespace) {
    String normalized = normalizeAccountNamespace(namespace);
    if (normalized.isEmpty()) {
      return MQTT_TOPIC_SESSION + "/__unbound__";
    }
    return MQTT_TOPIC_SESSION + "/" + normalized;
  }
}
