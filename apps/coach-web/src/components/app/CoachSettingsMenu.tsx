import { useEffect, useState } from "react";
import type { AuthSession, CoachPageKey, NoticeTone } from "../../models/common";
import type { VenueCoursePackagesPayload } from "../../models/schedule";
import { fetchVenueCoursePackages, switchActiveCoursePackage } from "../../services/consoleService";
import { COACH_COURSE_PACKAGE_CHANGED_EVENT } from "../../utils/events";
import { createCommandId, getErrorMessage, isAuthExpiredMessage } from "../../utils/format";

interface CoachSettingsMenuProps {
  activePage: CoachPageKey;
  authSession: AuthSession;
  onClose: () => void;
  onSelectPage: (page: CoachPageKey) => void;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

export function CoachSettingsMenu({
  activePage,
  authSession,
  onBusyTextChange,
  onAuthExpired,
  onClose,
  onNotice,
  onSelectPage
}: CoachSettingsMenuProps) {
  const [coursePackagesPayload, setCoursePackagesPayload] = useState<VenueCoursePackagesPayload | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [pendingPackageId, setPendingPackageId] = useState<number>(0);
  const coursePackages = coursePackagesPayload?.packages || [];
  const activeCoursePackageId = Number(coursePackagesPayload?.activeCoursePackageId || 0);
  const packageSwitchDisabled = Boolean(coursePackagesPayload?.running || pendingPackageId);

  function selectPage(page: CoachPageKey) {
    onSelectPage(page);
    onClose();
  }

  function handleError(error: unknown, fallback: string) {
    const message = getErrorMessage(error) || fallback;
    if (isAuthExpiredMessage(message)) {
      onAuthExpired(message);
      return;
    }
    onNotice(message, "error");
  }

  async function loadCoursePackages(showError = false) {
    setLoadingPackages(true);
    try {
      setCoursePackagesPayload(await fetchVenueCoursePackages(authSession));
    } catch (error) {
      if (showError) {
        handleError(error, "加载课程包失败。");
      } else if (isAuthExpiredMessage(getErrorMessage(error))) {
        onAuthExpired(getErrorMessage(error));
      }
    } finally {
      setLoadingPackages(false);
    }
  }

  async function changeCoursePackage(coursePackageId: number) {
    if (!coursePackageId || coursePackageId === activeCoursePackageId || pendingPackageId) {
      return;
    }
    setPendingPackageId(coursePackageId);
    onBusyTextChange("正在切换课程包...");
    try {
      const payload = await switchActiveCoursePackage(authSession, coursePackageId, createCommandId());
      setCoursePackagesPayload(payload);
      window.dispatchEvent(new CustomEvent(COACH_COURSE_PACKAGE_CHANGED_EVENT, {
        detail: { activeCoursePackageId: payload.activeCoursePackageId || coursePackageId }
      }));
      onNotice(payload.warning || "课程包已切换，TV 会重新同步课表。", payload.warning ? "error" : undefined);
    } catch (error) {
      handleError(error, "切换课程包失败。");
    } finally {
      setPendingPackageId(0);
      onBusyTextChange("");
    }
  }

  useEffect(() => {
    void loadCoursePackages(false);
  }, [authSession.access_token, authSession.token_type]);

  return (
    <div className="coach-settings-layer" role="presentation" onClick={onClose}>
      <div className="coach-settings-popover" role="dialog" aria-modal="true" aria-label="设置" onClick={(event) => event.stopPropagation()}>
        <div className="coach-settings-head">
          <div>
            <span>设置</span>
            <strong>教练端管理</strong>
          </div>
          <button type="button" className="coach-settings-close" onClick={onClose} aria-label="关闭设置">
            ×
          </button>
        </div>
        <div className="coach-settings-group">
          <span className="coach-settings-group-title">课程包</span>
          {loadingPackages ? (
            <div className="coach-settings-empty">正在加载课程包...</div>
          ) : coursePackages.length ? (
            <>
              {coursePackages.map((item) => {
                const selected = Number(item.id) === activeCoursePackageId;
                const pending = Number(item.id) === pendingPackageId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`coach-settings-item coach-settings-package ${selected ? "is-active" : ""}`}
                    disabled={packageSwitchDisabled || selected}
                    onClick={() => void changeCoursePackage(Number(item.id))}
                  >
                    <span className="coach-settings-item-icon is-package" aria-hidden="true" />
                    <span>
                      <strong>{item.name}</strong>
                      <em>{pending ? "正在切换..." : selected ? "当前课表课程包" : "点击切换课表输出"}</em>
                    </span>
                  </button>
                );
              })}
              {coursePackagesPayload?.running ? (
                <div className="coach-settings-empty is-warning">课程正在运行，结束后才能切换课程包。</div>
              ) : null}
            </>
          ) : (
            <div className="coach-settings-empty">当前场馆没有绑定课程包。</div>
          )}
        </div>
        <div className="coach-settings-group">
          <span className="coach-settings-group-title">现场操作</span>
          <button
            type="button"
            className={`coach-settings-item ${activePage === "console" ? "is-active" : ""}`}
            onClick={() => selectPage("console")}
          >
            <span className="coach-settings-item-icon is-play" aria-hidden="true" />
            <span>
              <strong>课程控制</strong>
              <em>预览、开始、暂停和结束课程</em>
            </span>
          </button>
        </div>
        <div className="coach-settings-group">
          <span className="coach-settings-group-title">设备设置</span>
          <button
            type="button"
            className={`coach-settings-item ${activePage === "screens" ? "is-active" : ""}`}
            onClick={() => selectPage("screens")}
          >
            <span className="coach-settings-item-icon is-screen" aria-hidden="true" />
            <span>
              <strong>屏幕管理</strong>
              <em>绑定屏幕、清缓存和更新 TV</em>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
