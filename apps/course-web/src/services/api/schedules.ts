import { requestJson } from "../requestJson.ts";

export interface CreateSchedulePayload {
  courseId: number;
  coursePackageId?: number;
  version: string;
  beginTime: string;
  duration: number;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<void> {
  await requestJson<void>("/api/schedules", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function copyLastWeekSchedules(coursePackageId?: number): Promise<void> {
  await requestJson<void>("/api/schedules/copy-last-week", {
    method: "POST",
    body: coursePackageId ? JSON.stringify({ coursePackageId }) : undefined
  });
}

export async function deleteSchedule(scheduleId: number): Promise<void> {
  await requestJson<void>(`/api/schedules/${scheduleId}`, { method: "DELETE" });
}
