import type { CourseRecord } from "../../models/course/types.ts";
import { requestJson } from "../requestJson.ts";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export async function fetchCourseDetail(courseId: number | string, authHeader = ""): Promise<CourseRecord> {
  const response = await requestJson<ApiResponse<CourseRecord>>(`/api/courses/${courseId}`, {
    headers: authHeader ? { Authorization: authHeader } : {}
  });

  return response.data;
}
