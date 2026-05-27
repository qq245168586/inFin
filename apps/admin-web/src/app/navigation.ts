export type NavKey = "coursePackages" | "venues" | "devices" | "accounts" | "appVersions";
export type HomeTabKey = "currentWeek" | "lastWeek" | "history";

export const NAV_ITEMS: Array<{ key: NavKey; label: string; short: string }> = [
  { key: "coursePackages", label: "课程包", short: "P" },
  { key: "venues", label: "场馆管理", short: "M" },
  { key: "devices", label: "设备管理", short: "D" },
  { key: "accounts", label: "账号管理", short: "U" },
  { key: "appVersions", label: "应用版本", short: "V" }
];

export const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "currentWeek", label: "本周" },
  { key: "lastWeek", label: "上周" },
  { key: "history", label: "历史排课" }
];
