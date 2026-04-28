import { useCallback, useEffect, useRef, useState } from "react";
import CoachConsole from "./CoachConsole.tsx";
import CoachScreensPage from "./CoachScreensPage.tsx";

type NoticeTone = "success" | "error";

interface WeekScheduleRecord {
  id: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

interface ScheduleCollection {
  currentWeek: WeekScheduleRecord[];
  lastWeek: WeekScheduleRecord[];
  history: WeekScheduleRecord[];
}

interface MetaPayload {
  schedules: ScheduleCollection;
}

interface LegacyEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
}

interface AuthTokenPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
  accountNamespace: string;
  environmentLabel: string;
}

interface AuthSession extends AuthTokenPayload, UserProfile {}

interface LoginFormState {
  username: string;
  password: string;
}

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

type CoachPageKey = "console" | "screens";
type AccountPresetKey = (typeof ACCOUNT_PRESETS)[number]["key"];

const ACCOUNT_PRESETS = [
  {
    key: "formal",
    label: "13689547720",
    username: "13689547720",
    password: "REDACTED_CONFIGURE_LOCALLY"
  },
  {
    key: "testing",
    label: "zhiyou",
    username: "zhiyou",
    password: "REDACTED_CONFIGURE_LOCALLY"
  }
] as const;

const AUTH_STORAGE_KEY = "infini-coach-web-auth";
const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

function readStorageJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveStorageJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageItem(key: string) {
  window.localStorage.removeItem(key);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string; msg?: string } | null;

  if (!response.ok) {
    throw new Error((payload as { message?: string; msg?: string } | null)?.message || (payload as { msg?: string } | null)?.msg || `请求失败 (${response.status})`);
  }

  return payload as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败，请稍后重试。";
}

function isAuthExpiredMessage(message: string): boolean {
  return /登录已失效|重新登录|refresh token 已失效|用户名或密码错误/i.test(String(message || ""));
}

export default function CoachWebApp() {
  const noticeTimerRef = useRef<number | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [currentWeekSchedules, setCurrentWeekSchedules] = useState<WeekScheduleRecord[]>([]);
  const [busyText, setBusyText] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [activePage, setActivePage] = useState<CoachPageKey>("console");
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    username: "13689547720",
    password: "REDACTED_CONFIGURE_LOCALLY"
  });

  const pushNotice = useCallback((message: string, tone: NoticeTone = "success") => {
    setNotice({ message, tone });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const handleSessionExpired = useCallback((message = "登录已失效，请重新登录。") => {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setBusyText("");
    pushNotice(message, "error");
  }, [pushNotice]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
      if (!storedAuth?.refresh_token) {
        setAuthReady(true);
        return;
      }

      setBusyText("正在恢复登录...");

      try {
        const refreshResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/refresh", {
          method: "POST",
          headers: {
            Authorization: LEGACY_BASIC_AUTH
          },
          body: JSON.stringify({
            refresh_token: storedAuth.refresh_token,
            client: "coach-web"
          })
        });

        const profileResponse = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
          headers: {
            Authorization: `${refreshResponse.data.token_type} ${refreshResponse.data.access_token}`
          }
        });

        if (cancelled) {
          return;
        }

        const nextAuth = {
          ...refreshResponse.data,
          ...profileResponse.data
        };

        setAuthSession(nextAuth);
        setLoginForm((current) => ({
          ...current,
          username: nextAuth.username || current.username
        }));
      } catch (error) {
        if (!cancelled) {
          removeStorageItem(AUTH_STORAGE_KEY);
          setAuthSession(null);
        }
      } finally {
        if (!cancelled) {
          setBusyText("");
          setAuthReady(true);
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function applyAccountPreset(accountKey: AccountPresetKey) {
    const preset = ACCOUNT_PRESETS.find((item) => item.key === accountKey);
    if (!preset) {
      return;
    }
    setLoginForm({
      username: preset.username,
      password: preset.password
    });
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (authSession) {
      saveStorageJson(AUTH_STORAGE_KEY, authSession);
      return;
    }

    removeStorageItem(AUTH_STORAGE_KEY);
  }, [authReady, authSession]);

  useEffect(() => {
    if (!authReady || !authSession) {
      return;
    }

    void loadMeta("正在加载教练端课表...");
  }, [authReady, authSession?.access_token]);

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      pushNotice("请输入手机号和密码。", "error");
      return;
    }

    setBusyText("正在登录...");

    try {
      const loginResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/login", {
        method: "POST",
        headers: {
          Authorization: LEGACY_BASIC_AUTH
        },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password.trim(),
          grant_type: "password",
          client: "coach-web"
        })
      });

      const profileResponse = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
        headers: {
          Authorization: `${loginResponse.data.token_type} ${loginResponse.data.access_token}`
        }
      });

      const nextAuth = {
        ...loginResponse.data,
        ...profileResponse.data
      };

      setAuthSession(nextAuth);
      setLoginForm((current) => ({
        ...current,
        username: nextAuth.username,
        password: current.password || "REDACTED_CONFIGURE_LOCALLY"
      }));
      pushNotice("登录成功。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  function handleLogout() {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setLoginForm({
      username: "13689547720",
      password: "REDACTED_CONFIGURE_LOCALLY"
    });
    setPasswordVisible(false);
    pushNotice("已退出登录。");
  }

  const selectedAccountOption = ACCOUNT_PRESETS.find((item) => item.username === loginForm.username)?.key || "formal";

  async function loadMeta(label = "") {
    if (label) {
      setBusyText(label);
    }

    try {
      const payload = await requestJson<MetaPayload>("/api/meta");
      setCurrentWeekSchedules(payload.schedules?.currentWeek || []);
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  if (!authReady) {
    return <div className="coach-busy-mask is-standalone">正在恢复登录...</div>;
  }

  if (!authSession) {
    return (
      <div className="coach-login-shell">
        <div className="coach-login-card">
          <div className="coach-login-brand">
            <span className="coach-login-wordmark">INFINI</span>
            <strong>教练端</strong>
            <p>同一套账号体系登录后，就能查看课程、预览正式组并控制 TV 播放。</p>
          </div>

          <div className="coach-login-form">
            <label className="coach-login-field">
              <span>账号</span>
              <div className="coach-account-select">
                <select
                  aria-label="选择账号"
                  value={selectedAccountOption}
                  onChange={(event) => {
                    applyAccountPreset(event.target.value as AccountPresetKey);
                  }}
                >
                  {ACCOUNT_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="coach-login-field">
              <span>密码</span>
              <div className="coach-password-row">
                <input
                  type={passwordVisible ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="请输入密码"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleLogin();
                    }
                  }}
                />
                <button type="button" className="coach-password-toggle" onClick={() => setPasswordVisible((current) => !current)}>
                  {passwordVisible ? "隐藏" : "显示"}
                </button>
              </div>
            </label>

            <button type="button" className="primary-button coach-login-submit" onClick={() => void handleLogin()}>
              登录教练端
            </button>
          </div>
        </div>

        {notice ? <div className={`coach-notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
        {busyText ? <div className="coach-busy-mask">{busyText}</div> : null}
      </div>
    );
  }

  return (
    <div className="coach-web-shell">
      <div className="coach-app-frame">
        <header className="coach-web-topbar">
          <div className="coach-web-brand">
            <span>INFINI</span>
            <strong>Coach Web</strong>
          </div>
          <div className="coach-web-account">
            <div className="coach-web-account-copy">
              <strong>{authSession.username}</strong>
              <span>已登录账号</span>
            </div>
            <button type="button" className="ghost-button" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <div className="coach-page-tabs">
          <button
            type="button"
            className={`coach-page-tab ${activePage === "console" ? "is-active" : ""}`}
            onClick={() => setActivePage("console")}
          >
            课程控制
          </button>
          <button
            type="button"
            className={`coach-page-tab ${activePage === "screens" ? "is-active" : ""}`}
            onClick={() => setActivePage("screens")}
          >
            屏幕管理
          </button>
        </div>

        {activePage === "console" ? (
          <CoachConsole
            authSession={authSession}
            currentWeekSchedules={currentWeekSchedules}
            onBusyTextChange={setBusyText}
            onNotice={pushNotice}
            onAuthExpired={handleSessionExpired}
          />
        ) : (
          <CoachScreensPage
            authSession={authSession}
            onBusyTextChange={setBusyText}
            onNotice={pushNotice}
            onAuthExpired={handleSessionExpired}
          />
        )}
      </div>

      {notice ? <div className={`coach-notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
      {busyText ? <div className="coach-busy-mask">{busyText}</div> : null}
    </div>
  );
}
