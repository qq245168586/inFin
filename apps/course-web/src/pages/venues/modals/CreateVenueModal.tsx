export default function CreateVenueModal({
  open,
  newVenueName,
  onNewVenueNameChange,
  onClose,
  onCreate
}: {
  open: boolean;
  newVenueName: string;
  onNewVenueNameChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  if (!open) return null;

  return (
    <div className="venue-modal-mask" role="dialog" aria-modal="true">
      <div className="venue-modal">
        <div className="venue-modal-head">
          <strong>新建场馆</strong>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="venue-form">
          <label>
            <span>场馆名称</span>
            <input value={newVenueName} onChange={(e) => onNewVenueNameChange(e.target.value)} placeholder="例如：A 场馆" />
          </label>
          <p className="venue-muted">命名空间将由系统自动生成，用于 MQTT 与数据隔离。</p>
          <div className="venue-form-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={onCreate}>
              创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
