import type { RefObject } from "react";
import { useI18n } from "../../providers/I18nProvider";

interface PairPanelProps {
  busyDeviceId: string;
  fileInputRef: RefObject<HTMLInputElement>;
  pairDeviceId: string;
  pairRawInput: string;
  pairScreenNumber: string;
  pairToken: string;
  scannerError: string;
  onBind: () => void;
  onChooseScreen: () => void;
  onOpenScanner: () => void;
  onOpenPhotoPicker: () => void;
  onPhotoSelected: (file: File | null) => void;
  onRawInputChange: (value: string) => void;
}

export function PairPanel(props: PairPanelProps) {
  const { t } = useI18n();
  return (
    <div className="coach-screen-section">
      <div className="coach-screen-section-head">
        <div>
          <p>Pair TV</p>
          <strong>{t("扫码绑定屏幕")}</strong>
        </div>
      </div>
      <div className="coach-pair-panel">
        <div className="coach-pair-fields">
          <label className="coach-screen-select">
            <span>{t("配对字符串")}</span>
            <textarea value={props.pairRawInput} onChange={(event) => props.onRawInputChange(event.target.value)} placeholder={t("扫码后会自动填入，也可以手动粘贴 infini-tv://pair?... 这段字符串")} rows={4} />
          </label>
          <div className="coach-pair-inline">
            <label className="coach-screen-select">
              <span>{t("设备 ID")}</span>
              <input value={props.pairDeviceId} readOnly placeholder={t("等待扫码识别")} />
            </label>
            <label className="coach-screen-select">
              <span>{t("屏幕编号")}</span>
              <button type="button" className="coach-screen-choice-trigger" onClick={props.onChooseScreen}>
                <strong>{t("屏幕")} {props.pairScreenNumber}</strong>
                <span>{t("点击更换")}</span>
              </button>
            </label>
          </div>
          <div className="coach-pair-actions">
            <button type="button" className="ghost-button" onClick={props.onOpenScanner}>{t("打开扫码")}</button>
            <button type="button" className="ghost-button" onClick={props.onOpenPhotoPicker}>{t("上传二维码照片")}</button>
            <button type="button" className="primary-button" disabled={!props.pairDeviceId || !props.pairToken || props.busyDeviceId === props.pairDeviceId} onClick={props.onBind}>{t("绑定到屏幕")}</button>
          </div>
          <input ref={props.fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(event) => props.onPhotoSelected(event.target.files?.[0] || null)} />
          <div className="coach-pair-meta">
            <span>{t("配对码")}</span>
            <strong>{props.pairToken || "--"}</strong>
          </div>
          {props.scannerError ? <p className="coach-pair-error">{t(props.scannerError)}</p> : null}
        </div>
      </div>
    </div>
  );
}
