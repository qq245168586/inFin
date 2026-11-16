import type { LoginFormState } from "../../providers/AuthProvider.tsx";
import { useI18n } from "../../providers/I18nProvider.tsx";

export default function LoginPage({
  loginForm,
  onLoginFormChange,
  onLogin
}: {
  loginForm: LoginFormState;
  onLoginFormChange: (next: LoginFormState) => void;
  onLogin: () => void;
}) {
  const { locale, locales, setLocale } = useI18n();

  return (
    <div className="login-shell">
      <section className="login-stage">
        <div className="login-stage-top">
          <div className="traffic-lights">
            <span className="dot is-red" />
            <span className="dot is-yellow" />
            <span className="dot is-green" />
          </div>
          <div className="brand-wordmark">INFINI</div>
          <label className="language-switcher login-language-switcher">
            <span>语言</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
              {locales.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="login-panel">
          <div className="login-panel-copy">
            <p className="workspace-kicker">Infini Admin</p>
            <h1>欢迎登录</h1>
            <p>输入账号和密码后进入后台。</p>
          </div>

          <div className="login-form old-login-form">
            <label className="login-select-field">
              <span>账号</span>
              <div className="login-password-row">
                <input
                  value={loginForm.username}
                  onChange={(event) => onLoginFormChange({ ...loginForm, username: event.target.value })}
                  placeholder="手机号或自定义账号"
                  autoComplete="username"
                  inputMode="text"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onLogin();
                    }
                  }}
                />
              </div>
            </label>

            <label className="login-select-field">
              <span>密码</span>
              <div className="login-password-row">
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => onLoginFormChange({ ...loginForm, password: event.target.value })}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  inputMode="text"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onLogin();
                    }
                  }}
                />
              </div>
            </label>

            <button type="button" className="primary-button login-submit old-login-submit" onClick={onLogin}>
              登录
            </button>
          </div>

          <div className="login-panel-foot">
            <div className="login-mark">INFINI ADMIN</div>
          </div>
        </div>
      </section>
    </div>
  );
}
