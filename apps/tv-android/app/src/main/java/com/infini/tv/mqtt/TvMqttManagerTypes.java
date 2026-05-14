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

abstract class TvMqttManagerTypes {
  protected static final String TAG = "TvMqttManager";

  protected static final String TOPIC_PAIRING_PRESENCE = "infini/tv/pairing";

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

    void onPlaybackSessionUpdated(String sessionId, int version, String state, long serverNowMs);
  }

}
