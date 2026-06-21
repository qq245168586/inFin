export function ConsoleToolbar({
  dateLabel,
  onRefreshBundle,
  onRefreshTv
}: {
  dateLabel: string;
  onRefreshBundle: () => void;
  onRefreshTv: () => void;
}) {
  return (
    <div className="coach-console-toolbar">
      <div className="coach-toolbar-copy">
        <p>Coach Console</p>
        <strong>{dateLabel}</strong>
      </div>
      <div className="coach-toolbar-actions">
        <button type="button" className="ghost-button" onClick={onRefreshBundle}>
          刷新课表
        </button>
        <button type="button" className="primary-button" onClick={onRefreshTv}>
          刷新 TV
        </button>
      </div>
    </div>
  );
}
