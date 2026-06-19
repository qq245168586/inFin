package com.infini.tv.repository;

import com.infini.tv.BuildConfig;

public final class ServerConfig {
  public static final String ENV = BuildConfig.INFINI_ENV;
  public static final String BASE_URL = BuildConfig.INFINI_BASE_URL;
  public static final String API_BASE_URL = BASE_URL + "/api";
  public static final String BACKUP_BASE_URL = BuildConfig.INFINI_BACKUP_BASE_URL;
  public static final String BACKUP_API_BASE_URL = BACKUP_BASE_URL + "/api";
  public static final String LEGACY_BASE_URL = BACKUP_BASE_URL;
  public static final String LEGACY_API_BASE_URL = LEGACY_BASE_URL + "/api";
  public static final String COURSE_TIME_ZONE = "Asia/Shanghai";
  public static final String MQTT_WSS_URL = BuildConfig.INFINI_MQTT_PRIMARY_URL;
  public static final String MQTT_TCP_BACKUP_URL = BuildConfig.INFINI_MQTT_BACKUP_URL;
  public static final int SECURE_FALLBACK_FAILURE_THRESHOLD = 2;
  public static final String MQTT_USERNAME = "";
  public static final String MQTT_PASSWORD = "REDACTED_CONFIGURE_LOCALLY";
  public static final String MQTT_TOPIC_CONTROL = "infini/tv/control";
  public static final String MQTT_TOPIC_SESSION = "infini/tv/session";

  private ServerConfig() {}

  public static String[] mqttBrokerUris(boolean includeBackup) {
    return ConnectionFallbackPolicy.brokerUris(MQTT_WSS_URL, MQTT_TCP_BACKUP_URL, includeBackup);
  }

  public static String primaryMqttBrokerUri() {
    return MQTT_WSS_URL;
  }

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
