import type { CourseRecord } from "../../models/course/types.ts";
import { requestJson } from "../requestJson.ts";
import { buildCoursePackageRequestHeaders } from "./coursePackageContext.ts";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export async function fetchCourseDetail(
  courseId: number | string,
  authHeader = "",
  requestCoursePackageId?: number | null
): Promise<CourseRecord> {
  const response = await requestJson<ApiResponse<CourseRecord>>(`/api/courses/${courseId}`, {
    headers: buildCoursePackageRequestHeaders(authHeader, requestCoursePackageId)
  });

  return response.data;
}
