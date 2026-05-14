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

abstract class TvMqttManagerContract01 extends TvMqttManagerTypes {
  public abstract String getClientId();

  public abstract String getAccountNamespace();

  public abstract void updateControlRouting(String accountNamespace, boolean accountBound);

  public abstract void connect();

  public abstract void disconnect();

  protected abstract void handleMessage(String topic, String payload);

  protected abstract void subscribeToControlTopics();

  protected abstract boolean shouldHandleAccountScopedMessage(String topic, JSONObject json);

  protected abstract String extractAccountNamespaceFromTopic(String topic);

  protected abstract void publish(String topic, String payload);

  protected abstract List<String> getSubscribedTopics();
}
