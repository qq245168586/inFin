package com.infini.tv.mqtt;

import android.util.Log;
import com.infini.tv.repository.ServerConfig;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

public class TvMqttManager extends TvMqttMessageManager {
  private static TvMqttManager sharedInstance;

  public static synchronized TvMqttManager getInstance(
      String deviceId, String accountNamespace, boolean accountBound, Listener listener) {
    if (sharedInstance == null) {
      sharedInstance =
          new TvMqttManager(
              createProcessUniqueClientId(deviceId),
              createConfiguredUsername(deviceId),
              createConfiguredCredential(ServerConfig.MQTT_PASSWORD, deviceId),
              accountNamespace,
              accountBound,
              listener);
    } else {
      sharedInstance.updateListener(listener);
      sharedInstance.updateCredentials(
          createConfiguredUsername(deviceId),
          createConfiguredCredential(ServerConfig.MQTT_PASSWORD, deviceId));
      sharedInstance.updateControlRouting(accountNamespace, accountBound);
    }
    return sharedInstance;
  }

  private static String createConfiguredUsername(String deviceId) {
    String configuredUsername = createConfiguredCredential(ServerConfig.MQTT_USERNAME, deviceId);
    if (!configuredUsername.isEmpty()) {
      return configuredUsername;
    }
    String normalized = deviceId == null ? "" : deviceId.trim().toUpperCase(Locale.US);
    return normalized.isEmpty() ? "TV-UNKNOWN" : normalized;
  }

  private static String createConfiguredCredential(String template, String deviceId) {
    String value = template == null ? "" : template.trim();
    if (value.isEmpty()) {
      return "";
    }
    String normalizedDeviceId = deviceId == null ? "" : deviceId.trim().toUpperCase(Locale.US);
    return value.replace("{deviceId}", normalizedDeviceId).replace("{DEVICE_ID}", normalizedDeviceId);
  }

  private static String createProcessUniqueClientId(String deviceId) {
    String compact =
        (deviceId == null ? "" : deviceId).replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.US);
    if (compact.isEmpty()) {
      compact = "unknown";
    }
    if (compact.length() > 10) {
      compact = compact.substring(compact.length() - 10);
    }
    String nonce = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    return "tv-" + compact + "-" + nonce;
  }

  private TvMqttManager(
      String clientId,
      String username,
      String password,
      String accountNamespace,
      boolean accountBound,
      Listener listener) {
    super(clientId, username, password, accountNamespace, accountBound, listener);
  }
}
