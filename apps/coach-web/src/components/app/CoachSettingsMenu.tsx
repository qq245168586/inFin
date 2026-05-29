import type { CoachPageKey } from "../../models/common";

interface CoachSettingsMenuProps {
  activePage: CoachPageKey;
  onClose: () => void;
  onSelectPage: (page: CoachPageKey) => void;
}

export function CoachSettingsMenu({ activePage, onClose, onSelectPage }: CoachSettingsMenuProps) {
  function selectPage(page: CoachPageKey) {
    onSelectPage(page);
    onClose();
  }

  return (
    <div className="coach-settings-layer" role="presentation" onClick={onClose}>
      <div className="coach-settings-popover" role="dialog" aria-modal="true" aria-label="设置" onClick={(event) => event.stopPropagation()}>
        <div className="coach-settings-head">
          <div>
            <span>设置</span>
            <strong>教练端管理</strong>
          </div>
          <button type="button" className="coach-settings-close" onClick={onClose} aria-label="关闭设置">
            ×
          </button>
        </div>
        <div className="coach-settings-group">
          <span className="coach-settings-group-title">现场操作</span>
          <button
            type="button"
            className={`coach-settings-item ${activePage === "console" ? "is-active" : ""}`}
            onClick={() => selectPage("console")}
          >
            <span className="coach-settings-item-icon is-play" aria-hidden="true" />
            <span>
              <strong>课程控制</strong>
              <em>预览、开始、暂停和结束课程</em>
            </span>
          </button>
        </div>
        <div className="coach-settings-group">
          <span className="coach-settings-group-title">设备设置</span>
          <button
            type="button"
            className={`coach-settings-item ${activePage === "screens" ? "is-active" : ""}`}
            onClick={() => selectPage("screens")}
          >
            <span className="coach-settings-item-icon is-screen" aria-hidden="true" />
            <span>
              <strong>屏幕管理</strong>
              <em>绑定屏幕、清缓存和更新 TV</em>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
