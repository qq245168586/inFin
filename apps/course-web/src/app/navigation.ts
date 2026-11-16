export type NavKey = "home" | "courses" | "actions" | "templates";
export type HomeTabKey = "currentWeek" | "lastWeek" | "history";

export const NAV_ITEMS: Array<{ key: NavKey; label: string; short: string }> = [
  { key: "home", label: "首页", short: "H" },
  { key: "courses", label: "课程", short: "C" },
  { key: "actions", label: "动作库", short: "A" },
  { key: "templates", label: "课程模板", short: "T" }
];

export const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "currentWeek", label: "周课表" },
  { key: "lastWeek", label: "上周" },
  { key: "history", label: "全部排课" }
];
