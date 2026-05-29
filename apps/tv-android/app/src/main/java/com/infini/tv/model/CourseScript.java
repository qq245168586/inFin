package com.infini.tv.model;

import java.util.List;

public class CourseScript {
  public final Metadata metadata;
  public final WaterfallSection warmup;
  public final WaterfallSection cooldown;
  public final List<VideoGroup> videoGroups;
  public final List<Pod> pods;
  public final Plan plan;

  public CourseScript(
      Metadata metadata,
      WaterfallSection warmup,
      WaterfallSection cooldown,
      List<VideoGroup> videoGroups,
      List<Pod> pods,
      Plan plan) {
    this.metadata = metadata;
    this.warmup = warmup;
    this.cooldown = cooldown;
    this.videoGroups = videoGroups;
    this.pods = pods;
    this.plan = plan;
  }

  public static class Plan {
    public final List<PlanSection> sections;

    public Plan(List<PlanSection> sections) {
      this.sections = sections;
    }
  }

  public static class PlanSection {
    public final String title;
    public final List<PlanItem> items;

    public PlanSection(String title, List<PlanItem> items) {
      this.title = title;
      this.items = items;
    }
  }

  public static class PlanItem {
    public final String text;

    public PlanItem(String text) {
      this.text = text;
    }
  }

  public static class Metadata {
    public final String id;
    public final String name;
    public final String version;
    public final String creator;
    public final int defaultHydrateSeconds;
    public final int readyWarmupSeconds;
    public final int readyWorkoutSeconds;
    public final int readyCooldownSeconds;
    public final int setCount;
    public final int breakCount;
    public final int workSeconds;
    public final int restSeconds;

    public Metadata(
        String id,
        String name,
        String version,
        String creator,
        int defaultHydrateSeconds,
        int readyWarmupSeconds,
        int readyWorkoutSeconds,
        int readyCooldownSeconds,
        int setCount,
        int breakCount,
        int workSeconds,
        int restSeconds) {
      this.id = id;
      this.name = name;
      this.version = version;
      this.creator = creator;
      this.defaultHydrateSeconds = defaultHydrateSeconds;
      this.readyWarmupSeconds = readyWarmupSeconds;
      this.readyWorkoutSeconds = readyWorkoutSeconds;
      this.readyCooldownSeconds = readyCooldownSeconds;
      this.setCount = setCount;
      this.breakCount = breakCount;
      this.workSeconds = workSeconds;
      this.restSeconds = restSeconds;
    }
  }

  public static class WaterfallSection {
    public final String title;
    public final List<WaterfallItem> items;

    public WaterfallSection(String title, List<WaterfallItem> items) {
      this.title = title;
      this.items = items;
    }
  }

  public static class WaterfallItem {
    public final String actionId;
    public final String actionName;
    public final String mediaUrl;
    public final int seconds;
    public final String cue;

    public WaterfallItem(String actionId, String actionName, String mediaUrl, int seconds, String cue) {
      this.actionId = actionId;
      this.actionName = actionName;
      this.mediaUrl = mediaUrl;
      this.seconds = seconds;
      this.cue = cue;
    }
  }

  public static class VideoGroup {
    public final String id;
    public final String name;
    public final int screenCount;
    public final List<VideoGroupScreen> screens;

    public VideoGroup(String id, String name, int screenCount, List<VideoGroupScreen> screens) {
      this.id = id;
      this.name = name;
      this.screenCount = screenCount;
      this.screens = screens;
    }
  }

  public static class VideoGroupScreen {
    public final int screenIndex;
    public final String stationLabel;
    public final List<Integer> rowLayouts;
    public final List<VideoCard> videoCards;

    public VideoGroupScreen(
        int screenIndex, String stationLabel, List<Integer> rowLayouts, List<VideoCard> videoCards) {
      this.screenIndex = screenIndex;
      this.stationLabel = stationLabel;
      this.rowLayouts = rowLayouts;
      this.videoCards = videoCards;
    }
  }

  public static class VideoCard {
    public final String actionId;
    public final String actionName;
    public final String mediaUrl;
    public final String stationNumber;

    public VideoCard(String actionId, String actionName, String mediaUrl, String stationNumber) {
      this.actionId = actionId;
      this.actionName = actionName;
      this.mediaUrl = mediaUrl;
      this.stationNumber = stationNumber;
    }
  }

  public static class Pod {
    public final String name;
    public final String videoGroupId;
    public final String ending;
    public final String stationFlow;
    public final List<PodScreen> screens;

    public Pod(String name, String videoGroupId, String ending, String stationFlow, List<PodScreen> screens) {
      this.name = name;
      this.videoGroupId = videoGroupId;
      this.ending = ending;
      this.stationFlow = stationFlow;
      this.screens = screens;
    }
  }

  public static class PodScreen {
    public final int screenIndex;
    public final int loopCount;
    public final int stationRestSeconds;
    public final List<PodSetConfig> setConfigs;

    public PodScreen(int screenIndex, int loopCount, int stationRestSeconds, List<PodSetConfig> setConfigs) {
      this.screenIndex = screenIndex;
      this.loopCount = loopCount;
      this.stationRestSeconds = stationRestSeconds;
      this.setConfigs = setConfigs;
    }
  }

  public static class PodSetConfig {
    public final int workSeconds;
    public final int restSeconds;

    public PodSetConfig(int workSeconds, int restSeconds) {
      this.workSeconds = workSeconds;
      this.restSeconds = restSeconds;
    }
  }
}
