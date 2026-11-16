export interface BindCandidate {
  id: number;
  username: string;
}

export default function BindAccountModal({
  open,
  bindQuery,
  onBindQueryChange,
  bindCandidates,
  selectedUserId,
  onSelectUser,
  onClose,
  onConfirm
}: {
  open: boolean;
  bindQuery: string;
  onBindQueryChange: (value: string) => void;
  bindCandidates: BindCandidate[];
  selectedUserId: number | null;
  onSelectUser: (userId: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="venue-modal-mask" role="dialog" aria-modal="true">
      <div className="venue-modal">
        <div className="venue-modal-head">
          <strong>绑定账号到当前场馆</strong>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="venue-form">
          <label>
            <span>搜索账号</span>
            <input value={bindQuery} onChange={(e) => onBindQueryChange(e.target.value)} placeholder="输入账号关键词" />
          </label>
          <div className="venue-picker">
            {bindCandidates.length ? (
              bindCandidates.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`venue-picker-item ${selectedUserId === Number(user.id) ? "is-selected" : ""}`}
                  onClick={() => onSelectUser(Number(user.id))}
                >
                  <strong>{user.username}</strong>
                  <span className="venue-muted">未绑定</span>
                </button>
              ))
            ) : (
              <div className="venue-empty">没有可绑定的账号。你可以先点右上角“新建账号”。</div>
            )}
          </div>
          <div className="venue-form-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={onConfirm}>
              绑定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
