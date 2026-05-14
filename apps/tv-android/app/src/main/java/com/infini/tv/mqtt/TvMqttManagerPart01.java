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

abstract class TvMqttManagerPart01 extends TvMqttManagerBase {
  protected TvMqttManagerPart01(
      String clientId,
      String username,
      String password,
      String accountNamespace,
      boolean accountBound,
      Listener listener) {
    super(clientId, username, password, accountNamespace, accountBound, listener);
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

  public void updateCredentials(String username, String password) {
    String nextUsername = sanitizeCredential(username);
    String nextPassword = sanitizeCredential(password);
    boolean changed;
    synchronized (this) {
      changed = !nextUsername.equals(this.username) || !nextPassword.equals(this.password);
      if (!changed) {
        return;
      }
      this.username = nextUsername;
      this.password = nextPassword;
    }

    new Thread(
            () -> {
              MqttClient targetClient;
              synchronized (this) {
                targetClient = client;
              }
              if (targetClient == null || !targetClient.isConnected()) {
                connect();
                return;
              }
              disconnect();
              connect();
            })
        .start();
  }

  public void connect() {
    new Thread(
            () -> {
              MqttClient targetClient;
              try {
                synchronized (this) {
                  if (connectInFlight) {
                    Log.d(TAG, "MQTT connect skipped because connect is already in flight for " + clientId);
                    return;
                  }
                  if (client != null && client.isConnected()) {
                    return;
                  }

                  connectInFlight = true;
                  disconnectRequested = false;
                  targetClient = client;
                }

                if (targetClient == null) {
                  String brokerUrl =
                      "tcp://" + ServerConfig.MQTT_HOST + ":" + ServerConfig.MQTT_PORT;
                  targetClient =
                      new MqttClient(
                          brokerUrl, clientId, new MemoryPersistence());
                  targetClient.setCallback(
                      new MqttCallbackExtended() {
                        @Override
                        public void connectComplete(boolean reconnect, String serverURI) {
                          synchronized (TvMqttManagerPart01.this) {
                            if (disconnectRequested) {
                              return;
                            }
                          }
                          Log.d(
                              TAG,
                              "MQTT connected"
                                  + (reconnect ? " (reconnect)" : "")
                                  + " clientId="
                                  + clientId
                                  + " username="
                                  + username
                                  + " to "
                                  + serverURI);
                          subscribeToControlTopics();
                          if (listener != null) {
                            listener.onMqttConnected();
                          }
                        }

                        @Override
                        public void connectionLost(Throwable cause) {
                          Log.w(TAG, "MQTT connection lost clientId=" + clientId, cause);
                        }

                        @Override
                        public void messageArrived(String topic, MqttMessage message) {
                          Log.d(TAG, "MQTT message received on topic " + topic + " clientId=" + clientId);
                          handleMessage(topic, new String(message.getPayload(), StandardCharsets.UTF_8));
                        }

                        @Override
                        public void deliveryComplete(IMqttDeliveryToken token) {}
                      });
                  synchronized (this) {
                    if (client == null) {
                      client = targetClient;
                    } else {
                      targetClient = client;
                    }
                  }
                }

                String connectUsername;
                String connectPassword;
                synchronized (this) {
                  connectUsername = username;
                  connectPassword = password;
                }

                MqttConnectOptions options = new MqttConnectOptions();
                options.setAutomaticReconnect(true);
                options.setCleanSession(true);
                options.setConnectionTimeout(8);
                options.setKeepAliveInterval(60);
                if (connectUsername != null && !connectUsername.trim().isEmpty()) {
                  options.setUserName(connectUsername.trim());
                }
                if (connectPassword != null && !connectPassword.trim().isEmpty()) {
                  options.setPassword(connectPassword.toCharArray());
                }
                targetClient.connect(options);
                subscribeToControlTopics();
              } catch (Exception ignored) {
                Log.w(TAG, "MQTT connect failed", ignored);
              } finally {
                synchronized (this) {
                  connectInFlight = false;
                }
              }
            })
        .start();
  }

  public void disconnect() {
    new Thread(
            () -> {
              MqttClient targetClient;
              synchronized (this) {
                disconnectRequested = true;
                connectInFlight = false;
                targetClient = client;
                client = null;
                subscribedTopics.clear();
              }
              if (targetClient == null) {
                return;
              }
              try {
                if (targetClient.isConnected()) {
                for (String currentTopic : getSubscribedTopics()) {
                    if (!currentTopic.trim().isEmpty()) {
                      targetClient.unsubscribe(currentTopic);
                    }
                  }
                  targetClient.disconnect();
                }
                targetClient.close();
              } catch (MqttException ignored) {
                // Ignore disconnect cleanup errors.
              }
            })
        .start();
  }
}
