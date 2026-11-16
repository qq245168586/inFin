import { requestJson } from "../requestJson.ts";
import type { ScheduleRecord } from "./meta.ts";

export interface CreateSchedulePayload {
  courseId: number;
  coursePackageId?: number;
  version: string;
  date: string;
  beginTime?: string;
  duration?: number;
}

export interface CopyWeekSchedulesPayload {
  coursePackageId: number;
  sourceWeekStart: string;
  targetWeekStart: string;
  replaceExisting: boolean;
}

export interface FetchWeekSchedulesParams {
  date: string;
  coursePackageId?: number | string | null;
}

export interface WeekSchedulesPayload {
  date: string;
  weekStart: string;
  weekEnd: string;
  weekEndExclusive?: string;
  schedules: ScheduleRecord[];
}

type WeekSchedulesResponse = WeekSchedulesPayload | { data?: WeekSchedulesPayload };

function normalizeWeekSchedulesPayload(payload: WeekSchedulesResponse): WeekSchedulesPayload {
  if ("data" in payload && payload.data) {
    return payload.data;
  }
  return payload as WeekSchedulesPayload;
}

export async function fetchWeekSchedules(
  { date, coursePackageId }: FetchWeekSchedulesParams,
  authHeader = ""
): Promise<WeekSchedulesPayload> {
  const params = new URLSearchParams({ date });
  const numericCoursePackageId = Number(coursePackageId || 0);
  if (numericCoursePackageId > 0) {
    params.set("coursePackageId", String(numericCoursePackageId));
  }

  const payload = await requestJson<WeekSchedulesResponse>(`/api/schedules/week?${params.toString()}`, {
    headers: authHeader ? { Authorization: authHeader } : {}
  });

  return normalizeWeekSchedulesPayload(payload);
}

export async function createSchedule(payload: CreateSchedulePayload, authHeader = ""): Promise<void> {
  await requestJson<void>("/api/schedules", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(payload)
  });
}

export async function copyWeekSchedules(payload: CopyWeekSchedulesPayload, authHeader = ""): Promise<void> {
  await requestJson<void>("/api/schedules/copy-week", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify(payload)
  });
}

export async function copyLastWeekSchedules(coursePackageId?: number, authHeader = ""): Promise<void> {
  await requestJson<void>("/api/schedules/copy-last-week", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: coursePackageId ? JSON.stringify({ coursePackageId }) : undefined
  });
}

export async function deleteSchedule(scheduleId: number, authHeader = ""): Promise<void> {
  await requestJson<void>(`/api/schedules/${scheduleId}`, {
    method: "DELETE",
    headers: authHeader ? { Authorization: authHeader } : {}
  });
}
