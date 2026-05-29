import type { AuthSession } from "../../models/common";

export function CoachTopbar({
  authSession,
  onLogout,
  onOpenSettings
}: {
  authSession: AuthSession;
  onLogout: () => void;
  onOpenSettings: () => void;
}) {
  const venueName = getVenueDisplayName(authSession);

  return (
    <header className="coach-web-topbar">
      <div className="coach-web-brand">
        <span>INFINI</span>
        <strong>Coach Web</strong>
      </div>
      <div className="coach-web-account">
        <div className="coach-web-account-copy">
          <strong>{authSession.username}</strong>
          <span title="当前账号所属健身房">健身房：{venueName}</span>
        </div>
        <button type="button" className="coach-settings-button" onClick={onOpenSettings} aria-label="打开设置">
          <span className="coach-settings-icon" aria-hidden="true" />
          <span>设置</span>
        </button>
        <button type="button" className="ghost-button" onClick={onLogout}>
          退出
        </button>
      </div>
    </header>
  );
}

function getVenueDisplayName(authSession: AuthSession): string {
  const candidates = [
    authSession.venueName,
    authSession.gymName,
    authSession.environmentLabel
  ];
  const technicalValues = new Set([
    authSession.username,
    authSession.venueId,
    authSession.accountNamespace
  ].map((item) => String(item || "").trim()).filter(Boolean));
  const matched = candidates
    .map((item) => String(item || "").trim())
    .find((item) => item && !technicalValues.has(item));
  if (matched) {
    return matched;
  }
  return String(authSession.role || "").toLowerCase() === "superadmin" ? "超级管理员" : "未绑定";
}
