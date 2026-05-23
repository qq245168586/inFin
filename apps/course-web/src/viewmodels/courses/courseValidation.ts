import type { CourseDraft } from "./types.ts";
import type { CourseSectionKey } from "../../models/course/types.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { stationCode } from "../../utils/station.ts";
import { getPodScreenTotalForFlow } from "./podTiming.ts";
import { createTrainingSnapshot } from "./courseEditorFactories.ts";

export function getCourseDraftIssues(draft: CourseDraft): string[] {
  const issues: string[] = [];
  const script = draft.script;
  const needsTransitionDuration = script.training.pods.some((pod) => pod.ending !== "FINISH");

  if (!script.metadata.name.trim()) {
    issues.push("课程名称不能为空。");
  }
  if (!script.metadata.creator.trim()) {
    issues.push("课程设计者不能为空。");
  }
  if (!script.metadata.version.trim()) {
    issues.push("课程版本不能为空。");
  }
  if (needsTransitionDuration && Number(script.metadata.defaultHydrateSeconds) <= 0) {
    issues.push("当前课程包含补水或换区 Pod，请填写补水 / 换区时长。");
  }
  if (Number(script.metadata.trainingPanel.restSeconds) < 0) {
    issues.push("TV 横屏的 rest 时间不能小于 0。");
  }

  (["warmup", "cooldown"] as CourseSectionKey[]).forEach((sectionKey) => {
    const section = script.sections[sectionKey];
    const isOptionalSection = sectionKey === "cooldown";
    if (!section.items.length) {
      if (!isOptionalSection) {
        issues.push(`${section.title}至少需要一个动作。`);
      }
      return;
    }

    section.items.forEach((item, index) => {
      if (!item.actionId) {
        issues.push(`${section.title}第 ${index + 1} 个动作还没有选择动作。`);
      }
      if (Number(item.seconds) <= 0) {
        issues.push(`${section.title}第 ${index + 1} 个动作时长必须大于 0。`);
      }
    });
  });

  if (!script.training.videoGroups.length) {
    issues.push("正式训练至少需要一个视频组。");
  }

  if (
    draft.sourceCourseTemplate?.initialTrainingSnapshot &&
    createTrainingSnapshot(script) === draft.sourceCourseTemplate.initialTrainingSnapshot
  ) {
    issues.push("从整课模板创建的课程必须先修改正式训练内容。");
  }

  script.training.videoGroups.forEach((group) => {
    if (![1, 3].includes(group.screenCount)) {
      issues.push(`视频组 ${group.name || "未命名"} 只允许单屏或三屏。`);
    }

    group.screens.forEach((screen) => {
      if (group.screenCount !== 1) {
        const stationCodes = screen.videoCards.map((card) => stationCode(card.stationNumber));
        if (stationCodes.some((code) => !code)) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 站点标签不能为空。`);
        }
        if (new Set(stationCodes).size !== stationCodes.length) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 站点标签不能重复。`);
        }
      }
      if (!screen.videoCards.length) {
        issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 至少需要一个动作。`);
      }
      screen.videoCards.forEach((card, index) => {
        if (!card.actionId) {
          issues.push(`视频组 ${group.name || "未命名"} 的屏幕 ${screen.screenIndex} 第 ${index + 1} 个卡片未选择动作。`);
        }
      });
    });
  });

  if (!script.training.pods.length) {
    issues.push("正式训练至少需要一个 Pod。");
  }

  script.training.pods.forEach((pod, podIndex) => {
    const linkedGroup = script.training.videoGroups.find((group) => group.id === pod.videoGroupId);
    if (!linkedGroup) {
      issues.push(`Pod ${pod.name || podIndex + 1} 没有关联到有效的视频组。`);
      return;
    }

    if (pod.screens.length !== linkedGroup.screenCount) {
      issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕数量必须和视频组保持一致。`);
    }

    if (pod.stationFlow === "SWITCH") {
      if (linkedGroup.screenCount !== 3) {
        issues.push(`Pod ${pod.name || podIndex + 1} 使用 SWITCH 时必须绑定三屏视频组。`);
      }
      linkedGroup.screens.forEach((screen) => {
        if ((screen.videoCards.length || 0) % 2 !== 0) {
          issues.push(
            `Pod ${pod.name || podIndex + 1} 使用 SWITCH 时，视频组 ${linkedGroup.name || "未命名"} 的屏幕 ${screen.screenIndex} 需要偶数个视频。`
          );
        }
      });
    }

    const totals = pod.screens.map((screen) => {
      const linkedScreen = linkedGroup.screens.find((item) => item.screenIndex === screen.screenIndex) || null;
      return getPodScreenTotalForFlow(pod, screen, linkedScreen);
    });
    if (totals.some((total) => total !== totals[0])) {
      issues.push(`Pod ${pod.name || podIndex + 1} 的各屏总时长必须一致。`);
    }

    pod.screens.forEach((screen) => {
      const linkedScreen = linkedGroup.screens.find((item) => item.screenIndex === screen.screenIndex);
      const isSingleScreen = linkedGroup.screenCount === 1;
      const effectiveSetConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreen, 1);
      if (!effectiveSetConfigs.length) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 至少需要 1 组训练。`);
      }
      if (Number(screen.loopCount) <= 0) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 循环次数必须大于 0。`);
      }
      if (Number(screen.stationRestSeconds) < 0) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 换站休息不能小于 0。`);
      }
      effectiveSetConfigs.forEach((setConfig, setIndex) => {
        if (Number(setConfig.workSeconds) <= 0) {
          issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组 work 时间必须大于 0。`);
        }
        if (setIndex < effectiveSetConfigs.length - 1 && Number(setConfig.restSeconds) < 0) {
          issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组间休息不能小于 0。`);
        }
      });
      if (!linkedScreen?.videoCards.length) {
        issues.push(`Pod ${pod.name || podIndex + 1} 的屏幕 ${screen.screenIndex} 绑定的视频组还没有动作。`);
      }
    });

    const isLastPod = podIndex === script.training.pods.length - 1;
    if (isLastPod && pod.ending !== "FINISH") {
      issues.push("最后一个 Pod 必须以课程结束收尾。");
    }
    if (!isLastPod && pod.ending === "FINISH") {
      issues.push("只有最后一个 Pod 可以结束课程。");
    }
  });

  return issues;
}
