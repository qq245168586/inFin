import type { AppPackageRecord } from "./AppPackageTable.tsx";

export default function UpdateAllTvDevices({
  tvPackages,
  selectedTvPackageId,
  onSelectedTvPackageIdChange,
  updatingAllTv,
  onUpdateAll
}: {
  tvPackages: AppPackageRecord[];
  selectedTvPackageId: string;
  onSelectedTvPackageIdChange: (value: string) => void;
  updatingAllTv: boolean;
  onUpdateAll: () => void;
}) {
  return (
    <div className="versions-update-actions">
      <label className="versions-update-select">
        <span>更新到版本</span>
        <select value={selectedTvPackageId} onChange={(event) => onSelectedTvPackageIdChange(event.target.value)}>
          {tvPackages.length ? null : <option value="">暂无可用 TV 版本</option>}
          {tvPackages.map((appPackage) => (
            <option key={appPackage.id} value={String(appPackage.id)}>
              {appPackage.version} · {appPackage.label || appPackage.originalName || appPackage.filename}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="primary-button" onClick={onUpdateAll} disabled={updatingAllTv || !tvPackages.length}>
        一键更新全部设备
      </button>
    </div>
  );
}
