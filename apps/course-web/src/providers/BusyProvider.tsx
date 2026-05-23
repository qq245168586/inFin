import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface BusyContextValue {
  busyText: string;
  setBusyText: (text: string) => void;
  clearBusy: () => void;
}

const BusyContext = createContext<BusyContextValue | null>(null);

export function useBusy() {
  const ctx = useContext(BusyContext);
  if (!ctx) {
    throw new Error("useBusy must be used within BusyProvider");
  }
  return ctx;
}

export default function BusyProvider({ children }: { children: ReactNode }) {
  const [busyText, setBusyTextState] = useState("");

  const setBusyText = useCallback((text: string) => setBusyTextState(text), []);
  const clearBusy = useCallback(() => setBusyTextState(""), []);

  const value = useMemo(() => ({ busyText, setBusyText, clearBusy }), [busyText, setBusyText, clearBusy]);
  return <BusyContext.Provider value={value}>{children}</BusyContext.Provider>;
}
