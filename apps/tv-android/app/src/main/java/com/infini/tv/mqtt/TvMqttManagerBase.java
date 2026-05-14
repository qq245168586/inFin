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

abstract class TvMqttManagerBase extends TvMqttManagerContracts {
  protected volatile Listener listener;

  protected final String clientId;

  protected String username;

  protected String password;

  protected String accountNamespace;

  protected boolean accountBound;

  protected final Set<String> subscribedTopics = new LinkedHashSet<>();

  protected MqttClient client;

  protected boolean connectInFlight;

  protected boolean disconnectRequested;

  protected TvMqttManagerBase(
      String clientId,
      String username,
      String password,
      String accountNamespace,
      boolean accountBound,
      Listener listener) {
    this.clientId = clientId;
    this.username = sanitizeCredential(username);
    this.password = sanitizeCredential(password);
    this.accountNamespace = ServerConfig.normalizeAccountNamespace(accountNamespace);
    this.accountBound = accountBound;
    this.listener = listener;
  }

  protected synchronized void updateListener(Listener listener) {
    this.listener = listener;
  }

  protected static String sanitizeCredential(String value) {
    return value == null ? "" : value.trim();
  }
}
