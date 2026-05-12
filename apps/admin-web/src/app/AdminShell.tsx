import { type ReactNode } from "react";
import { NAV_ITEMS, type NavKey } from "./navigation.ts";

export default function AdminShell({
  sidebarCollapsed,
  onSidebarCollapsedChange,
  activePage,
  onActivePageChange,
  username,
  onLogout,
  children
}: {
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (next: boolean) => void;
  activePage: NavKey;
  onActivePageChange: (next: NavKey) => void;
  username: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`admin-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className={`sidebar-edge-toggle ${sidebarCollapsed ? "is-collapsed" : ""}`}
        onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
        aria-label={sidebarCollapsed ? "展开导航" : "收起导航"}
      >
        <span>{sidebarCollapsed ? "›" : "‹"}</span>
      </button>

      <aside className="sidebar">
        <div>
          <div className="brand-lockup">
            <div className="traffic-lights">
              <span className="dot is-red" />
              <span className="dot is-yellow" />
              <span className="dot is-green" />
            </div>
            <div className="brand-wordmark">INFINI</div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activePage === item.key ? "is-active" : ""}`}
                onClick={() => onActivePageChange(item.key)}
              >
                <span className="nav-icon">{item.short}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-top">
          <div className="workspace-top-main">
            <div className="workspace-top-left">
              <div>
                <p className="workspace-kicker">Infini Admin</p>
                <strong>课程编辑端</strong>
              </div>
            </div>
            <div className="workspace-top-actions">
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
