export type NavKey = "home" | "courses" | "actions" | "templates" | "venues" | "appVersions";
export type HomeTabKey = "currentWeek" | "lastWeek" | "history";

export const NAV_ITEMS: Array<{ key: NavKey; label: string; short: string }> = [
  { key: "home", label: "首页", short: "H" },
  { key: "courses", label: "课程", short: "C" },
  { key: "actions", label: "动作库", short: "A" },
  { key: "templates", label: "课程模板", short: "T" },
  { key: "venues", label: "场馆管理", short: "M" },
  { key: "appVersions", label: "应用版本", short: "V" }
];

export const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "currentWeek", label: "本周" },
  { key: "lastWeek", label: "上周" },
  { key: "history", label: "历史排课" }
];
