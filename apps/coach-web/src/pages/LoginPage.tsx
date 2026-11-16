import { BusyMask } from "../components/app/BusyMask";
import { NoticeToast } from "../components/app/NoticeToast";
import { useCoachApp } from "../providers/CoachAppProvider";
import { useI18n } from "../providers/I18nProvider";

export default function LoginPage() {
  const { locale, locales, setLocale, t } = useI18n();
  const {
    busyText,
    handleLogin,
    loginForm,
    notice,
    passwordVisible,
    setLoginForm,
    setPasswordVisible
  } = useCoachApp();

  return (
    <div className="coach-login-shell">
      <div className="coach-login-card">
        <div className="coach-login-brand">
          <span className="coach-login-wordmark">INFINI</span>
          <strong>{t("教练端")}</strong>
          <p>{t("同一套账号体系登录后，就能查看课程、预览正式组并控制 TV 播放。")}</p>
        </div>

        <div className="coach-login-form">
          <label className="coach-login-field">
            <span>{t("语言")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
              {locales.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="coach-login-field">
            <span>{t("账号")}</span>
            <input
              type="text"
              value={loginForm.username}
              onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
              placeholder={t("请输入账号")}
              autoComplete="username"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleLogin();
                }
              }}
            />
          </label>

          <label className="coach-login-field">
            <span>{t("密码")}</span>
            <div className="coach-password-row">
              <input
                type={passwordVisible ? "text" : "password"}
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={t("请输入密码")}
                autoComplete="current-password"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleLogin();
                  }
                }}
              />
              <button type="button" className="coach-password-toggle" onClick={() => setPasswordVisible((current) => !current)}>
                {passwordVisible ? t("隐藏") : t("显示")}
              </button>
            </div>
          </label>

          <button type="button" className="primary-button coach-login-submit" onClick={() => void handleLogin()}>
            {t("登录教练端")}
          </button>
        </div>
      </div>

      <NoticeToast notice={notice} />
      <BusyMask text={busyText} />
    </div>
  );
}
