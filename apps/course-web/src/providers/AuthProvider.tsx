import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage } from "../utils/errors.ts";
import { readStorageJson, removeStorageItem, saveStorageJson } from "../utils/storage.ts";
import { fetchProfile, loginWithPassword, type AuthSession } from "../services/api/auth.ts";

const AUTH_STORAGE_KEY = "infini-admin-auth";

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

  useEffect(() => {
    const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
    if (storedAuth?.access_token) {
      setAuthSession(storedAuth);
    }
    setAuthReady(true);
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
    function handleAuthExpired(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const message = String(detail?.message || "");
      if (!message.includes("登录已失效") && !message.includes("refresh token 已失效")) {
        return;
      }
      onNotice("登录已过期，请重新登录。", "error");
      setAuthSession(null);
      onAuthExpired?.();
    }

    window.addEventListener("infini-auth-expired", handleAuthExpired as EventListener);
    return () => window.removeEventListener("infini-auth-expired", handleAuthExpired as EventListener);
  }, [onNotice, onAuthExpired]);

  const authHeader = useMemo(() => {
    if (!authSession?.access_token) return "";
    return `${authSession.token_type} ${authSession.access_token}`;
  }, [authSession?.access_token, authSession?.token_type]);

  const login = useCallback(async () => {
    onBusyText("正在登录...");
    try {
      const token = await loginWithPassword(loginForm.username, loginForm.password);
      const profile = await fetchProfile(token.token_type, token.access_token).catch(() => ({}));
      const nextAuth: AuthSession = { ...token, ...profile };
      setAuthSession(nextAuth);
      setLoginForm({ username: "", password: "" });
      onNotice("登录成功。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [loginForm.password, loginForm.username, onBusyText, onNotice]);

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
