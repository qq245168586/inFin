import { useState } from "react";
import { BusyMask } from "../components/app/BusyMask";
import { CoachSettingsMenu } from "../components/app/CoachSettingsMenu";
import { CoachTopbar } from "../components/app/CoachTopbar";
import { NoticeToast } from "../components/app/NoticeToast";
import CoachConsolePage from "./CoachConsolePage";
import CoachScreensPage from "./CoachScreensPage";
import { useCoachApp } from "../providers/CoachAppProvider";

export default function CoachShellPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    activePage,
    authSession,
    busyText,
    currentWeekSchedules,
    handleLogout,
    handleSessionExpired,
    notice,
    pushNotice,
    setActivePage,
    setBusyText
  } = useCoachApp();

  if (!authSession) {
    return null;
  }

  return (
    <div className="coach-web-shell">
      <div className="coach-app-frame">
        <CoachTopbar authSession={authSession} onLogout={handleLogout} onOpenSettings={() => setSettingsOpen(true)} />
        <main className="coach-page-body">
          {activePage === "console" ? (
            <CoachConsolePage
              authSession={authSession}
              currentWeekSchedules={currentWeekSchedules}
              onBusyTextChange={setBusyText}
              onNotice={pushNotice}
              onAuthExpired={handleSessionExpired}
            />
          ) : (
            <CoachScreensPage
              authSession={authSession}
              onBusyTextChange={setBusyText}
              onNotice={pushNotice}
              onAuthExpired={handleSessionExpired}
            />
          )}
        </main>
      </div>

      {settingsOpen ? (
        <CoachSettingsMenu
          activePage={activePage}
          authSession={authSession}
          onBusyTextChange={setBusyText}
          onAuthExpired={handleSessionExpired}
          onClose={() => setSettingsOpen(false)}
          onNotice={pushNotice}
          onSelectPage={setActivePage}
        />
      ) : null}
      <NoticeToast notice={notice} />
      <BusyMask text={busyText} />
    </div>
  );
}
