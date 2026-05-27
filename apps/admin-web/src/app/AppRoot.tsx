import { useState } from "react";
import AdminShell from "./AdminShell.tsx";
import type { NavKey } from "./navigation.ts";
import CoursePackagesPage from "../pages/coursePackages/CoursePackagesPage.tsx";
import DeviceManagementPage from "../pages/devices/DeviceManagementPage.tsx";
import VenueManagementPage from "../pages/venues/VenueManagementPage.tsx";
import AppVersionsPage from "../AppVersionsPage.tsx";
import AccountsPage from "../AccountsPage.tsx";
import LoginPage from "../pages/auth/LoginPage.tsx";
import { useAuth } from "../providers/AuthProvider.tsx";
import { useBusy } from "../providers/BusyProvider.tsx";
import { useMeta } from "../providers/MetaProvider.tsx";
import { useNotice } from "../providers/NoticeProvider.tsx";

export default function AppRoot() {
  const { authReady, authSession, loginForm, setLoginForm, login, logout } = useAuth();
  const { busyText, setBusyText } = useBusy();
  const { notice, pushNotice } = useNotice();
  const { reloadMeta } = useMeta();

  const [activePage, setActivePage] = useState<NavKey>("venues");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!authReady) {
    return <div className="busy-mask">正在恢复登录...</div>;
  }

  if (!authSession) {
    return (
      <>
        <LoginPage loginForm={loginForm} onLoginFormChange={setLoginForm} onLogin={() => void login()} />
        {notice ? <div className={`notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
        {busyText ? <div className="busy-mask">{busyText}</div> : null}
      </>
    );
  }

  return (
    <>
      <AdminShell
        sidebarCollapsed={sidebarCollapsed}
        onSidebarCollapsedChange={setSidebarCollapsed}
        activePage={activePage}
        onActivePageChange={setActivePage}
        username={authSession.username || "admin"}
        onLogout={() => logout()}
      >
        {activePage === "coursePackages" ? (
          <CoursePackagesPage
            authHeader={authSession ? `${authSession.token_type} ${authSession.access_token}` : ""}
            onNotice={pushNotice}
            onReloadMeta={reloadMeta}
          />
        ) : null}
        {activePage === "venues" ? (
          <VenueManagementPage tokenType={authSession.token_type} accessToken={authSession.access_token} onNotice={pushNotice} />
        ) : null}
        {activePage === "devices" ? (
          <DeviceManagementPage
            authHeader={authSession ? `${authSession.token_type} ${authSession.access_token}` : ""}
            onNotice={pushNotice}
          />
        ) : null}
        {activePage === "accounts" ? (
          <AccountsPage tokenType={authSession.token_type} accessToken={authSession.access_token} onNotice={pushNotice} />
        ) : null}
        {activePage === "appVersions" ? (
          <AppVersionsPage
            tokenType={authSession.token_type}
            accessToken={authSession.access_token}
            onBusyTextChange={setBusyText}
            onNotice={pushNotice}
          />
        ) : null}
      </AdminShell>

      {notice ? <div className={`notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
      {busyText ? <div className="busy-mask">{busyText}</div> : null}
    </>
  );
}
