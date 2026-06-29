import type { AuthSession } from "../../models/common";
import { useI18n } from "../../providers/I18nProvider";

export function CoachTopbar({
  authSession,
  onLogout,
  onOpenSettings
}: {
  authSession: AuthSession;
  onLogout: () => void;
  onOpenSettings: () => void;
}) {
  const { locale, locales, setLocale, t } = useI18n();
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
          <span title={t("当前账号所属健身房")}>{t("健身房：")}{t(venueName)}</span>
        </div>
        <label className="language-switcher coach-language-switcher">
          <span>{t("语言")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
            {locales.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" className="coach-settings-button" onClick={onOpenSettings} aria-label={t("打开设置")}>
          <span className="coach-settings-icon" aria-hidden="true" />
          <span>{t("设置")}</span>
        </button>
        <button type="button" className="ghost-button" onClick={onLogout}>
          {t("退出")}
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
