import type { CourseScript, Pod, PodEnding, PodScreen, VideoGroup } from "../../../models/course/types.ts";
import { createVideoGroup } from "../../../models/course/factories.ts";
import type { PodEndingOption } from "../../../viewmodels/courses/podEndings.ts";
import PodCard from "./PodCard.tsx";

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
  getPodScreenTotal: (screen: PodScreen, linkedScreen: VideoGroup["screens"][number] | null) => number;
  formatPodTimingMismatch: (pod: Pod, group: VideoGroup | null) => string;
  formatRestStrategy: (screen: PodScreen, isSingleScreen?: boolean) => string;
  formatSecondsStrategy: (values: number[]) => string;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onOpenPodRuleDialog: (pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) => void;
  onOpenPodCopyDialog: (pod: Pod, screen: PodScreen, screenLabel: string) => void;
  onOpenPodConfigCopyDialog: (pod: Pod, podLabel: string) => void;
}) {
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
        <button
          type="button"
          className="ghost-button"
          onClick={() =>
            onUpdateScript((current) => {
              const targetGroup = current.training.videoGroups[0] || createVideoGroup(3);
              const nextPod = {
                ...createPod(targetGroup),
                name: createPodName(current.training.pods.length)
              };

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
    </div>
  );
}
