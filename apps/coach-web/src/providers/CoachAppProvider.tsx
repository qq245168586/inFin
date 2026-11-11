import { browserSession } from "../services/browserSession";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthSession, CoachPageKey, LoginFormState, NoticeState, NoticeTone } from "../models/common";
import type { WeekScheduleRecord } from "../models/schedule";
import { loginCoach } from "../services/authService";
import { fetchCurrentWeekSchedules } from "../services/metaService";
import { getErrorMessage, isAuthExpiredMessage } from "../utils/format";
import { useI18n } from "./I18nProvider";

interface CoachAppContextValue {
  activePage: CoachPageKey;
  authReady: boolean;
  authSession: AuthSession | null;
  busyText: string;
  currentWeekSchedules: WeekScheduleRecord[];
  loginForm: LoginFormState;
  notice: NoticeState | null;
  passwordVisible: boolean;
  handleLogin: () => Promise<void>;
  handleLogout: () => void;
  handleSessionExpired: (message?: string) => void;
  pushNotice: (message: string, tone?: NoticeTone) => void;
  setActivePage: (page: CoachPageKey) => void;
  setBusyText: (text: string) => void;
  setLoginForm: React.Dispatch<React.SetStateAction<LoginFormState>>;
  setPasswordVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const CoachAppContext = createContext<CoachAppContextValue | null>(null);

export function CoachAppProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const noticeTimerRef = useRef<number | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [currentWeekSchedules, setCurrentWeekSchedules] = useState<WeekScheduleRecord[]>([]);
  const [busyText, setBusyText] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [activePage, setActivePage] = useState<CoachPageKey>("console");
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });

  const pushNotice = useCallback((message: string, tone: NoticeTone = "success") => {
    setNotice({ message, tone });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const handleSessionExpired = useCallback((message = t("登录已失效，请重新登录。")) => {
    if (browserSession.read()) return;
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setActivePage("console");
    setBusyText("");
    setPasswordVisible(false);
    setLoginForm({ username: "", password: "" });
    pushNotice(message, "error");
  }, [pushNotice, t]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = browserSession.subscribe(session => {
      if (!cancelled) {
        setAuthSession(session as AuthSession | null);
        if (!session) { setCurrentWeekSchedules([]); setActivePage("console"); }
      }
    });
    setBusyText(t("正在恢复登录..."));
    browserSession.restore().then(session => {
      if (!cancelled) setAuthSession(session as AuthSession | null);
    }).catch(error => {
      if (!cancelled) pushNotice(getErrorMessage(error), "error");
    }).finally(() => {
      if (!cancelled) { setAuthReady(true); setBusyText(""); }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !authSession) {
      return;
    }
    void loadMeta(t("正在加载教练端课表..."));
  }, [authReady, authSession?.access_token]);

  useEffect(() => {
    if (!authSession) return;
    const timer = window.setInterval(() => {
      const current = browserSession.read();
      if (current && Number(current.expires_at) - Date.now() < 10 * 60_000) {
        void browserSession.refresh().catch(() => {});
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [authSession?.access_token]);

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      pushNotice(t("请输入账号和密码。"), "error");
      return;
    }
    setBusyText(t("正在登录..."));
    try {
      const nextAuth = await loginCoach(loginForm.username.trim(), loginForm.password.trim());
      setAuthSession(nextAuth);
      setActivePage("console");
      setLoginForm({ username: "", password: "" });
      pushNotice(t("登录成功。"));
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  function handleLogout() {
    void browserSession.logout().then(() => {
      setCurrentWeekSchedules([]);
      setActivePage("console");
      setLoginForm({ username: "", password: "" });
      setPasswordVisible(false);
      pushNotice(t("已退出登录。"));
    }).catch(error => pushNotice(getErrorMessage(error), "error"));
  }

  async function loadMeta(label = "") {
    if (label) {
      setBusyText(t(label));
    }
    try {
      setCurrentWeekSchedules(await fetchCurrentWeekSchedules());
    } catch (error) {
      const message = getErrorMessage(error);
      if (isAuthExpiredMessage(message)) {
        handleSessionExpired(message);
        return;
      }
      pushNotice(message, "error");
    } finally {
      setBusyText("");
    }
  }

  const value = useMemo<CoachAppContextValue>(() => ({
    activePage,
    authReady,
    authSession,
    busyText,
    currentWeekSchedules,
    handleLogin,
    handleLogout,
    handleSessionExpired,
    loginForm,
    notice,
    passwordVisible,
    pushNotice,
    setActivePage,
    setBusyText,
    setLoginForm,
    setPasswordVisible
  }), [activePage, authReady, authSession, busyText, currentWeekSchedules, loginForm, notice, passwordVisible, pushNotice, handleSessionExpired]);

  return <CoachAppContext.Provider value={value}>{children}</CoachAppContext.Provider>;
}

export function useCoachApp() {
  const value = useContext(CoachAppContext);
  if (!value) {
    throw new Error("useCoachApp must be used inside CoachAppProvider");
  }
  return value;
}
