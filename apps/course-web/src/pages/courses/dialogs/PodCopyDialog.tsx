import Dialog from "../../../components/Dialog.tsx";
import EmptyBlock from "../../../components/EmptyBlock.tsx";
import type { PodCopyDialogState } from "../../../viewmodels/courses/podDialogs.ts";

export interface PodCopyOption {
  id: string;
  label: string;
  disabled: boolean;
  setConfigs: Array<{ workSeconds: number }>;
}

export default function PodCopyDialog({
  state,
  options,
  formatSecondsStrategy,
  onClose,
  onConfirm,
  onStateChange
}: {
  state: PodCopyDialogState;
  options: PodCopyOption[];
  formatSecondsStrategy: (values: number[]) => string;
  onClose: () => void;
  onConfirm: () => void;
  onStateChange: (updater: (current: PodCopyDialogState) => PodCopyDialogState) => void;
}) {
  return (
    <Dialog
      title={`${state.podName} · ${state.targetScreenLabel} 复制规则`}
      width={620}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText="复制"
      confirmDisabled={!state.selectedSourceScreenId}
    >
      <div className="dialog-form">
        {options.length ? (
          <div className="copy-screen-options">
            {options.map((screen) => (
              <button
                key={screen.id}
                type="button"
                className={`copy-screen-option ${state.selectedSourceScreenId === screen.id ? "is-selected" : ""}`}
                disabled={screen.disabled}
                onClick={() => onStateChange((current) => ({ ...current, selectedSourceScreenId: screen.id }))}
              >
                <strong>{screen.label}</strong>
                <span>
                  {screen.disabled
                    ? "未编辑，暂不可复制"
                    : `已编辑 · ${formatSecondsStrategy(screen.setConfigs.map((setConfig) => setConfig.workSeconds))}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyBlock title="没有可复制的屏幕" copy="当前 Pod 还没有其他屏幕规则可供复制。" />
        )}
      </div>
    </Dialog>
  );
}
