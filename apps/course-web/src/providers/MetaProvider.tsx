import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage } from "../utils/errors.ts";
import { fetchMeta, type MetaPayload } from "../services/api/meta.ts";

interface MetaContextValue {
  appData: MetaPayload | null;
  reloadMeta: (label?: string) => Promise<void>;
  clearMeta: () => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

export function useMeta() {
  const ctx = useContext(MetaContext);
  if (!ctx) {
    throw new Error("useMeta must be used within MetaProvider");
  }
  return ctx;
}

export default function MetaProvider({
  children,
  enabled,
  authHeader,
  onBusyText,
  onNotice
}: {
  children: ReactNode;
  enabled: boolean;
  authHeader: string;
  onBusyText: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  const [appData, setAppData] = useState<MetaPayload | null>(null);

  const clearMeta = useCallback(() => setAppData(null), []);

  const reloadMeta = useCallback(
    async (label = "") => {
      if (label) onBusyText(label);
      try {
        const payload = await fetchMeta(authHeader);
        setAppData(payload);
      } catch (error) {
        onNotice(getErrorMessage(error), "error");
      } finally {
        onBusyText("");
      }
    },
    [authHeader, onBusyText, onNotice]
  );

  useEffect(() => {
    if (!enabled) {
      setAppData(null);
      return;
    }
    void reloadMeta("正在加载页面...");
  }, [enabled, reloadMeta]);

  const value = useMemo(() => ({ appData, reloadMeta, clearMeta }), [appData, reloadMeta, clearMeta]);
  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}
