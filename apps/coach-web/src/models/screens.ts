export interface TvScreenItem {
  screenNumber: number;
  orientation: "VERTICAL" | "HORIZONTAL" | "UNASSIGNED";
  accountNamespace?: string;
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  activeScheduleId: string;
  previewMode: boolean;
  playbackSessionId: string;
  bundleChecksum: string;
  playbackElapsedMs: number;
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
  screens: TvScreenItem[];
}

export interface TvScreenMutationPayload {
  ok: boolean;
  data?: TvScreenItem | null;
}

export interface AppPackageRecord {
  id: number;
  platform: "tv" | "coach";
  version: string;
  label: string;
}

export interface AppPackageListPayload {
  generatedAt: string;
  storageDirectory: string;
  packages: AppPackageRecord[];
}

export interface AppPackageEnvelope {
  data: AppPackageListPayload;
}

export interface ParsedPairPayload {
  raw: string;
  deviceId: string;
  pairToken: string;
}

export interface DetectedBarcode {
  rawValue?: string;
}

export interface BarcodeDetectorShape {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

export interface BarcodeDetectorConstructorShape {
  new (options?: { formats?: string[] }): BarcodeDetectorShape;
}

