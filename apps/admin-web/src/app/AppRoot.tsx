import { useMemo, useState } from "react";
import AdminShell from "./AdminShell.tsx";
import type { NavKey } from "./navigation.ts";
import HomeRoute from "../pages/home/HomeRoute.tsx";
import CoursesRoute from "../pages/courses/CoursesRoute.tsx";
import ActionsRoute from "../pages/actions/ActionsRoute.tsx";
import TemplatesPage from "../pages/templates/TemplatesPage.tsx";
import VenueManagementPage from "../pages/venues/VenueManagementPage.tsx";
import AppVersionsPage from "../AppVersionsPage.tsx";
import LoginPage from "../pages/auth/LoginPage.tsx";
import TypeDialog, { type TypeDialogStateValue } from "../components/TypeDialog.tsx";
import { useAuth } from "../providers/AuthProvider.tsx";
import { useBusy } from "../providers/BusyProvider.tsx";
import { useMeta } from "../providers/MetaProvider.tsx";
import { useNotice } from "../providers/NoticeProvider.tsx";
import { requestJson } from "../services/requestJson.ts";
import { getErrorMessage } from "../utils/errors.ts";

type TypeDialogState = TypeDialogStateValue;

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface TypeOption {
  id: number;
  name: string;
}

export default function AppRoot() {
  const { authReady, authSession, loginForm, setLoginForm, login, logout } = useAuth();
  const { busyText, setBusyText } = useBusy();
  const { notice, pushNotice } = useNotice();
  const { appData, reloadMeta } = useMeta();

  const [activePage, setActivePage] = useState<NavKey>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [typeDialog, setTypeDialog] = useState<TypeDialogState | null>(null);

  const templateCollections = useMemo(() => appData?.templates, [appData?.templates]);

  async function confirmTypeDialog() {
    if (!typeDialog?.value.trim()) {
      pushNotice("名称不能为空。", "error");
      return;
    }

    setBusyText(typeDialog.kind === "action" ? "正在添加动作分类..." : "正在添加课程分类...");

    try {
      await requestJson<ApiResponse<TypeOption>>(
        typeDialog.kind === "action" ? "/api/action-types" : "/api/lesson-types",
        {
          method: "POST",
          body: JSON.stringify({ name: typeDialog.value.trim() })
        }
      );
      await reloadMeta();
      setTypeDialog(null);
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

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
        {activePage === "home" ? <HomeRoute /> : null}
        {activePage === "courses" ? <CoursesRoute onAddLessonType={() => setTypeDialog({ kind: "lesson", value: "" })} /> : null}
        {activePage === "actions" ? <ActionsRoute onAddActionType={() => setTypeDialog({ kind: "action", value: "" })} /> : null}
        {activePage === "templates" ? (
          <TemplatesPage
            templateCollections={templateCollections || { warmup: [], cooldown: [], training: [] }}
            actions={appData?.actions || []}
            onReloadMeta={reloadMeta}
            onBusyTextChange={setBusyText}
            onNotice={pushNotice}
          />
        ) : null}
        {activePage === "venues" ? (
          <VenueManagementPage tokenType={authSession.token_type} accessToken={authSession.access_token} onNotice={pushNotice} />
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

      {typeDialog ? (
        <TypeDialog
          state={typeDialog}
          onClose={() => setTypeDialog(null)}
          onConfirm={() => void confirmTypeDialog()}
          onStateChange={(updater) => setTypeDialog((current) => (current ? updater(current) : current))}
        />
      ) : null}

      {notice ? <div className={`notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div> : null}
      {busyText ? <div className="busy-mask">{busyText}</div> : null}
    </>
  );
}
