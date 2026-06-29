import type { TvScreenItem } from "../../models/screens";
import { useI18n } from "../../providers/I18nProvider";
import { formatStorageBytes } from "../../utils/format";
import { formatDateTime } from "../../utils/time";
import { stateLabel, stateTone, updateInProgress, updateStateLabel, updateStateTone } from "../../utils/screens";

interface ScreenCardProps {
  busyDeviceId: string;
  expanded: boolean;
  screen: TvScreenItem;
  selectedPackageId: string;
  canClearCache: (screen: TvScreenItem) => boolean;
  onClearCache: (screen: TvScreenItem) => void;
  onInstallPackage: (screen: TvScreenItem) => void;
  onToggle: (screenNumber: number) => void;
  onUnbind: (screen: TvScreenItem) => void;
}

export function ScreenCard(props: ScreenCardProps) {
  const { t } = useI18n();
  const { screen } = props;
  return (
    <article className="coach-screen-card">
      <div className="coach-screen-head">
        <div>
          <p>{screen.orientation === "HORIZONTAL" ? t("横屏信息屏") : t("竖屏课程屏")}</p>
          <strong>{t("屏幕")} {screen.screenNumber}</strong>
        </div>
        <span className={`coach-screen-status ${screen.online ? "is-online" : "is-offline"}`}>{screen.online ? t("在线") : t("离线")}</span>
      </div>
      <div className="coach-screen-summary">
        <SummaryLine label={t("设备")} value={screen.deviceId || t("未绑定")} />
        <SummaryLine label={t("绑定状态")} value={screen.deviceId ? t("已绑定") : t("未绑定")} />
        <SummaryLine label={t("播放状态")} value={screen.deviceId ? t(stateLabel(screen.playbackState)) : "--"} />
      </div>
      <button type="button" className="ghost-button coach-screen-collapse" onClick={() => props.onToggle(screen.screenNumber)}>
        {props.expanded ? t("收起详情") : t("展开详情")}
      </button>
      {props.expanded ? <ScreenDetails {...props} /> : null}
    </article>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="coach-screen-summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScreenDetails(props: ScreenCardProps) {
  const { t } = useI18n();
  const { screen } = props;
  const isUpdating = updateInProgress(screen.updateState);
  return (
    <>
      <div className="coach-screen-body">
        <DetailLine label={t("设备 ID")} value={screen.deviceId || "--"} />
        <DetailLine label={t("最近心跳")} value={screen.deviceId ? formatDateTime(screen.lastSeenAt) : "--"} />
        <DetailTone label={t("课程状态")} tone={stateTone(screen.playbackState)} value={screen.deviceId ? t(stateLabel(screen.playbackState)) : "--"} />
        <DetailTone label={t("更新状态")} tone={updateStateTone(screen.updateState)} value={screen.deviceId ? t(updateStateLabel(screen.updateState)) : "--"} />
        <DetailLine label={t("安装版本")} value={screen.deviceId ? screen.appVersion || "--" : "--"} />
        <DetailLine label={t("缓存占用")} value={screen.deviceId ? formatStorageBytes(screen.cacheBytes) : "--"} />
        <DetailLine label={t("缓存文件数")} value={screen.deviceId ? String(screen.cacheFileCount || 0) : "--"} />
      </div>
      <div className="coach-screen-actions">
        <button type="button" className="ghost-button coach-screen-action-button" disabled={!screen.deviceId || props.busyDeviceId === screen.deviceId || !props.canClearCache(screen)} onClick={() => props.onClearCache(screen)}>{t("清除缓存")}</button>
        <button type="button" className="ghost-button coach-screen-action-button" disabled={!screen.deviceId || props.busyDeviceId === screen.deviceId || !props.selectedPackageId || !screen.online || isUpdating} onClick={() => props.onInstallPackage(screen)}>{isUpdating ? t("更新中") : t("更新 TV")}</button>
        <button type="button" className="ghost-button coach-screen-action-button danger" disabled={!screen.deviceId || props.busyDeviceId === screen.deviceId} onClick={() => props.onUnbind(screen)}>{t("解绑")}</button>
      </div>
    </>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="coach-screen-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailTone({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <div className="coach-screen-item">
      <span>{label}</span>
      <em className={`coach-screen-state is-${tone}`}>{value}</em>
    </div>
  );
}
