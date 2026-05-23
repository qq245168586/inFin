export default function CreateAccountModal({
  open,
  accountUsername,
  accountPassword,
  onAccountUsernameChange,
  onAccountPasswordChange,
  onClose,
  onCreate
}: {
  open: boolean;
  accountUsername: string;
  accountPassword: string;
  onAccountUsernameChange: (value: string) => void;
  onAccountPasswordChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  if (!open) return null;

  return (
    <div className="venue-modal-mask" role="dialog" aria-modal="true">
      <div className="venue-modal">
        <div className="venue-modal-head">
          <strong>新建账号</strong>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="venue-form">
          <label>
            <span>账号</span>
            <input value={accountUsername} onChange={(e) => onAccountUsernameChange(e.target.value)} placeholder="手机号或自定义账号" />
          </label>
          <label>
            <span>密码</span>
            <input value={accountPassword} onChange={(e) => onAccountPasswordChange(e.target.value)} placeholder="密码" />
          </label>
          <p className="venue-muted">账号创建后，需要在场馆里绑定才能用于 Coach 端登录。</p>
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
