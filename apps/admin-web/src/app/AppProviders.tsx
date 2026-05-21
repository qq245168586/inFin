import BusyProvider, { useBusy } from "../providers/BusyProvider.tsx";
import NoticeProvider, { useNotice } from "../providers/NoticeProvider.tsx";
import AuthProvider, { useAuth } from "../providers/AuthProvider.tsx";
import MetaProvider from "../providers/MetaProvider.tsx";
import I18nProvider from "../providers/I18nProvider.tsx";
import { useCallback, type ReactNode } from "react";

function ProvidersInner({ children }: { children: ReactNode }) {
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();

  const handleAuthExpired = useCallback(() => {
    // MetaProvider will auto-clear on disabled, keep here for future hooks.
  }, []);

  return (
    <AuthProvider onBusyText={setBusyText} onNotice={pushNotice} onAuthExpired={handleAuthExpired}>
      <AuthMetaBridge>{children}</AuthMetaBridge>
    </AuthProvider>
  );
}

function AuthMetaBridge({ children }: { children: ReactNode }) {
  const { authSession, authHeader } = useAuth();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();

  return (
    <MetaProvider enabled={Boolean(authSession)} authHeader={authHeader} onBusyText={setBusyText} onNotice={pushNotice}>
      {children}
    </MetaProvider>
  );
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <BusyProvider>
        <NoticeProvider>
          <ProvidersInner>{children}</ProvidersInner>
        </NoticeProvider>
      </BusyProvider>
    </I18nProvider>
  );
}
