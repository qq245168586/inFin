import PodConfigCopyDialog from "./dialogs/PodConfigCopyDialog.tsx";
import PodCopyDialog from "./dialogs/PodCopyDialog.tsx";
import PodRuleDialog from "./dialogs/PodRuleDialog.tsx";
import TemplateUseDialog from "./dialogs/TemplateUseDialog.tsx";
import type { PodCopyOption } from "./dialogs/PodCopyDialog.tsx";
import type { PodConfigCopyOption } from "./dialogs/PodConfigCopyDialog.tsx";
import type { CourseDraft } from "../../viewmodels/courses/types.ts";
import type {
  PodConfigCopyDialogState,
  PodCopyDialogState,
  PodRuleDialogState
} from "../../viewmodels/courses/podDialogs.ts";
import { podHasCustomizedRules, resizePodRuleSetDrafts } from "../../viewmodels/courses/podDialogs.ts";
import type { TemplateUseDialogState } from "../../viewmodels/courses/templateUseDialog.ts";
import { formatTemplateSummary, getTemplateKindLabel, type TemplateCollections, type TemplateRecord } from "../../models/templates.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";

export default function CoursesOverlays({
  courseEditor,
  templateCollections,
  templateUseDialog,
  onTemplateUseDialogChange,
  onCloseTemplateUseDialog,
  onConfirmTemplateUseDialog,
  podRuleDialog,
  onClosePodRuleDialog,
  onConfirmPodRuleDialog,
  onPodRuleDialogChange,
  podCopyDialog,
  onClosePodCopyDialog,
  onConfirmPodCopyDialog,
  onPodCopyDialogChange,
  podConfigCopyDialog,
  onClosePodConfigCopyDialog,
  onConfirmPodConfigCopyDialog,
  onPodConfigCopyDialogChange,
  createPodName,
  formatSecondsStrategy
}: {
  courseEditor: CourseDraft | null;
  templateCollections: TemplateCollections;
  templateUseDialog: TemplateUseDialogState | null;
  onTemplateUseDialogChange: (updater: (current: TemplateUseDialogState) => TemplateUseDialogState) => void;
  onCloseTemplateUseDialog: () => void;
  onConfirmTemplateUseDialog: () => void;
  podRuleDialog: PodRuleDialogState | null;
  onClosePodRuleDialog: () => void;
  onConfirmPodRuleDialog: () => void;
  onPodRuleDialogChange: (updater: (current: PodRuleDialogState) => PodRuleDialogState) => void;
  podCopyDialog: PodCopyDialogState | null;
  onClosePodCopyDialog: () => void;
  onConfirmPodCopyDialog: () => void;
  onPodCopyDialogChange: (updater: (current: PodCopyDialogState) => PodCopyDialogState) => void;
  podConfigCopyDialog: PodConfigCopyDialogState | null;
  onClosePodConfigCopyDialog: () => void;
  onConfirmPodConfigCopyDialog: () => void;
  onPodConfigCopyDialogChange: (updater: (current: PodConfigCopyDialogState) => PodConfigCopyDialogState) => void;
  createPodName: (index: number) => string;
  formatSecondsStrategy: (values: number[]) => string;
}) {
  const templateUseOptions: TemplateRecord[] = templateUseDialog ? templateCollections[templateUseDialog.target] || [] : [];

  const podCopyTargetPod =
    podCopyDialog && courseEditor
      ? courseEditor.script.training.pods.find((pod) => pod.id === podCopyDialog.podId) || null
      : null;

  const podCopyOptions: PodCopyOption[] =
    podCopyTargetPod && podCopyDialog
      ? podCopyTargetPod.screens
          .filter((screen) => screen.id !== podCopyDialog.targetScreenId)
          .map((screen) => ({
            ...screen,
            label: `屏幕 ${screen.screenIndex}`,
            disabled: !screen.isCustomized
          }))
      : [];

  const podConfigCopyTargetPod =
    podConfigCopyDialog && courseEditor
      ? courseEditor.script.training.pods.find((pod) => pod.id === podConfigCopyDialog.targetPodId) || null
      : null;

  const podConfigCopyOptions: PodConfigCopyOption[] =
    podConfigCopyDialog && courseEditor
      ? courseEditor.script.training.pods
          .filter((pod) => pod.id !== podConfigCopyDialog.targetPodId)
          .map((pod, index) => {
            const linkedGroup = courseEditor.script.training.videoGroups.find((group) => group.id === pod.videoGroupId) || null;
            const isSingleScreenRule = linkedGroup?.screenCount === 1;
            const firstScreen = pod.screens[0] || null;
            const effectiveSetConfigs = firstScreen ? normalizePodSetConfigsForLayout(firstScreen.setConfigs, isSingleScreenRule, 1) : [];
            const copiedWorkStrategy = effectiveSetConfigs.length
              ? formatSecondsStrategy(effectiveSetConfigs.map((setConfig) => setConfig.workSeconds))
              : "--";
            const label = pod.name || createPodName(index);
            const customized = podHasCustomizedRules(pod);
            return {
              id: pod.id,
              label,
              disabled: !customized,
              hint: customized ? `已编辑 · ${copiedWorkStrategy}` : "未编辑，暂不可复制"
            };
          })
      : [];

  return (
    <>
      {templateUseDialog ? (
        <TemplateUseDialog
          state={templateUseDialog}
          options={templateUseOptions}
          title={
            templateUseDialog.target === "training"
              ? `为${templateUseDialog.targetVideoGroupName || "当前视频组"}使用正式组模版`
              : `使用${getTemplateKindLabel(templateUseDialog.target)}`
          }
          confirmText={templateUseDialog.target === "training" ? "覆盖当前视频组" : "使用模版"}
          confirmDisabled={!templateUseDialog.selectedTemplateId}
          formatTemplateSummary={formatTemplateSummary}
          onSelectTemplateId={(id) => onTemplateUseDialogChange((current) => ({ ...current, selectedTemplateId: id }))}
          onClose={onCloseTemplateUseDialog}
          onConfirm={onConfirmTemplateUseDialog}
        />
      ) : null}

      {podRuleDialog ? (
        <PodRuleDialog
          state={podRuleDialog}
          onClose={onClosePodRuleDialog}
          onConfirm={onConfirmPodRuleDialog}
          onStateChange={onPodRuleDialogChange}
          resizeSetDrafts={resizePodRuleSetDrafts}
        />
      ) : null}

      {podCopyDialog ? (
        <PodCopyDialog
          state={podCopyDialog}
          options={podCopyOptions}
          formatSecondsStrategy={formatSecondsStrategy}
          onClose={onClosePodCopyDialog}
          onConfirm={onConfirmPodCopyDialog}
          onStateChange={onPodCopyDialogChange}
        />
      ) : null}

      {podConfigCopyDialog ? (
        <PodConfigCopyDialog
          state={podConfigCopyDialog}
          options={podConfigCopyOptions}
          onClose={onClosePodConfigCopyDialog}
          onConfirm={onConfirmPodConfigCopyDialog}
          onStateChange={onPodConfigCopyDialogChange}
        />
      ) : null}
    </>
  );
}
