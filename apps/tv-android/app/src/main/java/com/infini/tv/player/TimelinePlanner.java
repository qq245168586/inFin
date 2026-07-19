package com.infini.tv.player;

import com.infini.tv.model.CourseScript;
import com.infini.tv.model.PlaybackStep;
import com.infini.tv.util.SwitchPodSequence;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class TimelinePlanner {
  public List<PlaybackStep> build(CourseScript courseScript) {
    List<PlaybackStep> steps = new ArrayList<>();
    int courseOffsetSeconds = 0;

    for (CourseScript.WaterfallItem item : courseScript.warmup.items) {
      steps.add(
          new PlaybackStep(
              "WARMUP_WATERFALL",
              courseScript.warmup.title,
              courseOffsetSeconds,
              item.seconds,
              0,
              "",
              item.actionName,
              item.cue));
      courseOffsetSeconds += item.seconds;
    }

    for (CourseScript.Pod pod : courseScript.pods) {
      CourseScript.VideoGroup linkedGroup = findVideoGroup(courseScript, pod.videoGroupId);
      int podDurationSeconds = 0;

      for (EffectivePodScreen effectiveScreen : materializeScreens(pod, linkedGroup)) {
        int screenDurationSeconds =
            buildScreenSteps(steps, pod, effectiveScreen, courseOffsetSeconds);
        podDurationSeconds = Math.max(podDurationSeconds, screenDurationSeconds);
      }

      if ("HYDRATE".equals(pod.ending)) {
        int endingSeconds = pod.resolveEndingSeconds(courseScript.metadata.defaultHydrateSeconds);
        steps.add(
            new PlaybackStep(
                "POD_HYDRATE",
                pod.name + " / BREAK",
                courseOffsetSeconds + podDurationSeconds,
                endingSeconds,
                0,
                "",
                "",
                "BREAK"));
        courseOffsetSeconds += podDurationSeconds + endingSeconds;
      } else if ("MOVE_ZONE".equals(pod.ending)) {
        int endingSeconds = pod.resolveEndingSeconds(courseScript.metadata.defaultHydrateSeconds);
        steps.add(
            new PlaybackStep(
                "POD_MOVE_ZONE",
                pod.name + " / MOVE ZONE",
                courseOffsetSeconds + podDurationSeconds,
                endingSeconds,
                0,
                "",
                "",
                "MOVE_ZONE"));
        courseOffsetSeconds += podDurationSeconds + endingSeconds;
      } else {
        steps.add(
            new PlaybackStep(
                "POD_FINISH",
                pod.name + " / FINISH",
                courseOffsetSeconds + podDurationSeconds,
                0,
                0,
                "",
                "",
                "CONGRATULATE"));
        courseOffsetSeconds += podDurationSeconds;
      }
    }

    for (CourseScript.WaterfallItem item : courseScript.cooldown.items) {
      steps.add(
          new PlaybackStep(
              "COOLDOWN_WATERFALL",
              courseScript.cooldown.title,
              courseOffsetSeconds,
              item.seconds,
              0,
              "",
              item.actionName,
              item.cue));
      courseOffsetSeconds += item.seconds;
    }

    steps.sort(
        Comparator.comparingInt((PlaybackStep step) -> step.startOffsetSeconds)
            .thenComparingInt(step -> step.screenIndex));

    return steps;
  }

  private int buildScreenSteps(
      List<PlaybackStep> steps,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int courseOffsetSeconds) {
    if (isSwitchPod(pod) && effectiveScreen.videoCards.size() >= 2) {
      return buildSwitchScreenSteps(steps, pod, effectiveScreen, courseOffsetSeconds);
    }

    List<CourseScript.VideoCard> actionSequence =
        buildActionSequence(effectiveScreen.videoCards, effectiveScreen.rule.loopCount);
    int screenOffsetSeconds = 0;

    for (int actionIndex = 0; actionIndex < actionSequence.size(); actionIndex += 1) {
      CourseScript.VideoCard currentCard = actionSequence.get(actionIndex);
      CourseScript.VideoCard nextCard =
          actionIndex + 1 < actionSequence.size() ? actionSequence.get(actionIndex + 1) : null;

      for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
        steps.add(
            new PlaybackStep(
                "POD_WORK",
                pod.name + " / " + currentCard.actionName,
                courseOffsetSeconds + screenOffsetSeconds,
                setConfig.workSeconds,
                effectiveScreen.displayScreenIndex,
                currentCard.stationNumber,
                currentCard.actionName,
                ""));
        screenOffsetSeconds += setConfig.workSeconds;

        boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
        if (hasNextSet && setConfig.restSeconds > 0) {
          steps.add(
              new PlaybackStep(
                  "POD_REST",
                  pod.name + " / REST",
                  courseOffsetSeconds + screenOffsetSeconds,
                  setConfig.restSeconds,
                  effectiveScreen.displayScreenIndex,
                  currentCard.stationNumber,
                  currentCard.actionName,
                  ""));
          screenOffsetSeconds += setConfig.restSeconds;
        }
      }

      if (nextCard != null && effectiveScreen.rule.stationRestSeconds > 0) {
        boolean sameAction = safeEquals(currentCard.actionName, nextCard.actionName);
        steps.add(
            new PlaybackStep(
                "POD_REST",
                pod.name + " / REST",
                courseOffsetSeconds + screenOffsetSeconds,
                effectiveScreen.rule.stationRestSeconds,
                effectiveScreen.displayScreenIndex,
                nextCard.stationNumber,
                nextCard.actionName,
                sameAction ? "" : "MOVE_STATION"));
        screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
      }
    }

    return screenOffsetSeconds;
  }

  private int buildSwitchScreenSteps(
      List<PlaybackStep> steps,
      CourseScript.Pod pod,
      EffectivePodScreen effectiveScreen,
      int courseOffsetSeconds) {
    int screenOffsetSeconds = 0;
    int safeLoops = Math.max(effectiveScreen.rule.loopCount, 1);
    int pairCount = SwitchPodSequence.getPairCount(effectiveScreen.videoCards.size());
    if (pairCount <= 0) {
      return 0;
    }

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      int pairIndex = SwitchPodSequence.getPairIndexForRound(loopIndex, pairCount);
      CourseScript.VideoCard cardA = effectiveScreen.videoCards.get(pairIndex * 2);
      CourseScript.VideoCard cardB = effectiveScreen.videoCards.get(pairIndex * 2 + 1);

      for (int setIndex = 0; setIndex < effectiveScreen.rule.setConfigs.size(); setIndex += 1) {
        CourseScript.PodSetConfig setConfig = effectiveScreen.rule.setConfigs.get(setIndex);
        steps.add(
            new PlaybackStep(
                "POD_WORK",
                pod.name + " / SWITCH A / " + cardA.actionName,
                courseOffsetSeconds + screenOffsetSeconds,
                setConfig.workSeconds,
                effectiveScreen.displayScreenIndex,
                cardA.stationNumber,
                cardA.actionName,
                ""));
        screenOffsetSeconds += setConfig.workSeconds;

        if (effectiveScreen.rule.stationRestSeconds > 0) {
          steps.add(
              new PlaybackStep(
                  "POD_REST",
                  pod.name + " / SWITCH A TO B",
                  courseOffsetSeconds + screenOffsetSeconds,
                  effectiveScreen.rule.stationRestSeconds,
                  effectiveScreen.displayScreenIndex,
                  cardB.stationNumber,
                  cardB.actionName,
                  "SWITCH"));
          screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
        }

        steps.add(
            new PlaybackStep(
                "POD_WORK",
                pod.name + " / SWITCH B / " + cardB.actionName,
                courseOffsetSeconds + screenOffsetSeconds,
                setConfig.workSeconds,
                effectiveScreen.displayScreenIndex,
                cardB.stationNumber,
                cardB.actionName,
                ""));
        screenOffsetSeconds += setConfig.workSeconds;

        boolean hasNextSet = setIndex < effectiveScreen.rule.setConfigs.size() - 1;
        if (hasNextSet && setConfig.restSeconds > 0) {
          steps.add(
              new PlaybackStep(
                  "POD_REST",
                  pod.name + " / SWITCH",
                  courseOffsetSeconds + screenOffsetSeconds,
                  setConfig.restSeconds,
                  effectiveScreen.displayScreenIndex,
                  cardA.stationNumber,
                  cardA.actionName,
                  "SWITCH"));
          screenOffsetSeconds += setConfig.restSeconds;
        }
      }

      boolean hasNextPairRound = loopIndex < safeLoops - 1;
      if (hasNextPairRound && effectiveScreen.rule.stationRestSeconds > 0) {
        int nextPairIndex = SwitchPodSequence.getPairIndexForRound(loopIndex + 1, pairCount);
        CourseScript.VideoCard nextCardA = effectiveScreen.videoCards.get(nextPairIndex * 2);
        steps.add(
            new PlaybackStep(
                "POD_REST",
                pod.name + " / NEXT STATION",
                courseOffsetSeconds + screenOffsetSeconds,
                effectiveScreen.rule.stationRestSeconds,
                effectiveScreen.displayScreenIndex,
                nextCardA.stationNumber,
                nextCardA.actionName,
                "MOVE_STATION"));
        screenOffsetSeconds += effectiveScreen.rule.stationRestSeconds;
      }
    }

    return screenOffsetSeconds;
  }

  private List<CourseScript.VideoCard> buildActionSequence(
      List<CourseScript.VideoCard> videoCards,
      int loopCount) {
    List<CourseScript.VideoCard> sequence = new ArrayList<>();
    int safeLoops = Math.max(loopCount, 1);

    for (int loopIndex = 0; loopIndex < safeLoops; loopIndex += 1) {
      sequence.addAll(videoCards);
    }
    return sequence;
  }

  private List<EffectivePodScreen> materializeScreens(
      CourseScript.Pod pod,
      CourseScript.VideoGroup linkedGroup) {
    List<EffectivePodScreen> effectiveScreens = new ArrayList<>();
    if (linkedGroup == null) {
      return effectiveScreens;
    }

    if (linkedGroup.screenCount == 1) {
      CourseScript.PodScreen rule = pod.screens.get(0);
      CourseScript.VideoGroupScreen sourceScreen = linkedGroup.screens.get(0);
      for (int screenIndex = 1; screenIndex <= 3; screenIndex += 1) {
        effectiveScreens.add(new EffectivePodScreen(screenIndex, rule, sourceScreen.videoCards));
      }
      return effectiveScreens;
    }

    for (CourseScript.PodScreen podScreen : pod.screens) {
      CourseScript.VideoGroupScreen sourceScreen =
          findVideoGroupScreen(linkedGroup, podScreen.screenIndex);
      if (sourceScreen != null) {
        effectiveScreens.add(
            new EffectivePodScreen(podScreen.screenIndex, podScreen, sourceScreen.videoCards));
      }
    }

    return effectiveScreens;
  }

  private CourseScript.VideoGroup findVideoGroup(CourseScript courseScript, String videoGroupId) {
    for (CourseScript.VideoGroup group : courseScript.videoGroups) {
      if (group.id.equals(videoGroupId)) {
        return group;
      }
    }
    return null;
  }

  private CourseScript.VideoGroupScreen findVideoGroupScreen(
      CourseScript.VideoGroup group, int screenIndex) {
    if (group == null) {
      return null;
    }

    for (CourseScript.VideoGroupScreen screen : group.screens) {
      if (screen.screenIndex == screenIndex) {
        return screen;
      }
    }
    return null;
  }

  private boolean safeEquals(String left, String right) {
    if (left == null) {
      return right == null;
    }
    return left.equals(right);
  }

  private boolean isSwitchPod(CourseScript.Pod pod) {
    return pod != null && "SWITCH".equals(pod.stationFlow);
  }

  private static class EffectivePodScreen {
    final int displayScreenIndex;
    final CourseScript.PodScreen rule;
    final List<CourseScript.VideoCard> videoCards;

    EffectivePodScreen(
        int displayScreenIndex, CourseScript.PodScreen rule, List<CourseScript.VideoCard> videoCards) {
      this.displayScreenIndex = displayScreenIndex;
      this.rule = rule;
      this.videoCards = videoCards;
    }
  }
}
