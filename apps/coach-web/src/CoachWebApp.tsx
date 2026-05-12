import { BusyMask } from "./components/app/BusyMask";
import { CoachAppProvider, useCoachApp } from "./providers/CoachAppProvider";
import CoachShellPage from "./pages/CoachShellPage";
import LoginPage from "./pages/LoginPage";

function CoachAppContent() {
  const { authReady, authSession } = useCoachApp();

  if (!authReady) {
    return <BusyMask text="正在恢复登录..." standalone />;
  }

  return authSession ? <CoachShellPage /> : <LoginPage />;
}

export default function CoachWebApp() {
  return (
    <CoachAppProvider>
      <CoachAppContent />
    </CoachAppProvider>
  );
}

