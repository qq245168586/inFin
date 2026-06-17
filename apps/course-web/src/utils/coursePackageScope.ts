import type { CourseRecord } from "../models/course/types.ts";
import type { CoursePackageRecord } from "../pages/venues/types.ts";
import type { ScheduleRecord } from "../services/api/meta.ts";

export function filterCoursesByCoursePackage(
  courses: CourseRecord[],
  coursePackage?: CoursePackageRecord | null
): CourseRecord[] {
  if (!coursePackage) return courses;

  const courseIds = new Set((coursePackage.courseIds || []).map(Number));

  return courses.filter((course) => {
    if (Number(course.coursePackageId) === Number(coursePackage.id)) return true;
    return courseIds.has(Number(course.id));
  });
}

export function filterSchedulesByCoursePackage<T extends ScheduleRecord>(
  schedules: T[],
  coursePackage?: CoursePackageRecord | null
): T[] {
  if (!coursePackage) return schedules;

  return schedules.filter((schedule) => Number(schedule.coursePackageId) === Number(coursePackage.id));
}
