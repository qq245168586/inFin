import type { ActiveCoachSessionState, CoachSessionState, PlaybackSession, PlaybackSessionEnvelope } from "../models/playback";

export function activeSessionState(value: unknown): CoachSessionState {
  const state = String(value || "").toUpperCase();
  if (["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(state)) {
    return state as CoachSessionState;
  }
  return "IDLE";
}

export function normalizePlaybackSession(payload: PlaybackSessionEnvelope | null): PlaybackSession | null {
  const session = payload?.session || payload?.data || null;
  if (!session?.id) {
    return null;
  }
  return {
    ...session,
    state: activeSessionState(session.state) === "IDLE" ? "PREVIEW" : (activeSessionState(session.state) as ActiveCoachSessionState),
    accountNamespace: String(session.accountNamespace || ""),
    scheduleId: String(session.scheduleId || ""),
    courseId: Number(session.courseId || 0),
    version: Math.max(1, Number(session.version || 1)),
    serverNowMs: Number(payload?.serverNowMs || session.serverNowMs || Date.now())
  };
}

export function sessionStateLabel(value: CoachSessionState): string {
  if (value === "SCHEDULED") {
    return "SYNCING";
  }
  if (value === "RUNNING") {
    return "LIVE";
  }
  if (value === "PAUSED") {
    return "PAUSED";
  }
  if (value === "PREVIEW") {
    return "PREVIEW";
  }
  if (value === "ENDED" || value === "TERMINATED") {
    return "ENDED";
  }
  return "IDLE";
}

export function buildScheduleBadge(value: CoachSessionState) {
  if (value !== "IDLE") {
    if (value === "SCHEDULED") {
      return { label: "SYNCING", tone: "scheduled" };
    }
    if (value === "RUNNING") {
      return { label: "LIVE", tone: "live" };
    }
    if (value === "PAUSED") {
      return { label: "PAUSED", tone: "paused" };
    }
    if (value === "PREVIEW") {
      return { label: "PREVIEW", tone: "preview" };
    }
    return { label: "已结束", tone: "ended" };
  }
  return { label: "可开课", tone: "idle" };
}
