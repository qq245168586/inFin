import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage } from "../utils/errors.ts";
import type { AuthSession } from "../services/api/auth.ts";
import { browserSession } from "../services/browserSession";

export interface LoginFormState { username: string; password: string; }
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
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** UI mirrors the shared cookie session; storage and retries belong to the request layer. */
export default function AuthProvider({ children, onNotice, onBusyText, onAuthExpired }: {
  children: ReactNode;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onBusyText: (text: string) => void;
  onAuthExpired?: () => void;
}) {
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = browserSession.subscribe(session => {
      if (cancelled) return;
      setAuthSession(session);
      if (!session) onAuthExpired?.();
    });
    onBusyText("正在恢复登录...");
    browserSession.restore().then(session => {
      if (!cancelled) setAuthSession(session);
    }).catch(error => {
      if (!cancelled) onNotice(getErrorMessage(error), "error");
    }).finally(() => {
      if (!cancelled) { setAuthReady(true); onBusyText(""); }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [onBusyText, onNotice, onAuthExpired]);

  // No per-tab idle logout: another tab can still be actively editing.
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

  const login = useCallback(async () => {
    onBusyText("正在登录...");
    try {
      await browserSession.login(loginForm.username, loginForm.password);
      setLoginForm({ username: "", password: "" });
      onNotice("登录成功。");
    } catch (error) { onNotice(getErrorMessage(error), "error"); }
    finally { onBusyText(""); }
  }, [loginForm, onBusyText, onNotice]);

  const logout = useCallback((message = "已退出登录。") => {
    void browserSession.logout().then(() => {
      setLoginForm({ username: "", password: "" });
      onNotice(message);
    }).catch(error => onNotice(getErrorMessage(error), "error"));
  }, [onNotice]);

  const authHeader = authSession ? `${authSession.token_type} ${authSession.access_token}` : "";
  const value = useMemo(() => ({ authReady, authSession, authHeader, loginForm, setLoginForm, login, logout }),
    [authReady, authSession, authHeader, loginForm, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
