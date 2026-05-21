import type { CoachPreviewItem, TvDailySchedule } from "../models/schedule";
import type { CoachSessionState } from "../models/playback";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败，请稍后重试。";
}

export function isAuthExpiredMessage(message: string): boolean {
  return /登录已失效|重新登录|refresh token 已失效|客户端凭证无效|请求失败 \(401\)|请求失败 \(403\)|用户名或密码错误/i.test(
    String(message || "")
  );
}

export function buildCourseLogo(courseName: string): string {
  const parts = String(courseName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts.map((item) => item[0]?.toUpperCase() || "").join("");
  return (letters || "IN").slice(0, 2);
}

function pickPreviewMediaUrl(card: {
  mediaUrl?: string;
  videoUrl?: string;
  url?: string;
  media?: { url?: string; src?: string };
  video?: { url?: string; src?: string };
}): string {
  return String(
    card.mediaUrl
      || card.videoUrl
      || card.url
      || card.media?.url
      || card.media?.src
      || card.video?.url
      || card.video?.src
      || ""
  ).trim();
}

export function buildFormalPreviews(schedule: TvDailySchedule | null): CoachPreviewItem[] {
  const previews: CoachPreviewItem[] = [];
  const training = schedule?.course?.script?.training;
  if (!training) {
    return previews;
  }
  let index = 0;

  for (const group of training.videoGroups || []) {
    const orderedScreens = [...(group.screens || [])].sort((left, right) => left.screenIndex - right.screenIndex);
    for (const screen of orderedScreens) {
      for (const card of screen.videoCards || []) {
        const mediaUrl = pickPreviewMediaUrl(card);
        if (!mediaUrl) {
          continue;
        }
        previews.push({
          id: `preview-${group.id}-${screen.id}-${card.id}-${index++}`,
          mediaUrl,
          actionName: String(card.actionName || "")
        });
      }
    }
  }

  return previews;
}

export function shortSessionId(value?: string): string {
  const text = String(value || "");
  if (!text) {
    return "--";
  }
  return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
}

export function createCommandId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isActiveSessionState(value: CoachSessionState): boolean {
  return value === "PREVIEW" || value === "SCHEDULED" || value === "RUNNING" || value === "PAUSED";
}

export function formatStorageBytes(value?: number): string {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = size;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const precision = current >= 100 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(precision)} ${units[unitIndex]}`;
}
