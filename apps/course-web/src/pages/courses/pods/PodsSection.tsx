import type { CourseScript, Pod, PodEnding, PodScreen, VideoGroup } from "../../../models/course/types.ts";
import { createVideoGroup } from "../../../models/course/factories.ts";
import { normalizePodSetConfigsForLayout } from "../../../models/course/podSetConfigs.ts";
import type { PodEndingOption } from "../../../viewmodels/courses/podEndings.ts";
import { uid } from "../../../utils/uid.ts";
import PodCard from "./PodCard.tsx";

function clonePodScreenForNewPod(source: PodScreen, targetScreen: PodScreen, targetGroup: VideoGroup): PodScreen {
  const linkedScreen = targetGroup.screens.find((screen) => screen.screenIndex === targetScreen.screenIndex) || null;
  const isSingleScreenRule = targetGroup.screenCount === 1 || linkedScreen?.layout === "WATERFALL";
  const clonedSetConfigs = source.setConfigs.map((setConfig) => ({
    ...setConfig,
    id: uid("pod-set")
  }));

  return {
    ...targetScreen,
    loopCount: source.loopCount,
    stationRestSeconds: source.stationRestSeconds,
    setConfigs: normalizePodSetConfigsForLayout(clonedSetConfigs, isSingleScreenRule, 1),
    isCustomized: source.isCustomized
  };
}

function createCopiedPodFromPrevious(previousPod: Pod, basePod: Pod, targetGroup: VideoGroup): Pod {
  const sourceIsSingleScreenRule = previousPod.screens.length === 1;
  const canUseSwitchFlow = targetGroup.screenCount === 3;

  return {
    ...basePod,
    videoGroupId: previousPod.videoGroupId || basePod.videoGroupId,
    stationFlow: canUseSwitchFlow ? previousPod.stationFlow : "NORMAL",
    ending: previousPod.ending === "FINISH" ? "HYDRATE" : previousPod.ending,
    endingSeconds: previousPod.endingSeconds,
    screens: basePod.screens.map((targetScreen) => {
      const sourceScreen = sourceIsSingleScreenRule
        ? previousPod.screens[0]
        : previousPod.screens.find((screen) => screen.screenIndex === targetScreen.screenIndex) || previousPod.screens[0];

      return sourceScreen ? clonePodScreenForNewPod(sourceScreen, targetScreen, targetGroup) : targetScreen;
    })
  };
}

export default function PodsSection({
  script,
  videoGroupMap,
  podEndingOptions,
  createPodName,
  createPod,
  syncPodWithVideoGroup,
  rebalancePodEndings,
  getPodScreenTotal,
  formatPodTimingMismatch,
  formatRestStrategy,
  formatSecondsStrategy,
  onUpdateScript,
  onNotice,
  onOpenPodRuleDialog,
  onOpenPodCopyDialog,
  onOpenPodConfigCopyDialog
}: {
  script: CourseScript;
  videoGroupMap: Map<string, VideoGroup>;
  podEndingOptions: PodEndingOption[];
  createPodName: (index: number) => string;
  createPod: (group: VideoGroup) => Pod;
  syncPodWithVideoGroup: (pod: Pod, group: VideoGroup | null | undefined) => Pod;
  rebalancePodEndings: (pods: Pod[]) => Pod[];
  getPodScreenTotal: (pod: Pod, screen: PodScreen, linkedScreen: VideoGroup["screens"][number] | null) => number;
  formatPodTimingMismatch: (pod: Pod, group: VideoGroup | null) => string;
  formatRestStrategy: (screen: PodScreen, isSingleScreen?: boolean) => string;
  formatSecondsStrategy: (values: number[]) => string;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onOpenPodRuleDialog: (pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) => void;
  onOpenPodCopyDialog: (pod: Pod, screen: PodScreen, screenLabel: string) => void;
  onOpenPodConfigCopyDialog: (pod: Pod, podLabel: string) => void;
}) {
  const addPodButton = (
    <button
      type="button"
      className="ghost-button"
      onClick={() =>
        onUpdateScript((current) => {
          const previousPod = current.training.pods[current.training.pods.length - 1] || null;
          const targetGroup = previousPod
            ? current.training.videoGroups.find((group) => group.id === previousPod.videoGroupId) ||
              current.training.videoGroups[0] ||
              createVideoGroup(3)
            : current.training.videoGroups[0] || createVideoGroup(3);
          const basePod = {
            ...createPod(targetGroup),
            name: createPodName(current.training.pods.length)
          };
          const nextPod = previousPod ? createCopiedPodFromPrevious(previousPod, basePod, targetGroup) : basePod;

          return {
            ...current,
            training: {
              ...current.training,
              pods: rebalancePodEndings([...current.training.pods, nextPod])
            }
          };
        })
      }
    >
      + 添加 Pod
    </button>
  );

  return (
    <div className="section-card">
      <div className="section-card-head">
        <div>
          <h3>正式训练 · Pod 流程</h3>
          <p className="section-copy">
            Pod 不再逐节点编辑。单屏瀑布流按循环次数、工作时间和动作间休息生成；三屏站点模式按循环次数、组数、每组 work /
            rest 和换站休息生成。同动作组间休息不提示，换动作时 TV 提示 move station。
          </p>
        </div>
      </div>

      <div className="module-list">
        {script.training.pods.map((pod, podIndex) => {
          const linkedGroup = videoGroupMap.get(pod.videoGroupId) || script.training.videoGroups[0] || null;
          return (
            <PodCard
              key={pod.id}
              script={script}
              pod={pod}
              podIndex={podIndex}
              linkedGroup={linkedGroup}
              podEndingOptions={podEndingOptions}
              createPodName={createPodName}
              syncPodWithVideoGroup={syncPodWithVideoGroup}
              rebalancePodEndings={rebalancePodEndings}
              getPodScreenTotal={getPodScreenTotal}
              formatPodTimingMismatch={formatPodTimingMismatch}
              formatRestStrategy={formatRestStrategy}
              formatSecondsStrategy={formatSecondsStrategy}
              onUpdateScript={onUpdateScript}
              onNotice={onNotice}
              onOpenPodRuleDialog={onOpenPodRuleDialog}
              onOpenPodCopyDialog={onOpenPodCopyDialog}
              onOpenPodConfigCopyDialog={onOpenPodConfigCopyDialog}
            />
          );
        })}
      </div>

      <div className="pod-add-footer">{addPodButton}</div>
    </div>
  );
}
