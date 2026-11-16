package com.infini.tv.testutil;

import com.infini.tv.model.CourseScript;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public final class CourseScriptFixtures {
  private CourseScriptFixtures() {}

  public static CourseScript singleScreenHydrateCourse() {
    return singleScreenHydrateCourse(8);
  }

  public static CourseScript singleScreenHydrateCourse(int podEndingSeconds) {
    CourseScript.VideoGroup group =
        new CourseScript.VideoGroup(
            "group-single",
            "Single Screen",
            1,
            Collections.singletonList(
                new CourseScript.VideoGroupScreen(
                    1,
                    "A",
                    Collections.emptyList(),
                    Arrays.asList(card("burpee", "Burpee", "1"), card("row", "Row", "2")))));

    CourseScript.Pod pod =
        new CourseScript.Pod(
            "Pod A",
            "group-single",
            "HYDRATE",
            podEndingSeconds,
            "REGION",
            Collections.singletonList(
                new CourseScript.PodScreen(
                    1,
                    2,
                    7,
                    Arrays.asList(new CourseScript.PodSetConfig(20, 10), new CourseScript.PodSetConfig(15, 0)))));

    return new CourseScript(
        metadata(8),
        waterfall("Warmup", new CourseScript.WaterfallItem("warm", "Warm Up", "", 10, "WARM")),
        waterfall("Cooldown", new CourseScript.WaterfallItem("cool", "Cool Down", "", 5, "COOL")),
        Collections.singletonList(group),
        Collections.singletonList(pod),
        emptyPlan());
  }

  public static CourseScript switchPairCourse() {
    return switchPairCourseWithSetConfigs(
        Collections.singletonList(new CourseScript.PodSetConfig(30, 5)));
  }

  public static CourseScript switchPairMultiSetCourse() {
    return switchPairCourseWithSetConfigs(
        Arrays.asList(
            new CourseScript.PodSetConfig(30, 5),
            new CourseScript.PodSetConfig(30, 0)));
  }

  private static CourseScript switchPairCourseWithSetConfigs(
      List<CourseScript.PodSetConfig> setConfigs) {
    CourseScript.VideoGroup group =
        new CourseScript.VideoGroup(
            "group-switch",
            "Switch Pair",
            2,
            Collections.singletonList(
                new CourseScript.VideoGroupScreen(
                    1,
                    "Pair",
                    Collections.singletonList(2),
                    Arrays.asList(card("ski", "Ski Erg", "A"), card("sled", "Sled Push", "B")))));

    CourseScript.Pod pod =
        new CourseScript.Pod(
            "Switch Pod",
            "group-switch",
            "FINISH",
            0,
            "SWITCH",
            Collections.singletonList(
                new CourseScript.PodScreen(
                    1,
                    1,
                    4,
                    setConfigs)));

    return new CourseScript(
        metadata(0),
        waterfall("Warmup"),
        waterfall("Cooldown"),
        Collections.singletonList(group),
        Collections.singletonList(pod),
        emptyPlan());
  }

  public static CourseScript switchRotationCourse() {
    CourseScript.VideoGroup group =
        new CourseScript.VideoGroup(
            "group-switch-rotation",
            "Switch Rotation",
            2,
            Collections.singletonList(
                new CourseScript.VideoGroupScreen(
                    1,
                    "Pairs",
                    Arrays.asList(2, 2),
                    Arrays.asList(
                        card("ski", "Ski Erg", "A1"),
                        card("sled", "Sled Push", "B1"),
                        card("row", "Row", "A2"),
                        card("burpee", "Burpee", "B2")))));

    CourseScript.Pod pod =
        new CourseScript.Pod(
            "Switch Rotation Pod",
            "group-switch-rotation",
            "FINISH",
            0,
            "SWITCH",
            Collections.singletonList(
                new CourseScript.PodScreen(
                    1,
                    4,
                    4,
                    Collections.singletonList(new CourseScript.PodSetConfig(30, 0)))));

    return new CourseScript(
        metadata(0),
        waterfall("Warmup"),
        waterfall("Cooldown"),
        Collections.singletonList(group),
        Collections.singletonList(pod),
        emptyPlan());
  }

  public static CourseScript.VideoCard card(String id, String name, String stationNumber) {
    return new CourseScript.VideoCard(id, name, "https://cdn.example.test/" + id + ".mp4", stationNumber, "");
  }

  public static CourseScript.VideoCard blankCard() {
    return new CourseScript.VideoCard("", " ", "", "", "");
  }

  private static CourseScript.Metadata metadata(int defaultHydrateSeconds) {
    return new CourseScript.Metadata(
        "fixture",
        "Fixture Course",
        "1",
        "test",
        defaultHydrateSeconds,
        3,
        4,
        5,
        2,
        1,
        20,
        10,
        "fixture",
        "unit",
        "REGION");
  }

  private static CourseScript.WaterfallSection waterfall(
      String title, CourseScript.WaterfallItem... items) {
    return new CourseScript.WaterfallSection(title, Arrays.asList(items));
  }

  private static CourseScript.Plan emptyPlan() {
    return new CourseScript.Plan(Collections.emptyList());
  }
}
