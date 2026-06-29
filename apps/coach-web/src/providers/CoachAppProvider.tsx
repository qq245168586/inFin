import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthSession, CoachPageKey, LoginFormState, NoticeState, NoticeTone } from "../models/common";
import type { WeekScheduleRecord } from "../models/schedule";
import { AUTH_STORAGE_KEY, loginCoach, refreshCoachSession } from "../services/authService";
import { fetchCurrentWeekSchedules } from "../services/metaService";
import { readStorageJson, removeStorageItem, saveStorageJson } from "../services/storage";
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
const ACTIVE_SESSION_WINDOW_MS = 12 * 60 * 60 * 1000;
const REFRESH_BEFORE_EXPIRE_MS = 10 * 60 * 1000;
const REFRESH_CHECK_MS = 60 * 1000;

export function CoachAppProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const noticeTimerRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef(Date.now());
  const refreshingRef = useRef(false);
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

  const enrichSession = useCallback((session: AuthSession): AuthSession => {
    const issuedAt = Date.now();
    return {
      ...session,
      issued_at: issuedAt,
      expires_at: issuedAt + Math.max(0, Number(session.expires_in) || 0) * 1000
    };
  }, []);

  const handleSessionExpired = useCallback((message = t("登录已失效，请重新登录。")) => {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setActivePage("console");
    setBusyText("");
    setPasswordVisible(false);
    setLoginForm({ username: "", password: "" });
    pushNotice(message, "error");
  }, [pushNotice, t]);

  const refreshSession = useCallback(async (current: AuthSession | null) => {
    if (!current?.refresh_token || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const nextAuth = await refreshCoachSession(current.refresh_token);
      setAuthSession(enrichSession(nextAuth));
    } catch (error) {
      handleSessionExpired(isAuthExpiredMessage(getErrorMessage(error)) ? t("登录已过期，请重新登录。") : getErrorMessage(error));
    } finally {
      refreshingRef.current = false;
    }
  }, [enrichSession, handleSessionExpired]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
      if (!storedAuth?.refresh_token) {
        setAuthReady(true);
        return;
      }
      setBusyText(t("正在恢复登录..."));
      try {
        const nextAuth = await refreshCoachSession(storedAuth.refresh_token);
        if (!cancelled) {
          setAuthSession(enrichSession(nextAuth));
        }
      } catch {
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
  }, [enrichSession]);

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
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
    void loadMeta(t("正在加载教练端课表..."));
  }, [authReady, authSession?.access_token]);

  useEffect(() => {
    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
    };
    const events = ["click", "keydown", "pointerdown", "touchstart", "input", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    return () => events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
  }, []);

  useEffect(() => {
    if (!authSession) return;
    const tick = () => {
      const now = Date.now();
      if (now - lastActivityAtRef.current > ACTIVE_SESSION_WINDOW_MS) {
      handleSessionExpired(t("登录已超过 12 小时未操作，请重新登录。"));
        return;
      }
      const expiresAt = Number(authSession.expires_at || 0);
      if (expiresAt && expiresAt - now <= REFRESH_BEFORE_EXPIRE_MS) {
        void refreshSession(authSession);
      }
    };
    tick();
    const timer = window.setInterval(tick, REFRESH_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [authSession, handleSessionExpired, refreshSession]);

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      const message = String((event as CustomEvent<{ message?: string }>).detail?.message || t("登录已过期，请重新登录。"));
      if (!isAuthExpiredMessage(message)) return;
      handleSessionExpired(t("登录已过期，请重新登录。"));
    }

    window.addEventListener("infini-auth-expired", handleAuthExpired as EventListener);
    return () => window.removeEventListener("infini-auth-expired", handleAuthExpired as EventListener);
  }, [handleSessionExpired]);

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      pushNotice(t("请输入账号和密码。"), "error");
      return;
    }
    setBusyText(t("正在登录..."));
    try {
      const nextAuth = await loginCoach(loginForm.username.trim(), loginForm.password.trim());
      setAuthSession(enrichSession(nextAuth));
      lastActivityAtRef.current = Date.now();
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
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setActivePage("console");
    setLoginForm({ username: "", password: "" });
    setPasswordVisible(false);
    pushNotice(t("已退出登录。"));
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
