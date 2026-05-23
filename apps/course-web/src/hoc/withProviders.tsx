import type { ComponentType, ReactNode } from "react";
import BusyProvider, { useBusy } from "../providers/BusyProvider.tsx";
import NoticeProvider, { useNotice } from "../providers/NoticeProvider.tsx";
import AuthProvider, { useAuth } from "../providers/AuthProvider.tsx";
import MetaProvider from "../providers/MetaProvider.tsx";

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NoticeProvider>
      <BusyProvider>
        <ProvidersWithHooks>{children}</ProvidersWithHooks>
      </BusyProvider>
    </NoticeProvider>
  );
}

function ProvidersWithHooks({ children }: { children: ReactNode }) {
  const { pushNotice } = useNotice();
  const { setBusyText } = useBusy();

  return (
    <AuthProvider onNotice={pushNotice} onBusyText={setBusyText}>
      <MetaProviderGate onBusyText={setBusyText} onNotice={pushNotice}>
        {children}
      </MetaProviderGate>
    </AuthProvider>
  );
}

function MetaProviderGate({
  children,
  onBusyText,
  onNotice
}: {
  children: ReactNode;
  onBusyText: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  const { authReady, authSession, authHeader } = useAuth();
  const enabled = Boolean(authReady && authSession?.access_token);

  return (
    <MetaProvider enabled={enabled} authHeader={authHeader} onBusyText={onBusyText} onNotice={onNotice}>
      {children}
    </MetaProvider>
  );
}

export function withProviders<P>(Wrapped: ComponentType<P>) {
  return function WithProviders(props: P) {
    return (
      <AppProviders>
        <Wrapped {...props} />
      </AppProviders>
    );
  };
}
