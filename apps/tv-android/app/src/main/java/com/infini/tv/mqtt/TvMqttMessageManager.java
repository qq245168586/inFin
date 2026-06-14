package com.infini.tv.mqtt;

import android.util.Log;
import com.infini.tv.repository.ServerConfig;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

abstract class TvMqttMessageManager extends TvMqttClient {
  protected TvMqttMessageManager(
      String clientId,
      String username,
      String password,
      String accountNamespace,
      boolean accountBound,
      Listener listener) {
    super(clientId, username, password, accountNamespace, accountBound, listener);
  }

  protected void handleMessage(String topic, String payload) {
    try {
      JSONObject json = new JSONObject(payload);
      String type = json.optString("type");
      Log.d(TAG, "MQTT payload type = " + type);
      if ("refresh_checksum".equals(type)) {
        if (!shouldHandleAccountScopedMessage(topic, json)) {
          return;
        }
        if (listener != null) {
          listener.onRefreshRequested();
        }
        return;
      }

      if ("assign_screen".equals(type) && listener != null) {
        listener.onAssignScreenRequested(
            json.optString("deviceId", ""),
            json.optInt("screenNumber", 0),
            json.optString("venueId", json.optString("accountNamespace", "")));
        return;
      }

      if ("unbind_screen".equals(type) && listener != null) {
        listener.onUnbindScreenRequested(json.optString("deviceId", ""));
        return;
      }

      // When a venue is deleted (or devices are forcibly removed), TV should immediately fall back
      // to pairing (QR) screen.
      if ("venue_deleted".equals(type) && listener != null) {
        if (!shouldHandleAccountScopedMessage(topic, json)) {
          return;
        }
        listener.onUnbindScreenRequested(json.optString("deviceId", ""));
        return;
      }

      if ("clear_cache".equals(type) && listener != null) {
        listener.onClearCacheRequested(json.optString("deviceId", ""));
        return;
      }

      if ("install_app_update".equals(type) && listener != null) {
        listener.onInstallAppUpdateRequested(
            json.optString("deviceId", ""),
            json.optInt("screenNumber", 0),
            json.optString("packageId", ""),
            json.optString("version", ""),
            json.optString("downloadUrl", ""),
            json.optString("checksum", ""));
        return;
      }

      if (!shouldHandleAccountScopedMessage(topic, json)) {
        return;
      }

      if ("session_updated".equals(type) && listener != null) {
        listener.onPlaybackSessionUpdated(
            json.optString("sessionId", ""),
            json.optInt("version", 0),
            json.optString("state", ""),
            json.optLong("serverNowMs", 0L));
        return;
      }

      String scheduleId = json.optString("scheduleId", "");
      int courseId = json.optInt("courseId", 0);
      long scheduledStartAtMs = json.optLong("scheduledStartAtMs", 0L);
      String playbackSessionId = json.optString("playbackSessionId", "");
      String bundleChecksum = json.optString("bundleChecksum", "");
      if ("show_course_plan".equals(type) && listener != null) {
        listener.onShowCoursePlanRequested(
            scheduleId,
            courseId,
            json.optString("courseName", ""),
            playbackSessionId,
            json.optJSONObject("coursePlan"));
        return;
      }

      if ("preview_course".equals(type) && listener != null) {
        listener.onPreviewCourseRequested(
            scheduleId, courseId, scheduledStartAtMs, playbackSessionId, bundleChecksum);
        return;
      }

      if ("start_course".equals(type) && listener != null) {
        listener.onStartCourseRequested(
            scheduleId,
            courseId,
            scheduledStartAtMs,
            json.optLong("playbackStartAtMs", 0L),
            json.optLong("serverNowMs", 0L),
            playbackSessionId,
            bundleChecksum);
        return;
      }

      if ("pause_course".equals(type) && listener != null) {
        listener.onPauseCourseRequested(
            scheduleId, courseId, json.optLong("pausedAtMs", 0L), playbackSessionId);
        return;
      }

      if ("resume_course".equals(type) && listener != null) {
        listener.onResumeCourseRequested(
            scheduleId, courseId, json.optLong("resumedAtMs", 0L), playbackSessionId);
        return;
      }

      if ("terminate_course".equals(type) && listener != null) {
        listener.onTerminateCourseRequested(scheduleId, courseId, playbackSessionId);
      }
    } catch (Exception ignored) {
      Log.w(TAG, "MQTT payload parse failed", ignored);
    }
  }

  protected void subscribeToControlTopics() {
    if (client == null) {
      return;
    }

    try {
      if (!client.isConnected()) {
        return;
      }
      List<String> topics = getSubscribedTopics();
      synchronized (this) {
        subscribedTopics.clear();
      }
      for (String topic : topics) {
        client.subscribe(topic, 1);
        synchronized (this) {
          subscribedTopics.add(topic);
        }
        Log.d(TAG, "MQTT subscribed to " + topic);
      }
    } catch (MqttException error) {
      Log.w(TAG, "MQTT subscribe failed", error);
    }
  }

  protected boolean shouldHandleAccountScopedMessage(String topic, JSONObject json) {
    // Newer payloads may use "venueId"; keep backward compatibility with "accountNamespace".
    String targetNamespace =
        ServerConfig.normalizeAccountNamespace(
            json.optString("venueId", json.optString("accountNamespace", "")));
    if (targetNamespace.isEmpty()) {
      targetNamespace = extractAccountNamespaceFromTopic(topic);
    }
    synchronized (this) {
      if (!accountBound) {
        return false;
      }
      if (targetNamespace.isEmpty()) {
        return false;
      }
      return targetNamespace.equals(accountNamespace);
    }
  }

  protected String extractAccountNamespaceFromTopic(String topic) {
    if (topic == null) {
      return "";
    }
    String normalizedTopic = topic.trim();
    String controlPrefix = ServerConfig.MQTT_TOPIC_CONTROL + "/";
    String sessionPrefix = ServerConfig.MQTT_TOPIC_SESSION + "/";
    String namespace = "";
    if (normalizedTopic.startsWith(controlPrefix)) {
      namespace = normalizedTopic.substring(controlPrefix.length());
    } else if (normalizedTopic.startsWith(sessionPrefix)) {
      namespace = normalizedTopic.substring(sessionPrefix.length());
    }
    namespace = ServerConfig.normalizeAccountNamespace(namespace);
    return "__unbound__".equals(namespace) ? "" : namespace;
  }

  public void publishPairingPresence(String deviceId, String pairToken) {
    if (deviceId == null || deviceId.trim().isEmpty()) {
      return;
    }
    JSONObject json = new JSONObject();
    try {
      json.put("type", "tv_pairing_presence");
      json.put("deviceId", deviceId.trim().toUpperCase());
      json.put("pairToken", pairToken == null ? "" : pairToken.trim().toUpperCase());
    } catch (Exception ignored) {
      return;
    }
    publish(TOPIC_PAIRING_PRESENCE, json.toString());
  }

  public void publishUnboundEvent(String deviceId, String venueId, int screenNumber, String pairToken) {
    if (deviceId == null || deviceId.trim().isEmpty()) {
      return;
    }
    JSONObject json = new JSONObject();
    try {
      json.put("type", "tv_unbound");
      json.put("deviceId", deviceId.trim().toUpperCase());
      json.put("venueId", venueId == null ? "" : venueId.trim().toLowerCase());
      json.put("screenNumber", Math.max(screenNumber, 0));
      json.put("pairToken", pairToken == null ? "" : pairToken.trim().toUpperCase());
    } catch (Exception ignored) {
      return;
    }
    publish(TOPIC_PAIRING_PRESENCE, json.toString());
  }

  protected void publish(String topic, String payload) {
    if (topic == null || topic.trim().isEmpty()) {
      return;
    }
    if (payload == null) {
      return;
    }
    new Thread(
            () -> {
              if (client == null) {
                return;
              }
              try {
                if (!client.isConnected()) {
                  return;
                }
                MqttMessage message = new MqttMessage(payload.getBytes(StandardCharsets.UTF_8));
                message.setQos(0);
                client.publish(topic, message);
                Log.d(TAG, "MQTT published " + topic);
              } catch (Exception error) {
                Log.w(TAG, "MQTT publish failed " + topic, error);
              }
            })
        .start();
  }

  protected synchronized List<String> getSubscribedTopics() {
    LinkedHashSet<String> topics = new LinkedHashSet<>();
    if (accountBound && accountNamespace != null && !accountNamespace.trim().isEmpty()) {
      topics.add(ServerConfig.buildControlTopic(accountNamespace));
      topics.add(ServerConfig.buildSessionTopic(accountNamespace));
    } else {
      topics.add(ServerConfig.buildControlTopic(""));
      topics.add(ServerConfig.buildSessionTopic(""));
    }
    return new ArrayList<>(topics);
  }
}
