export function buildCoursePackageRequestHeaders(
  authHeader: string,
  coursePackageId?: number | null
): Record<string, string> {
  return {
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(Number(coursePackageId) > 0
      ? { "X-Course-Package-Id": String(Number(coursePackageId)) }
      : {})
  };
}
