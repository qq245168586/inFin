import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getErrorMessage } from "../utils/errors.ts";
import { readStorageJson, removeStorageItem, saveStorageJson } from "../utils/storage.ts";
import { fetchProfile, loginWithPassword, refreshWithToken, type AuthSession } from "../services/api/auth.ts";

const AUTH_STORAGE_KEY = "infini-admin-auth";
const ACTIVE_SESSION_WINDOW_MS = 12 * 60 * 60 * 1000;
const REFRESH_BEFORE_EXPIRE_MS = 10 * 60 * 1000;
const REFRESH_CHECK_MS = 60 * 1000;

export interface LoginFormState {
  username: string;
  password: string;
}

interface AuthContextValue {
  authReady: boolean;
  authSession: AuthSession | null;
  authHeader: string;
  loginForm: LoginFormState;
  setLoginForm: (next: LoginFormState) => void;
  login: () => Promise<void>;
  logout: (message?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export default function AuthProvider({
  children,
  onNotice,
  onBusyText,
  onAuthExpired
}: {
  children: ReactNode;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onBusyText: (text: string) => void;
  onAuthExpired?: () => void;
}) {
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });
  const lastActivityAtRef = useRef(Date.now());
  const refreshingRef = useRef(false);

  const enrichSession = useCallback((session: AuthSession): AuthSession => {
    const issuedAt = Date.now();
    return {
      ...session,
      issued_at: issuedAt,
      expires_at: issuedAt + Math.max(0, Number(session.expires_in) || 0) * 1000
    };
  }, []);

  const expireSession = useCallback((message = "登录已过期，请重新登录。") => {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setLoginForm({ username: "", password: "" });
    onNotice(message, "error");
    onAuthExpired?.();
  }, [onAuthExpired, onNotice]);

  const refreshSession = useCallback(async (current: AuthSession | null, silent = true) => {
    if (!current?.refresh_token || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const token = await refreshWithToken(current.refresh_token);
      const profile = await fetchProfile(token.token_type, token.access_token).catch(() => ({}));
      setAuthSession(enrichSession({ ...token, ...profile }));
    } catch (error) {
      expireSession(silent ? "登录已过期，请重新登录。" : getErrorMessage(error));
    } finally {
      refreshingRef.current = false;
    }
  }, [enrichSession, expireSession]);

  useEffect(() => {
    let cancelled = false;
    const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
    if (!storedAuth?.refresh_token) {
      setAuthReady(true);
      return () => {
        cancelled = true;
      };
    }
    onBusyText("正在恢复登录...");
    (async () => {
      try {
        const token = await refreshWithToken(storedAuth.refresh_token);
        const profile = await fetchProfile(token.token_type, token.access_token).catch(() => ({}));
        if (!cancelled) {
          setAuthSession(enrichSession({ ...token, ...profile }));
        }
      } catch {
        if (!cancelled) {
          removeStorageItem(AUTH_STORAGE_KEY);
          setAuthSession(null);
        }
      } finally {
        if (!cancelled) {
          onBusyText("");
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrichSession, onBusyText]);

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
        expireSession("登录已超过 12 小时未操作，请重新登录。");
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
  }, [authSession, expireSession, refreshSession]);

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const message = String(detail?.message || "");
      if (!message.includes("登录已失效") && !message.includes("refresh token 已失效")) {
        return;
      }
      expireSession("登录已过期，请重新登录。");
    }

    window.addEventListener("infini-auth-expired", handleAuthExpired as EventListener);
    return () => window.removeEventListener("infini-auth-expired", handleAuthExpired as EventListener);
  }, [expireSession]);

  const authHeader = useMemo(() => {
    if (!authSession?.access_token) return "";
    return `${authSession.token_type} ${authSession.access_token}`;
  }, [authSession?.access_token, authSession?.token_type]);

  const login = useCallback(async () => {
    onBusyText("正在登录...");
    try {
      const token = await loginWithPassword(loginForm.username, loginForm.password);
      const profile = await fetchProfile(token.token_type, token.access_token).catch(() => ({}));
      const nextAuth: AuthSession = enrichSession({ ...token, ...profile });
      setAuthSession(nextAuth);
      lastActivityAtRef.current = Date.now();
      setLoginForm({ username: "", password: "" });
      onNotice("登录成功。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [enrichSession, loginForm.password, loginForm.username, onBusyText, onNotice]);

  const logout = useCallback(
    (message = "已退出登录。") => {
      removeStorageItem(AUTH_STORAGE_KEY);
      setAuthSession(null);
      setLoginForm({ username: "", password: "" });
      onNotice(message);
      onAuthExpired?.();
    },
    [onNotice, onAuthExpired]
  );

  const value = useMemo(
    () => ({ authReady, authSession, authHeader, loginForm, setLoginForm, login, logout }),
    [authReady, authSession, authHeader, loginForm, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
