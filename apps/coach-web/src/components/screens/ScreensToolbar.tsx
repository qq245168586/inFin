import { useI18n } from "../../providers/I18nProvider";

export function ScreensToolbar({ onRefreshPackages, onRefreshScreens }: { onRefreshPackages: () => void; onRefreshScreens: () => void }) {
  const { t } = useI18n();
  return (
    <div className="coach-console-toolbar">
      <div className="coach-toolbar-copy">
        <p>Screen Manager</p>
        <strong>{t("屏幕管理")}</strong>
      </div>
      <div className="coach-toolbar-actions">
        <button type="button" className="ghost-button" onClick={onRefreshPackages}>
          {t("刷新版本")}
        </button>
        <button type="button" className="ghost-button" onClick={onRefreshScreens}>
          {t("刷新状态")}
        </button>
      </div>
    </div>
  );
}
