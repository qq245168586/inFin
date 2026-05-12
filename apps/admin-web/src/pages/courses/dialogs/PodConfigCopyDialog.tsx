import Dialog from "../../../components/Dialog.tsx";
import EmptyBlock from "../../../components/EmptyBlock.tsx";
import type { PodConfigCopyDialogState } from "../../../viewmodels/courses/podDialogs.ts";

export interface PodConfigCopyOption {
  id: string;
  label: string;
  disabled: boolean;
  hint: string;
}

export default function PodConfigCopyDialog({
  state,
  options,
  onClose,
  onConfirm,
  onStateChange
}: {
  state: PodConfigCopyDialogState;
  options: PodConfigCopyOption[];
  onClose: () => void;
  onConfirm: () => void;
  onStateChange: (updater: (current: PodConfigCopyDialogState) => PodConfigCopyDialogState) => void;
}) {
  return (
    <Dialog
      title={`${state.targetPodName} · 复制 Pod 配置`}
      width={640}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText="复制"
      confirmDisabled={!state.selectedSourcePodId}
    >
      <div className="dialog-form">
        {options.length ? (
          <div className="copy-screen-options">
            {options.map((pod) => (
              <button
                key={pod.id}
                type="button"
                className={`copy-screen-option ${state.selectedSourcePodId === pod.id ? "is-selected" : ""}`}
                disabled={pod.disabled}
                onClick={() => onStateChange((current) => ({ ...current, selectedSourcePodId: pod.id }))}
              >
                <strong>{pod.label}</strong>
                <span>{pod.hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyBlock title="没有可复制的 Pod" copy="先编辑一个 Pod 的规则，再到其他 Pod 点击“复制 Pod”。" />
        )}
      </div>
    </Dialog>
  );
}
