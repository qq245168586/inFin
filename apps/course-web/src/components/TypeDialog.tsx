import Dialog from "./Dialog.tsx";
import { stripMediaSuffix } from "../utils/typeNames.ts";

export interface TypeDialogStateValue {
  kind: "action" | "lesson";
  value: string;
}

export default function TypeDialog({
  state,
  onClose,
  onConfirm,
  onStateChange
}: {
  state: TypeDialogStateValue;
  onClose: () => void;
  onConfirm: () => void;
  onStateChange: (updater: (current: TypeDialogStateValue) => TypeDialogStateValue) => void;
}) {
  return (
    <Dialog
      title={state.kind === "action" ? "添加动作分类" : "添加课程分类"}
      width={420}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText="保存"
    >
      <div className="dialog-form">
        <label className="field">
          <span>名称</span>
          <input
            value={state.value}
            onChange={(event) => onStateChange((current) => ({ ...current, value: stripMediaSuffix(event.target.value) }))}
            placeholder="请输入分类名称"
          />
        </label>
      </div>
    </Dialog>
  );
}
