package com.infini.tv;

import com.infini.tv.component.horizontal.HorizontalProgressBarComponent;
import com.infini.tv.model.CourseScript;
import com.infini.tv.util.TrainingProgressCalculator;
import java.util.ArrayList;
import java.util.List;

abstract class MainActivityHorizontalWorkTimelineController extends MainActivityPreviewTransitionController {
  protected List<HorizontalProgressBarComponent.WorkSegment> buildHorizontalWorkTimeline(CourseScript course) {
    List<HorizontalProgressBarComponent.WorkSegment> segments = new ArrayList<>();
    for (TrainingProgressCalculator.WorkSegment timing : TrainingProgressCalculator.buildHorizontalWorkTimeline(course)) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.startOffsetSeconds,
              timing.durationSeconds,
              timing.markerAfter));
    }

    return segments;
  }

  protected int getHorizontalWorkTotalSeconds(
      List<HorizontalProgressBarComponent.WorkSegment> segments) {
    if (segments == null || segments.isEmpty()) {
      return 0;
    }

    int totalSeconds = 0;
    for (HorizontalProgressBarComponent.WorkSegment segment : segments) {
      if (segment != null) {
        totalSeconds += Math.max(segment.durationSeconds, 0);
      }
    }
    return totalSeconds;
  }

  protected int resolveHorizontalWorkElapsedSeconds(CourseScript course, int elapsedSeconds) {
    return TrainingProgressCalculator.resolveHorizontalWorkElapsedSeconds(course, elapsedSeconds);
  }

  protected int getHorizontalFormalTrainingTotalSeconds(CourseScript course) {
    return TrainingProgressCalculator.getFormalTrainingTotalSeconds(course);
  }

  protected int resolveHorizontalFormalTrainingElapsedSeconds(CourseScript course, int elapsedSeconds) {
    return TrainingProgressCalculator.resolveFormalTrainingElapsedSeconds(course, elapsedSeconds);
  }

  protected List<HorizontalWorkTiming> buildHorizontalWorkTimings(CourseScript course) {
    List<HorizontalWorkTiming> timings = new ArrayList<>();
    if (course == null || course.pods == null) {
      return timings;
    }

    int realTrainingOffsetSeconds = 0;
    int workOffsetSeconds = 0;
    for (CourseScript.Pod pod : course.pods) {
      EffectivePodScreen effectiveScreen = materializeProgressPodScreen(course, pod);
      int firstIndex = timings.size();
      workOffsetSeconds =
          addHorizontalWorkTimings(
              timings,
              pod,
              effectiveScreen,
              realTrainingOffsetSeconds,
              workOffsetSeconds);

      int podDurationSeconds = getPodDurationSeconds(pod, effectiveScreen);
      int endingDurationSeconds = getPodEndingDurationSeconds(course, pod);
      if (endingDurationSeconds > 0 && isProgressMarkerPod(pod) && timings.size() > firstIndex) {
        timings.get(timings.size() - 1).markerAfter = true;
      }
      realTrainingOffsetSeconds += podDurationSeconds + endingDurationSeconds;
    }
    return timings;
  }

  protected void addHorizontalWorkSegments(
      List<HorizontalProgressBarComponent.WorkSegment> segments,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int podOffsetSeconds) {
    if (segments == null) {
      return;
    }

    List<HorizontalWorkTiming> timings = new ArrayList<>();
    addHorizontalWorkTimings(timings, pod, effectiveScreen, podOffsetSeconds, podOffsetSeconds);
    for (HorizontalWorkTiming timing : timings) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.workStartSeconds,
              timing.durationSeconds,
              false));
    }
  }

  protected int addHorizontalWorkTimings(
      List<HorizontalWorkTiming> timings,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int realPodOffsetSeconds,
      int workOffsetSeconds) {
    if (timings == null
        || pod == null
        || effectiveScreen == null
        || effectiveScreen.rule == null
        || effectiveScreen.rule.setConfigs == null
        || effectiveScreen.rule.setConfigs.isEmpty()
        || effectiveScreen.videoCards == null
        || effectiveScreen.videoCards.isEmpty()) {
      return workOffsetSeconds;
    }

    if ("SWITCH".equals(pod.stationFlow) && effectiveScreen.videoCards.size() >= 2) {
      return addHorizontalSwitchWorkTimings(timings, effectiveScreen, realPodOffsetSeconds, workOffsetSeconds);
    }

    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int screenOffsetSeconds = 0;

    if (effectiveScreen.waterfallLayout) {
      List<CourseScript.VideoCard> actionSequence = new ArrayList<>();
      for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
        actionSequence.addAll(effectiveScreen.videoCards);
      }

      for (int actionIndex = 0; actionIndex < actionSequence.size(); actionIndex += 1) {
        for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
          int workSeconds = Math.max(setConfig == null ? 0 : setConfig.workSeconds, 0);
          if (workSeconds > 0) {
            timings.add(
                new HorizontalWorkTiming(
                    realPodOffsetSeconds + screenOffsetSeconds,
                    workOffsetSeconds,
                    workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
          if (hasNextSet && setConfig != null && setConfig.restSeconds > 0) {
            screenOffsetSeconds += setConfig.restSeconds;
          }
        }

        boolean hasNextAction = actionIndex < actionSequence.size() - 1;
        if (hasNextAction && effectiveScreen.rule.stationRestSeconds > 0) {
          screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
        }
      }
      return workOffsetSeconds;
    }

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
        int workSeconds = Math.max(setConfig == null ? 0 : setConfig.workSeconds, 0);
        if (workSeconds > 0) {
          timings.add(
              new HorizontalWorkTiming(
                  realPodOffsetSeconds + screenOffsetSeconds,
                  workOffsetSeconds,
                  workSeconds));
          workOffsetSeconds += workSeconds;
        }
        screenOffsetSeconds += workSeconds;

        boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
        if (hasNextSet && setConfig != null && setConfig.restSeconds > 0) {
          screenOffsetSeconds += setConfig.restSeconds;
        }
      }

      boolean hasNextLoop = loopIndex < safeLoops - 1;
      if (hasNextLoop && effectiveScreen.rule.stationRestSeconds > 0) {
        screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
      }
    }
    return workOffsetSeconds;
  }

  protected void addHorizontalSwitchWorkSegments(
      List<HorizontalProgressBarComponent.WorkSegment> segments,
      EffectivePodScreen effectiveScreen,
      int podOffsetSeconds) {
    if (segments == null) {
      return;
    }
    List<HorizontalWorkTiming> timings = new ArrayList<>();
    addHorizontalSwitchWorkTimings(timings, effectiveScreen, podOffsetSeconds, podOffsetSeconds);
    for (HorizontalWorkTiming timing : timings) {
      segments.add(
          new HorizontalProgressBarComponent.WorkSegment(
              timing.workStartSeconds,
              timing.durationSeconds,
              false));
    }
  }

  protected int addHorizontalSwitchWorkTimings(
      List<HorizontalWorkTiming> timings,
      EffectivePodScreen effectiveScreen,
      int realPodOffsetSeconds,
      int workOffsetSeconds) {
    int screenOffsetSeconds = 0;
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int pairCount = effectiveScreen.videoCards.size() / 2;
    if (pairCount <= 0) {
      return workOffsetSeconds;
    }

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      for (int pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
          int workSeconds = Math.max(setConfig == null ? 0 : setConfig.workSeconds, 0);
          if (workSeconds > 0) {
            timings.add(
                new HorizontalWorkTiming(
                    realPodOffsetSeconds + screenOffsetSeconds,
                    workOffsetSeconds,
                    workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          if (effectiveScreen.rule.stationRestSeconds > 0) {
            screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
          }

          if (workSeconds > 0) {
            timings.add(
                new HorizontalWorkTiming(
                    realPodOffsetSeconds + screenOffsetSeconds,
                    workOffsetSeconds,
                    workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
          if (hasNextSet && setConfig != null && setConfig.restSeconds > 0) {
            screenOffsetSeconds += setConfig.restSeconds;
          }
        }

        boolean hasNextPairRound = pairIndex < pairCount - 1 || loopIndex < safeLoops - 1;
        if (hasNextPairRound && effectiveScreen.rule.stationRestSeconds > 0) {
          screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
        }
      }
    }
    return workOffsetSeconds;
  }

  protected EffectivePodScreen materializeProgressPodScreen(CourseScript course, CourseScript.Pod pod) {
    CourseScript.VideoGroup group = findVideoGroup(course, pod == null ? null : pod.videoGroupId);
    if (group == null) {
      return null;
    }
    if (group.screenCount <= 1) {
      return materializePodScreen(pod, group, 1);
    }

    EffectivePodScreen bestScreen = null;
    int bestWorkSegmentCount = -1;
    for (int screenIndex = 1; screenIndex <= Math.max(group.screenCount, 3); screenIndex += 1) {
      if (findPodScreen(pod, screenIndex) == null || findVideoGroupScreen(group, screenIndex) == null) {
        continue;
      }
      EffectivePodScreen candidate = materializePodScreen(pod, group, screenIndex);
      int workSegmentCount = countHorizontalProgressWorkSegments(pod, candidate);
      if (candidate != null && workSegmentCount > bestWorkSegmentCount) {
        bestScreen = candidate;
        bestWorkSegmentCount = workSegmentCount;
      }
    }
    return bestScreen;
  }

  protected int countHorizontalProgressWorkSegments(
      CourseScript.Pod pod, EffectivePodScreen effectiveScreen) {
    if (pod == null
        || effectiveScreen == null
        || effectiveScreen.rule == null
        || effectiveScreen.rule.setConfigs == null
        || effectiveScreen.rule.setConfigs.isEmpty()
        || effectiveScreen.videoCards == null
        || effectiveScreen.videoCards.isEmpty()) {
      return 0;
    }

    int positiveWorkSetCount = 0;
    for (CourseScript.PodSetConfig setConfig : effectiveScreen.rule.setConfigs) {
      if (setConfig != null && setConfig.workSeconds > 0) {
        positiveWorkSetCount += 1;
      }
    }
    if (positiveWorkSetCount <= 0) {
      return 0;
    }

    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    if ("SWITCH".equals(pod.stationFlow) && effectiveScreen.videoCards.size() >= 2) {
      int pairCount = effectiveScreen.videoCards.size() / 2;
      return pairCount * safeLoops * positiveWorkSetCount * 2;
    }
    if (effectiveScreen.waterfallLayout) {
      return effectiveScreen.videoCards.size() * safeLoops * positiveWorkSetCount;
    }
    return safeLoops * positiveWorkSetCount;
  }

  protected boolean isProgressMarkerPod(CourseScript.Pod pod) {
    return pod != null && ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending));
  }

  protected int getCourseTotalSeconds(CourseScript course) {
    if (course == null) {
      return 0;
    }
    return getWarmupReadySeconds(course)
        + getWaterfallTotalSeconds(course.warmup)
        + getTrainingReadySeconds(course)
        + getTrainingTotalSeconds(course)
        + getCooldownReadySeconds(course)
        + getWaterfallTotalSeconds(course.cooldown);
  }

  protected static final class HorizontalWorkTiming {
    final int realStartSeconds;
    final int workStartSeconds;
    final int durationSeconds;
    boolean markerAfter;

    HorizontalWorkTiming(int realStartSeconds, int workStartSeconds, int durationSeconds) {
      this.realStartSeconds = Math.max(realStartSeconds, 0);
      this.workStartSeconds = Math.max(workStartSeconds, 0);
      this.durationSeconds = Math.max(durationSeconds, 0);
      this.markerAfter = false;
    }
  }
}
