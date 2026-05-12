import type { AuthSession } from "../../models/common";

export function CoachTopbar({ authSession, onLogout }: { authSession: AuthSession; onLogout: () => void }) {
  return (
    <header className="coach-web-topbar">
      <div className="coach-web-brand">
        <span>INFINI</span>
        <strong>Coach Web</strong>
      </div>
      <div className="coach-web-account">
        <div className="coach-web-account-copy">
          <strong>{authSession.username}</strong>
        </div>
        <button type="button" className="ghost-button" onClick={onLogout}>
          退出
        </button>
      </div>
    </header>
  );
}

