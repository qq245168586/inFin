package com.infini.tv.player;

import static org.junit.Assert.assertEquals;

import com.infini.tv.model.CourseScript;
import com.infini.tv.model.PlaybackStep;
import com.infini.tv.testutil.CourseScriptFixtures;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class TimelinePlannerTest {
  @Test
  public void build_singleScreenCourseMaterializesWorkForAllThreeScreens() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse();

    List<PlaybackStep> steps = new TimelinePlanner().build(course);

    List<Integer> firstBurpeeScreens = new ArrayList<>();
    for (PlaybackStep step : steps) {
      if ("POD_WORK".equals(step.stage)
          && "Burpee".equals(step.actionName)
          && step.startOffsetSeconds == 10) {
        firstBurpeeScreens.add(step.screenIndex);
      }
    }
    assertEquals(Arrays.asList(1, 2, 3), firstBurpeeScreens);
  }

  @Test
  public void build_placesHydrateAfterLongestMaterializedTrainingScreen() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse();

    PlaybackStep hydrate = null;
    for (PlaybackStep step : new TimelinePlanner().build(course)) {
      if ("POD_HYDRATE".equals(step.stage)) {
        hydrate = step;
        break;
      }
    }

    assertEquals(211, hydrate.startOffsetSeconds);
    assertEquals(8, hydrate.durationSeconds);
  }

  @Test
  public void build_usesPodEndingSecondsInsteadOfCourseDefault() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse(13);

    PlaybackStep hydrate = null;
    for (PlaybackStep step : new TimelinePlanner().build(course)) {
      if ("POD_HYDRATE".equals(step.stage)) {
        hydrate = step;
        break;
      }
    }

    assertEquals(13, hydrate.durationSeconds);
  }

  @Test
  public void build_fallsBackToCourseDefaultForLegacyPod() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse(-1);

    PlaybackStep hydrate = null;
    for (PlaybackStep step : new TimelinePlanner().build(course)) {
      if ("POD_HYDRATE".equals(step.stage)) {
        hydrate = step;
        break;
      }
    }

    assertEquals(8, hydrate.durationSeconds);
  }

  @Test
  public void build_switchRoundsRotatePairsAndMoveStationBetweenRounds() {
    CourseScript course = CourseScriptFixtures.switchRotationCourse();
    List<String> workActions = new ArrayList<>();
    List<String> transitions = new ArrayList<>();

    for (PlaybackStep step : new TimelinePlanner().build(course)) {
      if ("POD_WORK".equals(step.stage)) {
        workActions.add(step.actionName);
      }
      if ("POD_REST".equals(step.stage) && step.overlayText != null && !step.overlayText.isEmpty()) {
        transitions.add(step.overlayText);
      }
    }

    assertEquals(
        Arrays.asList("Ski Erg", "Sled Push", "Row", "Burpee", "Ski Erg", "Sled Push", "Row", "Burpee"),
        workActions);
    assertEquals(
        Arrays.asList("SWITCH", "MOVE_STATION", "SWITCH", "MOVE_STATION", "SWITCH", "MOVE_STATION", "SWITCH"),
        transitions);
  }

  @Test
  public void build_switchPodDisplaysSetRestAsSwitch() {
    CourseScript course = CourseScriptFixtures.switchPairMultiSetCourse();
    List<String> transitions = new ArrayList<>();

    for (PlaybackStep step : new TimelinePlanner().build(course)) {
      if ("POD_REST".equals(step.stage) && step.overlayText != null && !step.overlayText.isEmpty()) {
        transitions.add(step.overlayText);
      }
    }

    assertEquals(Arrays.asList("SWITCH", "SWITCH", "SWITCH"), transitions);
  }
}
