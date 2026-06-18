import { requestJson } from "../requestJson.ts";

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
