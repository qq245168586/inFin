import type { TvScreenItem } from "../../models/screens";
import { useI18n } from "../../providers/I18nProvider";
import { ScreenCard } from "./ScreenCard";

interface ScreenGridProps {
  busyDeviceId: string;
  expandedScreenNumbers: Record<number, boolean>;
  managedScreens: TvScreenItem[];
  selectedPackageId: string;
  canClearCache: (screen: TvScreenItem) => boolean;
  onClearCache: (screen: TvScreenItem) => void;
  onInstallPackage: (screen: TvScreenItem) => void;
  onToggle: (screenNumber: number) => void;
  onUnbind: (screen: TvScreenItem) => void;
}

export function ScreenGrid(props: ScreenGridProps) {
  const { t } = useI18n();
  return (
    <div className="coach-screen-section">
      <div className="coach-screen-section-head">
        <div>
          <p>Managed Screens</p>
          <strong>{t("已管理屏幕")}</strong>
        </div>
      </div>
      <div className="coach-screen-grid">
        {props.managedScreens.length ? props.managedScreens.map((screen) => (
          <ScreenCard key={screen.screenNumber} screen={screen} expanded={Boolean(props.expandedScreenNumbers[screen.screenNumber])} {...props} />
        )) : (
          <div className="coach-empty-block is-large coach-screen-empty-block">
            {t("当前还没有已绑定的屏幕。先用上面的扫码功能把 TV 绑定进来，这里只会显示实际已绑定的设备。")}
          </div>
        )}
      </div>
    </div>
  );
}
