import type { ReactNode, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useRef } from "react";
import { useI18n } from "../providers/I18nProvider.tsx";

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
  const { t } = useI18n();
  const lastActionAtRef = useRef(0);

  function runDialogAction(event: SyntheticEvent, action: () => void) {
    event.preventDefault();
    event.stopPropagation();

    // Safari can swallow or duplicate clicks when native video layers are inside a fixed dialog.
    // Handling pointer/touch/click together keeps close/confirm reliable without double-firing.
    const now = Date.now();
    if (now - lastActionAtRef.current < 250) {
      return;
    }
    lastActionAtRef.current = now;
    action();
  }

  const dialog = (
    <div className="dialog-mask" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-card" style={{ width }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h3>{t(title)}</h3>
          <button
            type="button"
            className="dialog-close"
            onPointerUp={(event) => runDialogAction(event, onClose)}
            onTouchEnd={(event) => runDialogAction(event, onClose)}
            onClick={(event) => runDialogAction(event, onClose)}
          >
            ×
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-foot">
          <button
            type="button"
            className="ghost-button"
            onPointerUp={(event) => runDialogAction(event, onClose)}
            onTouchEnd={(event) => runDialogAction(event, onClose)}
            onClick={(event) => runDialogAction(event, onClose)}
          >
            {t("取消")}
          </button>
          <button
            type="button"
            className="primary-button"
            onPointerUp={(event) => {
              if (!confirmDisabled) {
                runDialogAction(event, onConfirm);
              }
            }}
            onTouchEnd={(event) => {
              if (!confirmDisabled) {
                runDialogAction(event, onConfirm);
              }
            }}
            onClick={(event) => {
              if (!confirmDisabled) {
                runDialogAction(event, onConfirm);
              }
            }}
            disabled={confirmDisabled}
          >
            {t(confirmText)}
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
