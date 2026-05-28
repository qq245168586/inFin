import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DialogProps {
  title: string;
  width?: number;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
}

export default function Dialog({
  title,
  width = 560,
  onClose,
  onConfirm,
  confirmText = "确认",
  confirmDisabled = false,
  children
}: DialogProps) {
  const dialog = (
    <div className="dialog-mask">
      <div className="dialog-card" style={{ width }}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button type="button" className="dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-foot">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
