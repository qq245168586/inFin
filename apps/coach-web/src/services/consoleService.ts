import type { AuthSession } from "../models/common";
import type { PlaybackSession, PlaybackSessionEnvelope } from "../models/playback";
import type { TvDailyBundle, TvDailySchedule, VenueCoursePackagesPayload } from "../models/schedule";
import { COURSE_TIME_ZONE, scheduleStartAtMs } from "../utils/time";
import { createCommandId } from "../utils/format";
import { normalizePlaybackSession } from "../utils/playback";
import { authHeaders, requestJson } from "./apiClient";

export function bundleUrl(dateValue: string, authSession?: AuthSession): string {
  const params = new URLSearchParams({
    date: dateValue,
    timeZone: COURSE_TIME_ZONE
  });
  const accountNamespace = String(authSession?.accountNamespace || "").trim();
  if (accountNamespace) {
    params.set("accountNamespace", accountNamespace);
  }
  return `/api/tv/daily-bundle?${params.toString()}`;
}

export function venueQuery(authSession: AuthSession, isSuperAdmin: boolean, schedule?: TvDailySchedule | null, session?: PlaybackSession | null) {
  const params = new URLSearchParams();
  const venueId = String(schedule?.venueId || authSession.venueId || "").trim();
  const accountNamespace = String(schedule?.accountNamespace || session?.accountNamespace || (!isSuperAdmin ? authSession.accountNamespace : "") || "").trim();
  if (venueId) {
    params.set("venueId", venueId);
  } else if (accountNamespace) {
    params.set("accountNamespace", accountNamespace);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function venueBody(authSession: AuthSession, isSuperAdmin: boolean, body: Record<string, unknown>, schedule?: TvDailySchedule | null, session?: PlaybackSession | null) {
  const venueId = String(schedule?.venueId || authSession.venueId || "").trim();
  const accountNamespace = String(schedule?.accountNamespace || session?.accountNamespace || (!isSuperAdmin ? authSession.accountNamespace : "") || "").trim();
  return {
    ...body,
    ...(venueId ? { venueId } : {}),
    ...(accountNamespace ? { accountNamespace } : {})
  };
}

export async function fetchDailyBundle(dateValue: string, authSession?: AuthSession): Promise<TvDailyBundle> {
  return requestJson<TvDailyBundle>(bundleUrl(dateValue, authSession));
}

export async function publishTvControl(authSession: AuthSession, payload: Record<string, unknown>) {
  return requestJson<{ ok: boolean }>("/api/tv/control", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify(payload)
  });
}

export async function fetchCurrentPlayback(authSession: AuthSession, query: string): Promise<PlaybackSession | null> {
  const payload = await requestJson<PlaybackSessionEnvelope>(`/api/tv/playback-sessions/current${query}`, {
    headers: authHeaders(authSession.token_type, authSession.access_token)
  });
  return normalizePlaybackSession(payload);
}

export async function createPreviewSession(authSession: AuthSession, schedule: TvDailySchedule): Promise<PlaybackSession | null> {
  const payload = await requestJson<PlaybackSessionEnvelope>("/api/tv/playback-sessions/preview", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({
      commandId: createCommandId(),
      scheduleId: String(schedule.id),
      venueId: String(schedule.venueId || ""),
      accountNamespace: String(schedule.accountNamespace || ""),
      courseId: schedule.courseId,
      scheduledStartAtMs: scheduleStartAtMs(schedule),
      bundleChecksum: String(schedule.contentChecksum || "")
    })
  });
  return normalizePlaybackSession(payload);
}

export async function startScheduleSession(authSession: AuthSession, schedule: TvDailySchedule, body: Record<string, unknown>): Promise<PlaybackSession | null> {
  const payload = await requestJson<PlaybackSessionEnvelope>("/api/tv/playback-sessions/start-from-schedule", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({
      ...body,
      scheduleId: String(schedule.id),
      venueId: String(schedule.venueId || ""),
      accountNamespace: String(schedule.accountNamespace || ""),
      courseId: schedule.courseId,
      scheduledStartAtMs: scheduleStartAtMs(schedule),
      bundleChecksum: String(schedule.contentChecksum || "")
    })
  });
  return normalizePlaybackSession(payload);
}

export async function mutatePlaybackSession(authSession: AuthSession, path: string, body: Record<string, unknown>) {
  const payload = await requestJson<PlaybackSessionEnvelope>(path, {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify(body)
  });
  return normalizePlaybackSession(payload);
}

export async function showCoursePlanOnTv(authSession: AuthSession, body: Record<string, unknown>) {
  return requestJson<{ ok: boolean }>("/api/tv/course-plan/show", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify(body)
  });
}

export async function fetchVenueCoursePackages(authSession: AuthSession): Promise<VenueCoursePackagesPayload> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload }>("/api/coach/course-packages", {
    headers: authHeaders(authSession.token_type, authSession.access_token)
  });
  return normalizeVenueCoursePackagesPayload(payload.data);
}

export async function switchActiveCoursePackage(authSession: AuthSession, coursePackageId: number, commandId: string): Promise<VenueCoursePackagesPayload> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload; warning?: string }>("/api/coach/active-course-package", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({ coursePackageId, commandId })
  });
  return {
    ...normalizeVenueCoursePackagesPayload(payload.data),
    warning: String(payload.warning || "").trim()
  };
}

function normalizeVenueCoursePackagesPayload(payload: VenueCoursePackagesPayload): VenueCoursePackagesPayload {
  const packages = Array.isArray(payload.packages) ? payload.packages : Array.isArray(payload.items) ? payload.items : [];
  const venue = payload.venue || {
    id: String(payload.venueId || ""),
    name: String(payload.venueName || ""),
    accountNamespace: String(payload.accountNamespace || ""),
    activeCoursePackageId: payload.activeCoursePackageId
  };
  const activeCoursePackageId = Number(payload.activeCoursePackageId || venue.activeCoursePackageId || packages[0]?.id || 0);
  return {
    ...payload,
    venue: {
      ...venue,
      activeCoursePackageId
    },
    packages,
    items: packages,
    activeCoursePackageId
  };
}
