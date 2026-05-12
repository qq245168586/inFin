import type { BarcodeDetectorConstructorShape, ParsedPairPayload } from "../models/screens";

export function stateLabel(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "SYNCING":
      return "同步中";
    case "PREVIEW":
      return "预览中";
    case "RUNNING":
      return "上课中";
    case "PAUSED":
      return "已暂停";
    default:
      return "待机";
  }
}

export function stateTone(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "SYNCING":
      return "syncing";
    case "PREVIEW":
      return "preview";
    case "RUNNING":
      return "running";
    case "PAUSED":
      return "paused";
    default:
      return "idle";
  }
}

export function updateStateLabel(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "DOWNLOADING":
      return "下载中";
    case "DOWNLOADED":
      return "待安装";
    case "INSTALLING":
      return "安装中";
    case "ERROR":
      return "安装失败";
    default:
      return "待机";
  }
}

export function updateStateTone(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "DOWNLOADING":
      return "syncing";
    case "DOWNLOADED":
      return "preview";
    case "INSTALLING":
      return "running";
    case "ERROR":
      return "paused";
    default:
      return "idle";
  }
}

export function parsePairPayload(rawValue: string): ParsedPairPayload | null {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "infini-tv:" && parsed.protocol !== "infini-tv-pair:") {
      return null;
    }
    const deviceId = String(parsed.searchParams.get("deviceId") || "").trim();
    const pairToken = String(parsed.searchParams.get("pairToken") || "").trim().toUpperCase();
    return deviceId && pairToken ? { deviceId, pairToken, raw } : null;
  } catch {
    const fallbackMatch = raw.match(/deviceId=([^&\s]+).*pairToken=([^&\s]+)/i);
    if (!fallbackMatch) {
      return null;
    }
    return {
      deviceId: decodeURIComponent(fallbackMatch[1]).trim(),
      pairToken: decodeURIComponent(fallbackMatch[2]).trim().toUpperCase(),
      raw
    };
  }
}

export function barcodeDetectorApi(): BarcodeDetectorConstructorShape | undefined {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructorShape }).BarcodeDetector;
}

