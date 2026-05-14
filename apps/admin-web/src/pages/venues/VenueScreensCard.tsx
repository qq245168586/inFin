export interface TvScreenSnapshot {
  screenNumber: number;
  deviceId: string;
  appVersion: string;
  online: boolean;
  playbackState: string;
  updateState: string;
  updateProgressPercent: number;
  updateMessage: string;
}

export interface AppPackageOption {
  id: number;
  version: string;
  label: string;
  filename: string;
}

export default function VenueScreensCard({
  tvPackages,
  selectedTvPackageId,
  onSelectedTvPackageIdChange,
  onRefreshPackages,
  generatedAtLabel,
  screens,
  installingDeviceId,
  canInstall,
  canInstallAll,
  onInstall,
  onInstallAll
}: {
  tvPackages: AppPackageOption[];
  selectedTvPackageId: string;
  onSelectedTvPackageIdChange: (value: string) => void;
  onRefreshPackages: () => void;
  generatedAtLabel: string;
  screens: TvScreenSnapshot[];
  installingDeviceId: string;
  canInstall: (screen: TvScreenSnapshot) => boolean;
  canInstallAll: boolean;
  onInstall: (screen: TvScreenSnapshot) => void;
  onInstallAll: () => void;
}) {
  return (
    <div className="venue-card">
      <div className="venue-card-head">
        <strong>设备状态</strong>
        <div className="venue-card-actions">
          <label className="venue-package-select">
            <span>TV 版本</span>
            <select value={selectedTvPackageId} onChange={(event) => onSelectedTvPackageIdChange(event.target.value)}>
              {tvPackages.length ? null : <option value="">暂无可用版本</option>}
              {tvPackages.map((appPackage) => (
                <option key={appPackage.id} value={String(appPackage.id)}>
                  {appPackage.version} · {appPackage.label || appPackage.filename}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={onRefreshPackages}>
            刷新版本
          </button>
          <button
            type="button"
            className="venue-screen-command"
            disabled={!canInstallAll}
            onClick={onInstallAll}
          >
            {installingDeviceId === "__all__" ? "批量下发中" : "一键更新全部"}
          </button>
          <span className="venue-muted">{generatedAtLabel}</span>
        </div>
      </div>
      <div className="venue-screens">
        {screens.map((screen) => (
          <div key={screen.screenNumber} className="venue-screen">
            <div className="venue-screen-top">
              <strong>屏幕 {screen.screenNumber}</strong>
              <div className="venue-screen-top-actions">
                <button
                  type="button"
                  className="venue-screen-command"
                  disabled={!canInstall(screen)}
                  onClick={() => onInstall(screen)}
                >
                  {installingDeviceId === screen.deviceId ? "下发中" : "更新 TV"}
                </button>
                <span className={`venue-dot ${screen.online ? "is-on" : ""}`}>{screen.online ? "在线" : "离线"}</span>
              </div>
            </div>
            <div className="venue-screen-meta">
              <div>
                <span className="venue-muted">设备</span>
                <strong>{screen.deviceId || "--"}</strong>
              </div>
              <div>
                <span className="venue-muted">版本</span>
                <strong>{screen.appVersion || "--"}</strong>
              </div>
              <div>
                <span className="venue-muted">状态</span>
                <strong>{screen.playbackState || "IDLE"}</strong>
              </div>
            </div>
            {screen.updateState && screen.updateState !== "IDLE" ? (
              <div className="venue-screen-update">
                <span className="venue-muted">
                  更新 {screen.updateState} {Math.round(screen.updateProgressPercent || 0)}%
                </span>
                <span className="venue-muted">{screen.updateMessage || ""}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
