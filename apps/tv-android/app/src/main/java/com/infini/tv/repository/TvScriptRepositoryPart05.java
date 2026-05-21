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

abstract class TvScriptRepositoryPart05 extends TvScriptRepositoryPart04 {
  protected TvScriptRepositoryPart05(Context context) {
    super(context);
  }

  protected String encode(String text) {
    try {
      return URLEncoder.encode(text, StandardCharsets.UTF_8.name());
    } catch (UnsupportedEncodingException error) {
      throw new IllegalStateException("UTF-8 should always be available", error);
    }
  }

  protected boolean isNowInside(LocalDateTime startTime, int durationMinutes) {
    LocalDateTime now = LocalDateTime.now(COURSE_ZONE);
    LocalDateTime endTime = startTime.plusMinutes(durationMinutes);
    return !now.isBefore(startTime) && now.isBefore(endTime);
  }

  protected String buildLogoText(String courseName) {
    if (courseName == null || courseName.trim().isEmpty()) {
      return "INFINI";
    }

    String normalized = courseName.trim().replaceAll("\\s+", " ");
    if (normalized.length() <= 10) {
      return normalized.replace(" ", "\n");
    }

    String[] parts = normalized.split(" ");
    if (parts.length >= 2) {
      return (parts[0] + "\n" + parts[1]).toUpperCase(Locale.US);
    }

    return normalized.substring(0, Math.min(10, normalized.length())).toUpperCase(Locale.US);
  }

  protected String extractCourseLogoSource(JSONObject courseObject, Map<String, String> localMediaMap) {
    if (courseObject == null) {
      return "";
    }

    JSONObject logoMediaObject = courseObject.optJSONObject("logoMedia");
    if (logoMediaObject == null) {
      return "";
    }

    String url = logoMediaObject.optString("url");
    if (url == null || url.trim().isEmpty()) {
      return "";
    }

    String cachedPath = localMediaMap.get(url);
    if (cachedPath != null && !cachedPath.trim().isEmpty()) {
      return cachedPath;
    }

    return resolveMediaUrl(url);
  }

  protected CourseScript parseCourseScript(JSONObject scriptObject) {
    JSONObject metadataObject = scriptObject.optJSONObject("metadata");
    JSONObject sectionsObject = scriptObject.optJSONObject("sections");
    JSONObject warmupObject = sectionsObject != null ? sectionsObject.optJSONObject("warmup") : null;
    JSONObject cooldownObject = sectionsObject != null ? sectionsObject.optJSONObject("cooldown") : null;
    JSONObject trainingObject = scriptObject.optJSONObject("training");
    JSONObject planObject = scriptObject.optJSONObject("plan");
    JSONObject panelObject = metadataObject != null ? metadataObject.optJSONObject("trainingPanel") : null;

    return new CourseScript(
        new CourseScript.Metadata(
            metadataObject != null ? metadataObject.optString("id") : "",
            metadataObject != null ? metadataObject.optString("name") : "",
            metadataObject != null ? metadataObject.optString("version") : "",
            metadataObject != null ? metadataObject.optString("creator") : "",
            metadataObject != null ? metadataObject.optInt("defaultHydrateSeconds", 0) : 0,
            panelObject != null ? panelObject.optInt("setCount", 0) : 0,
            panelObject != null ? panelObject.optInt("breakCount", 0) : 0,
            panelObject != null ? panelObject.optInt("workSeconds", 0) : 0,
            panelObject != null ? panelObject.optInt("restSeconds", 0) : 0),
        parseWaterfallSection(warmupObject, "热身"),
        parseWaterfallSection(cooldownObject, "冷身"),
        parseVideoGroups(trainingObject != null ? trainingObject.optJSONArray("videoGroups") : null),
        parsePods(trainingObject != null ? trainingObject.optJSONArray("pods") : null),
        parseCoursePlan(planObject));
  }

  protected CourseScript localizeCourseScript(CourseScript source, Map<String, String> localMediaMap) {
    if (source == null) {
      return null;
    }

    return new CourseScript(
        source.metadata,
        localizeWaterfall(source.warmup, localMediaMap),
        localizeWaterfall(source.cooldown, localMediaMap),
        localizeVideoGroups(source.videoGroups, localMediaMap),
        source.pods,
        source.plan);
  }

  protected CourseScript.Plan parseCoursePlan(JSONObject planObject) {
    JSONArray sectionsArray = planObject != null ? planObject.optJSONArray("sections") : null;
    List<CourseScript.PlanSection> sections = new ArrayList<>();
    if (sectionsArray != null) {
      for (int index = 0; index < sectionsArray.length(); index += 1) {
        JSONObject sectionObject = sectionsArray.optJSONObject(index);
        if (sectionObject == null) {
          continue;
        }
        sections.add(
            new CourseScript.PlanSection(
                sectionObject.optString("title"),
                parseCoursePlanItems(sectionObject.optJSONArray("items"))));
      }
    }
    return new CourseScript.Plan(sections);
  }

  protected List<CourseScript.PlanItem> parseCoursePlanItems(JSONArray itemsArray) {
    List<CourseScript.PlanItem> items = new ArrayList<>();
    if (itemsArray == null) {
      return items;
    }
    for (int index = 0; index < itemsArray.length(); index += 1) {
      JSONObject itemObject = itemsArray.optJSONObject(index);
      if (itemObject == null) {
        continue;
      }
      String text = itemObject.optString("text", "").trim();
      if (!text.isEmpty()) {
        items.add(new CourseScript.PlanItem(text));
      }
    }
    return items;
  }

  protected CourseScript.WaterfallSection localizeWaterfall(
      CourseScript.WaterfallSection source, Map<String, String> localMediaMap) {
    if (source == null) {
      return null;
    }

    List<CourseScript.WaterfallItem> items = new ArrayList<>();
    for (CourseScript.WaterfallItem item : source.items) {
      items.add(
          new CourseScript.WaterfallItem(
              item.actionId,
              item.actionName,
              localMediaMap.getOrDefault(item.mediaUrl, item.mediaUrl),
              item.seconds,
              item.cue));
    }
    return new CourseScript.WaterfallSection(source.title, items);
  }

  protected List<CourseScript.VideoGroup> localizeVideoGroups(
      List<CourseScript.VideoGroup> source, Map<String, String> localMediaMap) {
    List<CourseScript.VideoGroup> groups = new ArrayList<>();
    if (source == null) {
      return groups;
    }

    for (CourseScript.VideoGroup group : source) {
      List<CourseScript.VideoGroupScreen> screens = new ArrayList<>();
      for (CourseScript.VideoGroupScreen screen : group.screens) {
        List<CourseScript.VideoCard> cards = new ArrayList<>();
        for (CourseScript.VideoCard card : screen.videoCards) {
          cards.add(
              new CourseScript.VideoCard(
                  card.actionId,
                  card.actionName,
                  localMediaMap.getOrDefault(card.mediaUrl, card.mediaUrl),
                  card.stationNumber));
        }
        screens.add(new CourseScript.VideoGroupScreen(screen.screenIndex, screen.stationLabel, cards));
      }
      groups.add(new CourseScript.VideoGroup(group.id, group.name, group.screenCount, screens));
    }

    return groups;
  }

  protected CourseScript.WaterfallSection parseWaterfallSection(JSONObject sectionObject, String fallbackTitle) {
    JSONArray itemsArray = sectionObject != null ? sectionObject.optJSONArray("items") : null;
    List<CourseScript.WaterfallItem> items = new ArrayList<>();
    if (itemsArray != null) {
      for (int index = 0; index < itemsArray.length(); index += 1) {
        JSONObject itemObject = itemsArray.optJSONObject(index);
        if (itemObject == null) {
          continue;
        }

        items.add(
            new CourseScript.WaterfallItem(
                itemObject.optString("actionId"),
                itemObject.optString("actionName"),
                itemObject.optString("mediaUrl"),
                itemObject.optInt("seconds", 0),
                itemObject.optString("cue")));
      }
    }

    return new CourseScript.WaterfallSection(
        sectionObject != null ? sectionObject.optString("title", fallbackTitle) : fallbackTitle,
        items);
  }

  protected List<CourseScript.VideoGroup> parseVideoGroups(JSONArray groupsArray) {
    List<CourseScript.VideoGroup> groups = new ArrayList<>();
    if (groupsArray == null) {
      return groups;
    }

    for (int index = 0; index < groupsArray.length(); index += 1) {
      JSONObject groupObject = groupsArray.optJSONObject(index);
      if (groupObject == null) {
        continue;
      }

      groups.add(
          new CourseScript.VideoGroup(
              groupObject.optString("id"),
              groupObject.optString("name"),
              groupObject.optInt("screenCount", 1),
              parseVideoGroupScreens(groupObject.optJSONArray("screens"))));
    }
    return groups;
  }

  protected List<CourseScript.VideoGroupScreen> parseVideoGroupScreens(JSONArray screensArray) {
    List<CourseScript.VideoGroupScreen> screens = new ArrayList<>();
    if (screensArray == null) {
      return screens;
    }

    for (int index = 0; index < screensArray.length(); index += 1) {
      JSONObject screenObject = screensArray.optJSONObject(index);
      if (screenObject == null) {
        continue;
      }

      screens.add(
          new CourseScript.VideoGroupScreen(
              screenObject.optInt("screenIndex", index + 1),
              screenObject.optString("stationLabel"),
              parseVideoCards(screenObject.optJSONArray("videoCards"))));
    }

    return screens;
  }
}
