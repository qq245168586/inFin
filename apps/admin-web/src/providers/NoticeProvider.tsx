import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type NoticeTone = "success" | "error";

interface NoticeState {
  id: number;
  message: string;
  tone: NoticeTone;
}

interface NoticeContextValue {
  notice: NoticeState | null;
  pushNotice: (message: string, tone?: NoticeTone) => void;
  clearNotice: () => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function useNotice() {
  const ctx = useContext(NoticeContext);
  if (!ctx) {
    throw new Error("useNotice must be used within NoticeProvider");
  }
  return ctx;
}

export default function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const pushNotice = useCallback((message: string, tone: NoticeTone = "success") => {
    setNotice({ id: Date.now(), message, tone });
    window.setTimeout(() => setNotice((current) => (current?.message === message ? null : current)), 3200);
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(() => ({ notice, pushNotice, clearNotice }), [notice, pushNotice, clearNotice]);
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}
