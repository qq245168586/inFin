import { BusyMask } from "./components/app/BusyMask";
import { CoachAppProvider, useCoachApp } from "./providers/CoachAppProvider";
import I18nProvider, { useI18n } from "./providers/I18nProvider";
import CoachShellPage from "./pages/CoachShellPage";
import LoginPage from "./pages/LoginPage";

function CoachAppContent() {
  const { authReady, authSession } = useCoachApp();
  const { t } = useI18n();

  if (!authReady) {
    return <BusyMask text={t("正在恢复登录...")} standalone />;
  }

  return authSession ? <CoachShellPage /> : <LoginPage />;
}

export default function CoachWebApp() {
  return (
    <I18nProvider>
      <CoachAppProvider>
        <CoachAppContent />
      </CoachAppProvider>
    </I18nProvider>
  );
}
