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
}
