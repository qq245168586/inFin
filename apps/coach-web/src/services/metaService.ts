import type { MetaPayload, WeekScheduleRecord } from "../models/schedule";
import { requestJson } from "./apiClient";

export async function fetchCurrentWeekSchedules(): Promise<WeekScheduleRecord[]> {
  const payload = await requestJson<MetaPayload>("/api/meta");
  return payload.schedules?.currentWeek || [];
}

