package com.infini.tv.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.infini.tv.model.CourseScript;
import com.infini.tv.testutil.CourseScriptFixtures;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class TrainingProgressCalculatorTest {
  @Test
  public void buildHorizontalWorkTimeline_skipsRestAndMarksHydrateBreak() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse();

    List<TrainingProgressCalculator.WorkSegment> segments =
        TrainingProgressCalculator.buildHorizontalWorkTimeline(course);

    assertEquals(8, segments.size());
    assertSegment(segments.get(0), 0, 20, false);
    assertSegment(segments.get(1), 20, 15, false);
    assertSegment(segments.get(7), 125, 15, true);
    assertEquals(140, TrainingProgressCalculator.getWorkTotalSeconds(segments));
    assertEquals(209, TrainingProgressCalculator.getTrainingTotalSeconds(course));
  }

  @Test
  public void resolveHorizontalWorkElapsedSeconds_freezesDuringRestAndClampsAfterEnd() {
    CourseScript course = CourseScriptFixtures.singleScreenHydrateCourse();

    assertEquals(20, TrainingProgressCalculator.resolveHorizontalWorkElapsedSeconds(course, 25));
    assertEquals(20, TrainingProgressCalculator.resolveHorizontalWorkElapsedSeconds(course, 30));
    assertEquals(30, TrainingProgressCalculator.resolveHorizontalWorkElapsedSeconds(course, 40));
    assertEquals(140, TrainingProgressCalculator.resolveHorizontalWorkElapsedSeconds(course, 10_000));
  }

  @Test
  public void buildHorizontalWorkTimings_switchPairSeparatesRealRestFromWorkProgress() {
    CourseScript course = CourseScriptFixtures.switchPairCourse();

    List<TrainingProgressCalculator.WorkTiming> timings =
        TrainingProgressCalculator.buildHorizontalWorkTimings(course);

    assertEquals(2, timings.size());
    assertTiming(timings.get(0), 0, 0, 30, false);
    assertTiming(timings.get(1), 34, 30, 30, false);
    assertEquals(60, TrainingProgressCalculator.getWorkTotalSeconds(
        TrainingProgressCalculator.buildHorizontalWorkTimeline(course)));
    assertEquals(64, TrainingProgressCalculator.getTrainingTotalSeconds(course));
  }

  @Test
  public void buildHorizontalWorkTimings_reportsRealStartOffsetsAcrossSwitchRest() {
    CourseScript course = CourseScriptFixtures.switchPairCourse();
    List<TrainingProgressCalculator.WorkTiming> timings =
        TrainingProgressCalculator.buildHorizontalWorkTimings(course);

    List<Integer> realStarts = Arrays.asList(
        timings.get(0).realStartSeconds,
        timings.get(1).realStartSeconds);

    assertEquals(Arrays.asList(0, 34), realStarts);
  }

  private static void assertSegment(
      TrainingProgressCalculator.WorkSegment segment,
      int startOffsetSeconds,
      int durationSeconds,
      boolean markerAfter) {
    assertEquals(startOffsetSeconds, segment.startOffsetSeconds);
    assertEquals(durationSeconds, segment.durationSeconds);
    if (markerAfter) {
      assertTrue(segment.markerAfter);
    } else {
      assertFalse(segment.markerAfter);
    }
  }

  private static void assertTiming(
      TrainingProgressCalculator.WorkTiming timing,
      int realStartSeconds,
      int workStartSeconds,
      int durationSeconds,
      boolean markerAfter) {
    assertEquals(realStartSeconds, timing.realStartSeconds);
    assertEquals(workStartSeconds, timing.workStartSeconds);
    assertEquals(durationSeconds, timing.durationSeconds);
    if (markerAfter) {
      assertTrue(timing.markerAfter);
    } else {
      assertFalse(timing.markerAfter);
    }
  }
}
