import { type ReactNode } from "react";
import { NAV_ITEMS, type NavKey } from "./navigation.ts";
import { useI18n } from "../providers/I18nProvider.tsx";
import type { CoursePackageRecord } from "../pages/venues/types.ts";

export default function AdminShell({
  activePage,
  onActivePageChange,
  username,
  coursePackages,
  selectedCoursePackageId,
  onCoursePackageChange,
  onLogout,
  children
}: {
  activePage: NavKey;
  onActivePageChange: (next: NavKey) => void;
  username: string;
  coursePackages: CoursePackageRecord[];
  selectedCoursePackageId: string;
  onCoursePackageChange: (next: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { locale, locales, setLocale } = useI18n();

  return (
    <div className="admin-shell course-shell">
      <div className="workspace">
        <header className="course-topbar">
          <div className="course-topbar-main">
            <div className="course-brand">
              <div className="brand-wordmark">INFINI</div>
              <div>
                <p className="workspace-kicker">Course Studio</p>
                <strong>课程编辑端</strong>
              </div>
            </div>
            <nav className="top-nav-tabs" aria-label="课程编辑端导航">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`top-nav-tab ${activePage === item.key ? "is-active" : ""}`}
                onClick={() => onActivePageChange(item.key)}
              >
                <span className="nav-icon">{item.short}</span>
                <span>{item.label}</span>
              </button>
            ))}
            </nav>
            <div className="course-topbar-actions">
              {!coursePackages.length ? (
                <div className="course-package-context is-empty">
                  <span>当前课程包</span>
                  <strong>未授权课程包</strong>
                </div>
              ) : coursePackages.length === 1 ? (
                <div className="course-package-context">
                  <span>当前课程包</span>
                  <strong>{coursePackages[0].name}</strong>
                </div>
              ) : (
                <label className="course-package-context is-select">
                  <span>当前课程包</span>
                  <select value={selectedCoursePackageId} onChange={(event) => onCoursePackageChange(event.target.value)}>
                    {coursePackages.map((coursePackage) => (
                      <option key={coursePackage.id} value={coursePackage.id}>
                        {coursePackage.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="language-switcher">
                <span>语言</span>
                <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
                  {locales.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="user-pill">
                <strong>{username}</strong>
                <span>已登录账号</span>
              </div>
              <button type="button" className="ghost-button" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </div>
        </header>

        <main className="workspace-body">{children}</main>
      </div>
    </div>
  );
}
