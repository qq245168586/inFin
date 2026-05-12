import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthSession, CoachPageKey, LoginFormState, NoticeState, NoticeTone } from "../models/common";
import type { WeekScheduleRecord } from "../models/schedule";
import { AUTH_STORAGE_KEY, loginCoach, refreshCoachSession } from "../services/authService";
import { fetchCurrentWeekSchedules } from "../services/metaService";
import { readStorageJson, removeStorageItem, saveStorageJson } from "../services/storage";
import { getErrorMessage, isAuthExpiredMessage } from "../utils/format";

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

  const handleSessionExpired = useCallback((message = "登录已失效，请重新登录。") => {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setCurrentWeekSchedules([]);
    setActivePage("console");
    setBusyText("");
    setPasswordVisible(false);
    setLoginForm({ username: "", password: "" });
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
        const nextAuth = await refreshCoachSession(storedAuth.refresh_token);
        if (!cancelled) {
          setAuthSession(nextAuth);
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
  }, []);

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
    void loadMeta("正在加载教练端课表...");
  }, [authReady, authSession?.access_token]);

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      pushNotice("请输入账号和密码。", "error");
      return;
    }
    setBusyText("正在登录...");
    try {
      const nextAuth = await loginCoach(loginForm.username.trim(), loginForm.password.trim());
      setAuthSession(nextAuth);
      setLoginForm({ username: "", password: "" });
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
    setLoginForm({ username: "", password: "" });
    setPasswordVisible(false);
    pushNotice("已退出登录。");
  }

  async function loadMeta(label = "") {
    if (label) {
      setBusyText(label);
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

