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
  password?: string;
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
  accountNamespace?: string;
  screenNumber: number;
  orientation: "HORIZONTAL" | "VERTICAL";
  previousAccountNamespace?: string;
  previousScreenNumber?: number;
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  unboundAt?: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  venueId?: string;
  venueName?: string;
  previousVenueId?: string;
  previousVenueName?: string;
  bindingState?: "BOUND" | "UNBOUND";
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

export interface TvDevicesPayload {
  generatedAt: string;
  devices: TvScreenSnapshot[];
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
