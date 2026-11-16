import type { CourseScript, Pod, PodScreen, VideoGroup, VideoGroupScreenCount } from "../../models/course/types.ts";
import { createPodSetConfig, createVideoGroup } from "../../models/course/factories.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { readNonNegativeNumber } from "../../utils/number.ts";
import { uid } from "../../utils/uid.ts";
import { hasCustomPodRules } from "./podDialogs.ts";

export function createPodName(index: number): string {
  return `Pod ${index + 1}`;
}

export function rebalancePodEndings(pods: Pod[]): Pod[] {
  return pods.map((pod, index) => {
    const isLastPod = index === pods.length - 1;
    if (isLastPod) {
      return {
        ...pod,
        ending: "FINISH"
      };
    }

    return {
      ...pod,
      ending: pod.ending === "FINISH" ? "HYDRATE" : pod.ending
    };
  });
}

export function createPodScreen(
  screenIndex: number,
  screenCount: VideoGroupScreenCount,
  existing?: Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }
): PodScreen {
  const isSingleScreen = screenCount === 1;
  const legacyFirstSegment = Array.isArray(existing?.segments) ? existing?.segments[0] : null;
  const setConfigs =
    Array.isArray(existing?.setConfigs) && existing.setConfigs.length
      ? existing.setConfigs
      : [
          createPodSetConfig({
            workSeconds: readNonNegativeNumber(legacyFirstSegment?.workSeconds, 0),
            restSeconds: 0
          })
        ];

  return {
    id: existing?.id || uid("pod-screen"),
    screenIndex,
    loopCount: Math.max(Number(existing?.loopCount) || (Array.isArray(existing?.segments) ? existing.segments.length : 1), 1),
    stationRestSeconds: readNonNegativeNumber(
      existing?.stationRestSeconds,
      readNonNegativeNumber(legacyFirstSegment?.restSeconds, 0)
    ),
    setConfigs: normalizePodSetConfigsForLayout(setConfigs, isSingleScreen, 1),
    isCustomized: existing ? hasCustomPodRules(existing) : false
  };
}

export function createPodScreensFromGroup(
  group: VideoGroup,
  existingScreens: Array<Partial<PodScreen> & { segments?: Array<{ workSeconds?: number; restSeconds?: number }> }> = []
): PodScreen[] {
  return group.screens.map((screen) => {
    const existing = existingScreens.find((item) => item.screenIndex === screen.screenIndex);
    return createPodScreen(screen.screenIndex, group.screenCount, existing);
  });
}

export function createPod(group?: VideoGroup): Pod {
  const resolvedGroup = group || createVideoGroup(3);
  return {
    id: uid("pod"),
    name: `Pod ${Math.floor(Math.random() * 90) + 10}`,
    videoGroupId: resolvedGroup.id,
    stationFlow: "NORMAL",
    ending: "HYDRATE",
    endingSeconds: 0,
    screens: createPodScreensFromGroup(resolvedGroup)
  };
}

export function syncPodWithVideoGroup(pod: Pod, videoGroup: VideoGroup | undefined): Pod {
  if (!videoGroup) {
    return pod;
  }

  return {
    ...pod,
    screens: createPodScreensFromGroup(videoGroup, pod.screens)
  };
}

export function syncPodsForVideoGroup(script: CourseScript, nextGroup: VideoGroup): CourseScript {
  return {
    ...script,
    training: {
      ...script.training,
      videoGroups: script.training.videoGroups.map((group) => (group.id === nextGroup.id ? nextGroup : group)),
      pods: script.training.pods.map((pod) => (pod.videoGroupId === nextGroup.id ? syncPodWithVideoGroup(pod, nextGroup) : pod))
    }
  };
}

export function removeVideoGroup(script: CourseScript, groupId: string): CourseScript {
  if (script.training.videoGroups.length <= 1) {
    return script;
  }

  const remainingGroups = script.training.videoGroups.filter((group) => group.id !== groupId);
  const fallbackGroup = remainingGroups[0];
  if (!fallbackGroup) {
    return script;
  }

  return {
    ...script,
    training: {
      ...script.training,
      videoGroups: remainingGroups,
      pods: rebalancePodEndings(
        script.training.pods.map((pod) => {
          if (pod.videoGroupId !== groupId) {
            return pod;
          }

          return syncPodWithVideoGroup(
            {
              ...pod,
              videoGroupId: fallbackGroup.id
            },
            fallbackGroup
          );
        })
      )
    }
  };
}
