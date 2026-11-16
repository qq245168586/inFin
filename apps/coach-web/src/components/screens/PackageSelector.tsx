import type { AppPackageListPayload, AppPackageRecord } from "../../models/screens";
import { useI18n } from "../../providers/I18nProvider";

export function PackageSelector({
  packagePayload,
  selectedPackageId,
  tvPackages,
  onSelectPackage
}: {
  packagePayload: AppPackageListPayload | null;
  selectedPackageId: string;
  tvPackages: AppPackageRecord[];
  onSelectPackage: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="coach-screen-update-bar">
      <label className="coach-screen-select">
        <span>{t("TV 版本")}</span>
        <select value={selectedPackageId} onChange={(event) => onSelectPackage(event.target.value)}>
          {tvPackages.length ? null : <option value="">{t("暂无可用 TV 版本")}</option>}
          {tvPackages.map((appPackage) => (
            <option key={appPackage.id} value={appPackage.id}>
              {appPackage.version} · {appPackage.label}
            </option>
          ))}
        </select>
      </label>
      <div className="coach-screen-update-copy">
        <span>{t("版本目录")}</span>
        <strong>{packagePayload?.storageDirectory || "--"}</strong>
      </div>
    </div>
  );
}
