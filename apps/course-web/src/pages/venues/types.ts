export type NoticeFn = (message: string, tone?: "success" | "error") => void;

export interface VenueRecord {
  id: string;
  name: string;
  accountNamespace: string;
  coursePackageIds?: number[];
  activeCoursePackageId?: number;
  createTime: string;
  updateTime: string;
}

export interface ConsoleUser {
  id: number;
  username: string;
  nickname: string;
  accountNamespace: string;
  role?: string;
  venueId?: string;
  allowedClients?: string[];
  coursePackageIds?: number[];
}

export interface CoursePackageRecord {
  id: number;
  name: string;
  description: string;
  courseIds: number[];
  courseCount: number;
  accessScope?: "PACKAGE_ONLY" | "GLOBAL";
  isDefault?: boolean;
  createTime: string;
  updateTime: string;
}

export interface VenueCoursePackagesPayload {
  venueId: string;
  activeCoursePackageId: number;
  running: boolean;
  items: CoursePackageRecord[];
}

export interface TvScreenSnapshot {
  screenNumber: number;
  orientation: "HORIZONTAL" | "VERTICAL";
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  updateState: string;
  updateTargetVersion: string;
  updateProgressPercent: number;
  updateMessage: string;
  cacheBytes: number;
  cacheFileCount: number;
  cacheUpdatedAt: string;
}

export interface TvScreensPayload {
  generatedAt: string;
  screens: TvScreenSnapshot[];
  unboundDevices: TvScreenSnapshot[];
}

export interface AppPackageRecord {
  id: number;
  platform: "tv" | "coach";
  version: string;
  label: string;
  filename: string;
  checksum: string;
  sizeBytes: number;
  notes: string;
  createTime: string;
  updateTime: string;
  downloadPath: string;
}

export interface AppPackageListPayload {
  generatedAt: string;
  storageDirectory: string;
  packages: AppPackageRecord[];
}

export interface TvInstallAppUpdateCommand {
  type: "install_app_update";
  source: "admin-web";
  deviceId: string;
  screenNumber: number;
  accountNamespace: string;
  venueId: string;
  packageId: number;
  platform: AppPackageRecord["platform"];
  version: string;
  label: string;
  filename: string;
  checksum: string;
  sizeBytes: number;
  downloadUrl: string;
  requestedAt: number;
}
