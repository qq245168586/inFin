export function ScreensToolbar({ onRefreshPackages, onRefreshScreens }: { onRefreshPackages: () => void; onRefreshScreens: () => void }) {
  return (
    <div className="coach-console-toolbar">
      <div className="coach-toolbar-copy">
        <p>Screen Manager</p>
        <strong>屏幕管理</strong>
      </div>
      <div className="coach-toolbar-actions">
        <button type="button" className="ghost-button" onClick={onRefreshPackages}>
          刷新版本
        </button>
        <button type="button" className="ghost-button" onClick={onRefreshScreens}>
          刷新状态
        </button>
      </div>
    </div>
  );
}

