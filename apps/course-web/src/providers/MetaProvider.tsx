import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getErrorMessage } from "../utils/errors.ts";
import { fetchMeta, type MetaPayload } from "../services/api/meta.ts";

export interface ReloadMetaOptions {
  label?: string;
  coursePackageId?: number | null;
}

interface MetaContextValue {
  appData: MetaPayload | null;
  reloadMeta: (options?: string | ReloadMetaOptions) => Promise<void>;
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
  const activeCoursePackageIdRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  const clearMeta = useCallback(() => {
    activeCoursePackageIdRef.current = null;
    setAppData(null);
  }, []);

  const reloadMeta = useCallback(
    async (options: string | ReloadMetaOptions = "") => {
      const label = typeof options === "string" ? options : options.label || "";
      if (typeof options === "object" && "coursePackageId" in options) {
        const nextCoursePackageId = Number(options.coursePackageId || 0);
        activeCoursePackageIdRef.current = nextCoursePackageId > 0 ? nextCoursePackageId : null;
      }

      if (label) onBusyText(label);
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      try {
        const payload = await fetchMeta(authHeader, { coursePackageId: activeCoursePackageIdRef.current });
        if (requestSeqRef.current === requestSeq) {
          setAppData(payload);
        }
      } catch (error) {
        if (requestSeqRef.current === requestSeq) {
          onNotice(getErrorMessage(error), "error");
        }
      } finally {
        if (requestSeqRef.current === requestSeq) {
          onBusyText("");
        }
      }
    },
    [authHeader, onBusyText, onNotice]
  );

  useEffect(() => {
    if (!enabled) {
      activeCoursePackageIdRef.current = null;
      setAppData(null);
      return;
    }
    void reloadMeta("正在加载页面...");
  }, [enabled, reloadMeta]);

  const value = useMemo(() => ({ appData, reloadMeta, clearMeta }), [appData, reloadMeta, clearMeta]);
  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}
