import type { RefObject } from "react";
import { useI18n } from "../../providers/I18nProvider";

export function ScannerSheet({ open, videoRef, onClose }: { open: boolean; videoRef: RefObject<HTMLVideoElement>; onClose: () => void }) {
  const { t } = useI18n();
  if (!open) {
    return null;
  }
  return (
    <div className="coach-scanner-sheet">
      <div className="coach-scanner-card">
        <div className="coach-scanner-head">
          <div>
            <p>QR Scanner</p>
            <strong>{t("对准 TV 上的二维码")}</strong>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            {t("关闭")}
          </button>
        </div>
        <video ref={videoRef} className="coach-scanner-video" muted playsInline autoPlay />
      </div>
    </div>
  );
}
