package com.infini.tv.repository;

import android.content.Context;
import android.os.Environment;
import android.util.Log;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import java.io.BufferedOutputStream;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import okhttp3.ConnectionSpec;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

abstract class TvScriptRepositoryPart06 extends TvScriptRepositoryPart05 {
  protected TvScriptRepositoryPart06(Context context) {
    super(context);
  }

  protected List<CourseScript.VideoCard> parseVideoCards(JSONArray cardsArray) {
    List<CourseScript.VideoCard> cards = new ArrayList<>();
    if (cardsArray == null) {
      return cards;
    }

    for (int index = 0; index < cardsArray.length(); index += 1) {
      JSONObject cardObject = cardsArray.optJSONObject(index);
      if (cardObject == null) {
        continue;
      }

      cards.add(
          new CourseScript.VideoCard(
              cardObject.optString("actionId"),
              cardObject.optString("actionName"),
              cardObject.optString("mediaUrl"),
              cardObject.optString("stationNumber")));
    }

    return cards;
  }

  protected List<CourseScript.Pod> parsePods(JSONArray podsArray) {
    List<CourseScript.Pod> pods = new ArrayList<>();
    if (podsArray == null) {
      return pods;
    }

    for (int index = 0; index < podsArray.length(); index += 1) {
      JSONObject podObject = podsArray.optJSONObject(index);
      if (podObject == null) {
        continue;
      }

      pods.add(
          new CourseScript.Pod(
              podObject.optString("name"),
              podObject.optString("videoGroupId"),
              podObject.optString("ending"),
              podObject.optString("stationFlow", "NORMAL"),
              parsePodScreens(podObject.optJSONArray("screens"))));
    }

    return pods;
  }

  protected List<CourseScript.PodScreen> parsePodScreens(JSONArray screensArray) {
    List<CourseScript.PodScreen> screens = new ArrayList<>();
    if (screensArray == null) {
      return screens;
    }

    for (int index = 0; index < screensArray.length(); index += 1) {
      JSONObject screenObject = screensArray.optJSONObject(index);
      if (screenObject == null) {
        continue;
      }

      screens.add(
          new CourseScript.PodScreen(
              screenObject.optInt("screenIndex", index + 1),
              screenObject.optInt("loopCount", 0),
              screenObject.optInt("stationRestSeconds", 0),
              parseSetConfigs(screenObject.optJSONArray("setConfigs"))));
    }

    return screens;
  }

  protected List<CourseScript.PodSetConfig> parseSetConfigs(JSONArray setConfigsArray) {
    List<CourseScript.PodSetConfig> setConfigs = new ArrayList<>();
    if (setConfigsArray == null) {
      return setConfigs;
    }

    for (int index = 0; index < setConfigsArray.length(); index += 1) {
      JSONObject setConfigObject = setConfigsArray.optJSONObject(index);
      if (setConfigObject == null) {
        continue;
      }

      setConfigs.add(
          new CourseScript.PodSetConfig(
              setConfigObject.optInt("workSeconds", 0),
              setConfigObject.optInt("restSeconds", 0)));
    }

    return setConfigs;
  }
}
