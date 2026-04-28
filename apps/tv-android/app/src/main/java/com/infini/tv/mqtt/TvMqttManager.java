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

public class TvMqttManager {
  private static final String TAG = "TvMqttManager";

  public interface Listener {
    void onMqttConnected();

    void onRefreshRequested();

    void onAssignScreenRequested(String deviceId, int screenNumber, String accountNamespace);

    void onUnbindScreenRequested(String deviceId);

    void onClearCacheRequested(String deviceId);

    void onInstallAppUpdateRequested(
        String deviceId,
        int screenNumber,
        String packageId,
        String version,
        String downloadUrl,
        String checksum);

    void onPreviewCourseRequested(
        String scheduleId, int courseId, long scheduledStartAtMs, String playbackSessionId, String bundleChecksum);

    void onStartCourseRequested(
        String scheduleId,
        int courseId,
        long scheduledStartAtMs,
        long playbackStartAtMs,
        String playbackSessionId,
        String bundleChecksum);

    void onPauseCourseRequested(String scheduleId, int courseId, long pausedAtMs, String playbackSessionId);

    void onResumeCourseRequested(String scheduleId, int courseId, long resumedAtMs, String playbackSessionId);

    void onTerminateCourseRequested(String scheduleId, int courseId, String playbackSessionId);
  }

  private final Listener listener;
  private final String clientId;
  private String accountNamespace;
  private boolean accountBound;
  private final Set<String> subscribedTopics = new LinkedHashSet<>();
  private MqttClient client;

  public TvMqttManager(String clientId, String accountNamespace, boolean accountBound, Listener listener) {
    this.clientId = clientId;
    this.accountNamespace = ServerConfig.normalizeAccountNamespace(accountNamespace);
    this.accountBound = accountBound;
    this.listener = listener;
  }

  public String getClientId() {
    return clientId;
  }

  public synchronized String getAccountNamespace() {
    return accountNamespace;
  }

  public void updateControlRouting(String accountNamespace, boolean accountBound) {
    String normalized = ServerConfig.normalizeAccountNamespace(accountNamespace);
    List<String> previousTopics;
    boolean changed;
    synchronized (this) {
      changed = !normalized.equals(this.accountNamespace) || this.accountBound != accountBound;
      if (!changed) {
        return;
      }
      this.accountNamespace = normalized;
      this.accountBound = accountBound;
      previousTopics = new ArrayList<>(subscribedTopics);
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
                for (String previousTopic : previousTopics) {
                  if (previousTopic == null || previousTopic.trim().isEmpty()) {
                    continue;
                  }
                  client.unsubscribe(previousTopic);
                  Log.d(TAG, "MQTT unsubscribed from " + previousTopic);
                }
              } catch (MqttException error) {
                Log.w(TAG, "MQTT unsubscribe failed while switching account namespace", error);
              }
              subscribeToControlTopics();
            })
        .start();
  }

  public void connect() {
    new Thread(
            () -> {
              try {
                if (client != null && client.isConnected()) {
                  return;
                }

                String brokerUrl =
                    "tcp://" + ServerConfig.MQTT_HOST + ":" + ServerConfig.MQTT_PORT;
                client =
                    new MqttClient(
                        brokerUrl, clientId, new MemoryPersistence());
                client.setCallback(
                    new MqttCallbackExtended() {
                      @Override
                      public void connectComplete(boolean reconnect, String serverURI) {
                        Log.d(
                            TAG,
                            "MQTT connected"
                                + (reconnect ? " (reconnect)" : "")
                                + " to "
                                + serverURI);
                        subscribeToControlTopics();
                        if (listener != null) {
                          listener.onMqttConnected();
                        }
                      }

                      @Override
                      public void connectionLost(Throwable cause) {
                        Log.w(TAG, "MQTT connection lost", cause);
                      }

                      @Override
                      public void messageArrived(String topic, MqttMessage message) {
                        Log.d(TAG, "MQTT message received on topic " + topic);
                        handleMessage(new String(message.getPayload(), StandardCharsets.UTF_8));
                      }

                      @Override
                      public void deliveryComplete(IMqttDeliveryToken token) {}
                    });

                MqttConnectOptions options = new MqttConnectOptions();
                options.setAutomaticReconnect(true);
                options.setCleanSession(true);
                options.setConnectionTimeout(8);
                options.setKeepAliveInterval(60);
                options.setUserName(ServerConfig.MQTT_USERNAME);
                options.setPassword(ServerConfig.MQTT_PASSWORD.toCharArray());
                client.connect(options);
                subscribeToControlTopics();
              } catch (Exception ignored) {
                Log.w(TAG, "MQTT connect failed", ignored);
              }
            })
        .start();
  }

  public void disconnect() {
    new Thread(
            () -> {
              if (client == null) {
                return;
              }
              try {
                if (client.isConnected()) {
                  for (String currentTopic : getControlTopics()) {
                    if (!currentTopic.trim().isEmpty()) {
                      client.unsubscribe(currentTopic);
                    }
                  }
                  client.disconnect();
                }
                client.close();
              } catch (MqttException ignored) {
                // Ignore disconnect cleanup errors.
              }
            })
        .start();
  }

  private void handleMessage(String payload) {
    try {
      JSONObject json = new JSONObject(payload);
      String type = json.optString("type");
      Log.d(TAG, "MQTT payload type = " + type);
      if ("refresh_checksum".equals(type)) {
        if (!shouldHandleAccountScopedMessage(json)) {
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
            json.optString("accountNamespace", ""));
        return;
      }

      if ("unbind_screen".equals(type) && listener != null) {
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

      if (!shouldHandleAccountScopedMessage(json)) {
        return;
      }

      String scheduleId = json.optString("scheduleId", "");
      int courseId = json.optInt("courseId", 0);
      long scheduledStartAtMs = json.optLong("scheduledStartAtMs", 0L);
      String playbackSessionId = json.optString("playbackSessionId", "");
      String bundleChecksum = json.optString("bundleChecksum", "");
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

  private void subscribeToControlTopics() {
    if (client == null) {
      return;
    }

    try {
      if (!client.isConnected()) {
        return;
      }
      List<String> topics = getControlTopics();
      synchronized (this) {
        subscribedTopics.clear();
      }
      for (String topic : topics) {
        client.subscribe(topic, 0);
        synchronized (this) {
          subscribedTopics.add(topic);
        }
        Log.d(TAG, "MQTT subscribed to " + topic);
      }
    } catch (MqttException error) {
      Log.w(TAG, "MQTT subscribe failed", error);
    }
  }

  private boolean shouldHandleAccountScopedMessage(JSONObject json) {
    String targetNamespace = ServerConfig.normalizeAccountNamespace(json.optString("accountNamespace", ""));
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

  private synchronized List<String> getControlTopics() {
    LinkedHashSet<String> topics = new LinkedHashSet<>();
    if (accountBound && accountNamespace != null && !accountNamespace.trim().isEmpty()) {
      topics.add(ServerConfig.buildControlTopic(accountNamespace));
    } else {
      topics.add(ServerConfig.buildControlTopic(""));
    }
    return new ArrayList<>(topics);
  }
}
