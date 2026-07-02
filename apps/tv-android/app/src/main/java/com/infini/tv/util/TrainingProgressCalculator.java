package com.infini.tv.util;

import com.infini.tv.model.CourseScript;
import java.util.ArrayList;
import java.util.List;

public final class TrainingProgressCalculator {
  private TrainingProgressCalculator() {}

  public static List<WorkSegment> buildHorizontalWorkTimeline(CourseScript course) {
    List<WorkSegment> segments = new ArrayList<>();
    for (WorkTiming timing : buildHorizontalWorkTimings(course)) {
      segments.add(new WorkSegment(timing.workStartSeconds, timing.durationSeconds, timing.markerAfter));
    }
    return segments;
  }

  public static int getWorkTotalSeconds(List<WorkSegment> segments) {
    if (segments == null || segments.isEmpty()) {
      return 0;
    }

    int totalSeconds = 0;
    for (WorkSegment segment : segments) {
      if (segment != null) {
        totalSeconds += Math.max(segment.durationSeconds, 0);
      }
    }
    return totalSeconds;
  }

  public static int resolveHorizontalWorkElapsedSeconds(CourseScript course, int elapsedSeconds) {
    int safeElapsedSeconds = Math.max(elapsedSeconds, 0);
    int workElapsedSeconds = 0;
    for (WorkTiming timing : buildHorizontalWorkTimings(course)) {
      if (timing == null || timing.durationSeconds <= 0) {
        continue;
      }
      if (safeElapsedSeconds < timing.realStartSeconds) {
        return workElapsedSeconds;
      }
      int realEndSeconds = timing.realStartSeconds + timing.durationSeconds;
      if (safeElapsedSeconds < realEndSeconds) {
        return timing.workStartSeconds + Math.max(safeElapsedSeconds - timing.realStartSeconds, 0);
      }
      workElapsedSeconds = timing.workStartSeconds + timing.durationSeconds;
    }
    return workElapsedSeconds;
  }

  public static List<WorkTiming> buildHorizontalWorkTimings(CourseScript course) {
    List<WorkTiming> timings = new ArrayList<>();
    if (course == null || course.pods == null) {
      return timings;
    }

    int realTrainingOffsetSeconds = 0;
    int workOffsetSeconds = 0;
    for (CourseScript.Pod pod : course.pods) {
      ProgressPodScreen effectiveScreen = materializeProgressPodScreen(course, pod);
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

  public static int getTrainingTotalSeconds(CourseScript course) {
    if (course == null || course.pods == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.Pod pod : course.pods) {
      total += getPodDurationSeconds(pod, materializeProgressPodScreen(course, pod));
      total += getPodEndingDurationSeconds(course, pod);
    }
    return total;
  }

  public static int getFormalTrainingTotalSeconds(CourseScript course) {
    if (course == null || course.pods == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.Pod pod : course.pods) {
      total += getPodDurationSeconds(pod, materializeProgressPodScreen(course, pod));
    }
    return total;
  }

  public static int resolveFormalTrainingElapsedSeconds(CourseScript course, int elapsedSeconds) {
    if (course == null || course.pods == null) {
      return 0;
    }

    int safeElapsedSeconds = Math.max(elapsedSeconds, 0);
    int realTrainingOffsetSeconds = 0;
    int formalTrainingElapsedSeconds = 0;
    for (CourseScript.Pod pod : course.pods) {
      ProgressPodScreen effectiveScreen = materializeProgressPodScreen(course, pod);
      int podDurationSeconds = getPodDurationSeconds(pod, effectiveScreen);
      int podEndSeconds = realTrainingOffsetSeconds + podDurationSeconds;
      if (safeElapsedSeconds < podEndSeconds) {
        return formalTrainingElapsedSeconds
            + Math.max(safeElapsedSeconds - realTrainingOffsetSeconds, 0);
      }

      formalTrainingElapsedSeconds += podDurationSeconds;
      realTrainingOffsetSeconds = podEndSeconds;

      int endingDurationSeconds = getPodEndingDurationSeconds(course, pod);
      int endingEndSeconds = realTrainingOffsetSeconds + endingDurationSeconds;
      if (safeElapsedSeconds < endingEndSeconds) {
        return formalTrainingElapsedSeconds;
      }
      realTrainingOffsetSeconds = endingEndSeconds;
    }
    return formalTrainingElapsedSeconds;
  }

  private static int addHorizontalWorkTimings(
      List<WorkTiming> timings,
      CourseScript.Pod pod,
      ProgressPodScreen effectiveScreen,
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
            timings.add(new WorkTiming(realPodOffsetSeconds + screenOffsetSeconds, workOffsetSeconds, workSeconds));
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
          timings.add(new WorkTiming(realPodOffsetSeconds + screenOffsetSeconds, workOffsetSeconds, workSeconds));
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

  private static int addHorizontalSwitchWorkTimings(
      List<WorkTiming> timings,
      ProgressPodScreen effectiveScreen,
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
            timings.add(new WorkTiming(realPodOffsetSeconds + screenOffsetSeconds, workOffsetSeconds, workSeconds));
            workOffsetSeconds += workSeconds;
          }
          screenOffsetSeconds += workSeconds;

          if (effectiveScreen.rule.stationRestSeconds > 0) {
            screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
          }

          if (workSeconds > 0) {
            timings.add(new WorkTiming(realPodOffsetSeconds + screenOffsetSeconds, workOffsetSeconds, workSeconds));
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

  private static int getPodDurationSeconds(CourseScript.Pod pod, ProgressPodScreen effectiveScreen) {
    if (effectiveScreen == null || effectiveScreen.videoCards == null || effectiveScreen.videoCards.isEmpty()) {
      return 0;
    }

    List<CourseScript.PodSetConfig> setConfigs = getEffectiveSetConfigs(effectiveScreen.rule);
    int duration = 0;
    int loopCount = Math.max(effectiveScreen.rule.loopCount, 1);

    if (!effectiveScreen.waterfallLayout) {
      if (isSwitchPod(pod)) {
        int pairCount = effectiveScreen.videoCards.size() / 2;
        if (pairCount <= 0) {
          return 0;
        }
        int stationRestSeconds = Math.max(effectiveScreen.rule.stationRestSeconds, 0);
        for (int loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
          for (int pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
            for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
              CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
              duration += Math.max(setConfig.workSeconds, 0) * 2;
              duration += stationRestSeconds;
              if (setIndex < setConfigs.size() - 1) {
                duration += Math.max(setConfig.restSeconds, 0);
              }
            }
            boolean hasNextPairRound = pairIndex < pairCount - 1 || loopIndex < loopCount - 1;
            if (hasNextPairRound) {
              duration += stationRestSeconds;
            }
          }
        }
        return duration;
      }
      for (int loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
        for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
          CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
          duration += Math.max(setConfig.workSeconds, 0);
          if (setIndex < setConfigs.size() - 1) {
            duration += Math.max(setConfig.restSeconds, 0);
          }
        }
        if (loopIndex < loopCount - 1) {
          duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
        }
      }
      return duration;
    }

    int totalActions = effectiveScreen.videoCards.size() * loopCount;
    for (int actionIndex = 0; actionIndex < totalActions; actionIndex += 1) {
      for (int setIndex = 0; setIndex < setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = setConfigs.get(setIndex);
        duration += Math.max(setConfig.workSeconds, 0);
        if (setIndex < setConfigs.size() - 1) {
          duration += Math.max(setConfig.restSeconds, 0);
        }
      }
      if (actionIndex < totalActions - 1) {
        duration += Math.max(effectiveScreen.rule.stationRestSeconds, 0);
      }
    }
    return duration;
  }

  private static int getPodEndingDurationSeconds(CourseScript course, CourseScript.Pod pod) {
    if (course == null || course.metadata == null || pod == null) {
      return 0;
    }

    if ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending)) {
      return Math.max(course.metadata.defaultHydrateSeconds, 0);
    }
    return 0;
  }

  private static CourseScript.VideoGroup findVideoGroup(CourseScript course, String videoGroupId) {
    if (course == null || course.videoGroups == null || videoGroupId == null) {
      return null;
    }

    for (CourseScript.VideoGroup group : course.videoGroups) {
      if (group != null && videoGroupId.equals(group.id)) {
        return group;
      }
    }
    return null;
  }

  private static CourseScript.VideoGroupScreen findVideoGroupScreen(
      CourseScript.VideoGroup group, int screenIndex) {
    if (group == null || group.screens == null) {
      return null;
    }

    for (CourseScript.VideoGroupScreen screen : group.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  private static CourseScript.PodScreen findPodScreen(CourseScript.Pod pod, int screenIndex) {
    if (pod == null || pod.screens == null) {
      return null;
    }

    for (CourseScript.PodScreen screen : pod.screens) {
      if (screen != null && screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  private static ProgressPodScreen materializeProgressPodScreen(CourseScript course, CourseScript.Pod pod) {
    CourseScript.VideoGroup group = findVideoGroup(course, pod == null ? null : pod.videoGroupId);
    if (group == null) {
      return null;
    }
    if (group.screenCount <= 1) {
      return materializePodScreen(pod, group, 1);
    }

    ProgressPodScreen bestScreen = null;
    int bestWorkSegmentCount = -1;
    for (int screenIndex = 1; screenIndex <= Math.max(group.screenCount, 3); screenIndex += 1) {
      if (findPodScreen(pod, screenIndex) == null || findVideoGroupScreen(group, screenIndex) == null) {
        continue;
      }
      ProgressPodScreen candidate = materializePodScreen(pod, group, screenIndex);
      int workSegmentCount = countHorizontalProgressWorkSegments(pod, candidate);
      if (candidate != null && workSegmentCount > bestWorkSegmentCount) {
        bestScreen = candidate;
        bestWorkSegmentCount = workSegmentCount;
      }
    }
    return bestScreen;
  }

  private static ProgressPodScreen materializePodScreen(
      CourseScript.Pod pod, CourseScript.VideoGroup group, int displayScreenIndex) {
    if (pod == null || group == null || group.screens == null || group.screens.isEmpty()) {
      return null;
    }

    if (group.screenCount <= 1) {
      CourseScript.PodScreen rule =
          pod.screens != null && !pod.screens.isEmpty() ? pod.screens.get(0) : null;
      CourseScript.VideoGroupScreen sourceScreen = group.screens.get(0);
      if (rule == null || sourceScreen == null) {
        return null;
      }
      return new ProgressPodScreen(rule, sourceScreen, true);
    }

    CourseScript.PodScreen rule = findPodScreen(pod, displayScreenIndex);
    CourseScript.VideoGroupScreen sourceScreen = findVideoGroupScreen(group, displayScreenIndex);
    if (rule == null || sourceScreen == null) {
      return null;
    }
    return new ProgressPodScreen(rule, sourceScreen, false);
  }

  private static int countHorizontalProgressWorkSegments(
      CourseScript.Pod pod, ProgressPodScreen effectiveScreen) {
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

  private static List<CourseScript.PodSetConfig> getEffectiveSetConfigs(CourseScript.PodScreen rule) {
    List<CourseScript.PodSetConfig> setConfigs = new ArrayList<>();
    if (rule != null && rule.setConfigs != null && !rule.setConfigs.isEmpty()) {
      setConfigs.addAll(rule.setConfigs);
      return setConfigs;
    }

    setConfigs.add(new CourseScript.PodSetConfig(0, 0));
    return setConfigs;
  }

  private static boolean isProgressMarkerPod(CourseScript.Pod pod) {
    return pod != null && ("HYDRATE".equals(pod.ending) || "MOVE_ZONE".equals(pod.ending));
  }

  private static boolean isSwitchPod(CourseScript.Pod pod) {
    return pod != null && "SWITCH".equals(pod.stationFlow);
  }

  private static List<CourseScript.VideoCard> filterPlayableCards(List<CourseScript.VideoCard> sourceCards) {
    List<CourseScript.VideoCard> cards = new ArrayList<>();
    if (sourceCards == null) {
      return cards;
    }

    for (CourseScript.VideoCard card : sourceCards) {
      if (card == null) {
        continue;
      }
      if (hasText(card.actionId) || hasText(card.actionName) || hasText(card.mediaUrl)) {
        cards.add(card);
      }
    }
    return cards;
  }

  private static boolean hasText(String value) {
    return value != null && !value.trim().isEmpty();
  }

  public static final class WorkSegment {
    public final int startOffsetSeconds;
    public final int durationSeconds;
    public final boolean markerAfter;

    public WorkSegment(int startOffsetSeconds, int durationSeconds, boolean markerAfter) {
      this.startOffsetSeconds = Math.max(startOffsetSeconds, 0);
      this.durationSeconds = Math.max(durationSeconds, 0);
      this.markerAfter = markerAfter;
    }
  }

  public static final class WorkTiming {
    public final int realStartSeconds;
    public final int workStartSeconds;
    public final int durationSeconds;
    public boolean markerAfter;

    WorkTiming(int realStartSeconds, int workStartSeconds, int durationSeconds) {
      this.realStartSeconds = Math.max(realStartSeconds, 0);
      this.workStartSeconds = Math.max(workStartSeconds, 0);
      this.durationSeconds = Math.max(durationSeconds, 0);
      this.markerAfter = false;
    }
  }

  private static final class ProgressPodScreen {
    final CourseScript.PodScreen rule;
    final List<CourseScript.VideoCard> videoCards;
    final boolean waterfallLayout;

    ProgressPodScreen(CourseScript.PodScreen rule, CourseScript.VideoGroupScreen sourceScreen, boolean waterfallLayout) {
      this.rule = rule;
      this.videoCards = filterPlayableCards(sourceScreen == null ? null : sourceScreen.videoCards);
      this.waterfallLayout = waterfallLayout;
    }
  }
}
