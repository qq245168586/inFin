import Dialog from "../../../components/Dialog.tsx";
import EmptyBlock from "../../../components/EmptyBlock.tsx";
import type { TemplateKind, TemplateRecord } from "../../../models/templates.ts";

export interface TemplateUseDialogStateValue {
  target: TemplateKind;
  selectedTemplateId: string;
  targetVideoGroupName?: string;
}

export default function TemplateUseDialog({
  state,
  options,
  title,
  confirmText,
  confirmDisabled,
  formatTemplateSummary,
  onSelectTemplateId,
  onClose,
  onConfirm
}: {
  state: TemplateUseDialogStateValue;
  options: TemplateRecord[];
  title: string;
  confirmText: string;
  confirmDisabled: boolean;
  formatTemplateSummary: (template: TemplateRecord) => string;
  onSelectTemplateId: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      title={title}
      width={720}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText={confirmText}
      confirmDisabled={confirmDisabled}
    >
      <div className="dialog-form">
        {options.length ? (
          <div className="copy-screen-options">
            {options.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`copy-screen-option ${state.selectedTemplateId === String(template.id) ? "is-selected" : ""}`}
                onClick={() => onSelectTemplateId(String(template.id))}
              >
                <strong>{template.name}</strong>
                <span>{formatTemplateSummary(template)}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyBlock title="还没有可用模板" copy="先去课程模板页创建好模板，再回来一键套用。" />
        )}
      </div>
    </Dialog>
  );
}
