import { useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "./AdminShell.tsx";
import type { NavKey } from "./navigation.ts";
import HomeRoute from "../pages/home/HomeRoute.tsx";
import CoursesRoute from "../pages/courses/CoursesRoute.tsx";
import ActionsRoute from "../pages/actions/ActionsRoute.tsx";
import TemplatesPage from "../pages/templates/TemplatesPage.tsx";
import LoginPage from "../pages/auth/LoginPage.tsx";
import TypeDialog, { type TypeDialogStateValue } from "../components/TypeDialog.tsx";
import { useAuth } from "../providers/AuthProvider.tsx";
import { useBusy } from "../providers/BusyProvider.tsx";
import { useMeta } from "../providers/MetaProvider.tsx";
import { useNotice } from "../providers/NoticeProvider.tsx";
import { requestJson } from "../services/requestJson.ts";
import { getErrorMessage } from "../utils/errors.ts";
import { stripMediaSuffix } from "../utils/typeNames.ts";

type TypeDialogState = TypeDialogStateValue;

interface CourseEditorOpenRequest {
  courseId: number;
  requestId: number;
}

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
  const [typeDialog, setTypeDialog] = useState<TypeDialogState | null>(null);
  const [selectedCoursePackageId, setSelectedCoursePackageId] = useState("");
  const [courseEditorOpenRequest, setCourseEditorOpenRequest] = useState<CourseEditorOpenRequest | null>(null);
  const loadedCoursePackageIdRef = useRef("");

  const templateCollections = useMemo(() => appData?.templates, [appData?.templates]);
  const coursePackages = useMemo(() => appData?.coursePackages || [], [appData?.coursePackages]);
  const coursePackageIdsSignature = useMemo(() => coursePackages.map((item) => item.id).join("|"), [coursePackages]);
  const coursePackageStorageKey = useMemo(
    () => `infini-course-package:${authSession?.username || authSession?.id || "anonymous"}`,
    [authSession?.id, authSession?.username]
  );
  const selectedCoursePackage = useMemo(
    () => coursePackages.find((item) => String(item.id) === String(selectedCoursePackageId)) || coursePackages[0] || null,
    [coursePackages, selectedCoursePackageId]
  );

  useEffect(() => {
    if (!authSession) {
      setSelectedCoursePackageId("");
      return;
    }

    const availableIds = coursePackages.map((item) => String(item.id));
    if (!availableIds.length) {
      setSelectedCoursePackageId("");
      return;
    }

    setSelectedCoursePackageId((current) => {
      if (availableIds.includes(String(current))) {
        return current;
      }

      const saved = window.localStorage.getItem(coursePackageStorageKey) || "";
      if (availableIds.includes(saved)) {
        return saved;
      }

      return availableIds[0];
    });
  }, [authSession, coursePackageIdsSignature, coursePackageStorageKey, coursePackages]);

  useEffect(() => {
    if (!authSession || !selectedCoursePackageId) return;
    window.localStorage.setItem(coursePackageStorageKey, selectedCoursePackageId);
  }, [authSession, coursePackageStorageKey, selectedCoursePackageId]);

  useEffect(() => {
    if (!authSession || !selectedCoursePackageId) {
      loadedCoursePackageIdRef.current = "";
      return;
    }

    const nextCoursePackageId = String(selectedCoursePackageId);
    if (loadedCoursePackageIdRef.current === nextCoursePackageId) {
      return;
    }

    loadedCoursePackageIdRef.current = nextCoursePackageId;
    void reloadMeta({
      label: "正在加载课程包...",
      coursePackageId: Number(nextCoursePackageId)
    });
  }, [authSession, reloadMeta, selectedCoursePackageId]);

  async function confirmTypeDialog() {
    const cleanedTypeName = stripMediaSuffix(typeDialog?.value || "");
    if (!cleanedTypeName) {
      pushNotice("名称不能为空。", "error");
      return;
    }

    setBusyText(typeDialog.kind === "action" ? "正在添加动作分类..." : "正在添加课程分类...");

    try {
      await requestJson<ApiResponse<TypeOption>>(
        typeDialog.kind === "action" ? "/api/action-types" : "/api/lesson-types",
        {
          method: "POST",
          body: JSON.stringify({
            name: cleanedTypeName,
            coursePackageIds: selectedCoursePackage ? [Number(selectedCoursePackage.id)] : []
          })
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

  function openScheduleCourseEditor(courseId: number) {
    setCourseEditorOpenRequest({ courseId, requestId: Date.now() });
    setActivePage("courses");
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
        activePage={activePage}
        onActivePageChange={setActivePage}
        username={authSession.username || "admin"}
        coursePackages={coursePackages}
        selectedCoursePackageId={selectedCoursePackage ? String(selectedCoursePackage.id) : ""}
        onCoursePackageChange={setSelectedCoursePackageId}
        onLogout={() => logout()}
      >
        {activePage === "home" ? (
          <HomeRoute selectedCoursePackage={selectedCoursePackage} onOpenScheduleCourseEditor={openScheduleCourseEditor} />
        ) : null}
        {activePage === "courses" ? (
          <CoursesRoute
            selectedCoursePackage={selectedCoursePackage}
            courseEditRequest={courseEditorOpenRequest}
            onAddLessonType={() => setTypeDialog({ kind: "lesson", value: "" })}
          />
        ) : null}
        {activePage === "actions" ? <ActionsRoute selectedCoursePackage={selectedCoursePackage} /> : null}
        {activePage === "templates" ? (
          <TemplatesPage
            templateCollections={templateCollections || { warmup: [], cooldown: [], training: [], course: [] }}
            selectedCoursePackage={selectedCoursePackage}
            courses={appData?.courses || []}
            coursePackages={coursePackages}
            lessonTypes={appData?.lessonTypes || []}
            actions={appData?.actions || []}
            actionTypes={appData?.actionTypes || []}
            onAddLessonType={() => setTypeDialog({ kind: "lesson", value: "" })}
            onReloadMeta={reloadMeta}
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
