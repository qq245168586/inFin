import Dialog from "./Dialog.tsx";
import { stripMediaSuffix } from "../utils/typeNames.ts";
import { useI18n } from "../providers/I18nProvider.tsx";

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
  const { t } = useI18n();
  return (
    <Dialog
      title={state.kind === "action" ? t("添加动作分类") : t("添加课程分类")}
      width={420}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText={t("保存")}
    >
      <div className="dialog-form">
        <label className="field">
          <span>{t("名称")}</span>
          <input
            value={state.value}
            onChange={(event) => onStateChange((current) => ({ ...current, value: stripMediaSuffix(event.target.value) }))}
            placeholder={t("请输入分类名称")}
          />
        </label>
      </div>
    </Dialog>
  );
}
