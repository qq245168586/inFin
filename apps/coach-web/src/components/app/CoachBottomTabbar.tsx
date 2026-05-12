import type { CoachPageKey } from "../../models/common";

interface CoachBottomTabbarProps {
  activePage: CoachPageKey;
  onPageChange: (page: CoachPageKey) => void;
}

export function CoachBottomTabbar({ activePage, onPageChange }: CoachBottomTabbarProps) {
  return (
    <nav className="coach-bottom-tabbar" aria-label="Coach 页面切换">
      <button
        type="button"
        className={`coach-bottom-tab ${activePage === "console" ? "is-active" : ""}`}
        onClick={() => onPageChange("console")}
        aria-current={activePage === "console" ? "page" : undefined}
      >
        <span className="coach-bottom-tab-icon is-console" aria-hidden="true" />
        课程控制
      </button>
      <button
        type="button"
        className={`coach-bottom-tab ${activePage === "screens" ? "is-active" : ""}`}
        onClick={() => onPageChange("screens")}
        aria-current={activePage === "screens" ? "page" : undefined}
      >
        <span className="coach-bottom-tab-icon is-screens" aria-hidden="true" />
        屏幕管理
      </button>
    </nav>
  );
}

