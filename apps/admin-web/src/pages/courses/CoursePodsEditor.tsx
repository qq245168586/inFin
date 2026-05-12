import type { CourseScript, Pod, PodScreen, VideoGroup } from "../../models/course/types.ts";
import type { PodEndingOption } from "../../viewmodels/courses/podEndings.ts";
import PodsSection from "./pods/PodsSection.tsx";

export type { PodEndingOption } from "../../viewmodels/courses/podEndings.ts";

export default function CoursePodsEditor({
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
    <PodsSection
      script={script}
      videoGroupMap={videoGroupMap}
      podEndingOptions={podEndingOptions}
      createPodName={createPodName}
      createPod={createPod}
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
}
