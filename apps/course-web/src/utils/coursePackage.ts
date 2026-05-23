import type { ScheduleCollection } from "../services/api/meta.ts";
import type { CourseRecord } from "../models/course/types.ts";
import type { CoursePackageRecord } from "../pages/venues/types.ts";

export function filterCoursesByCoursePackage(
  courses: CourseRecord[],
  coursePackage: CoursePackageRecord | null | undefined
): CourseRecord[] {
  if (!coursePackage) return courses;
  const allowedIds = new Set((coursePackage.courseIds || []).map(Number));
  if (!allowedIds.size) return [];
  return courses.filter((course) => allowedIds.has(Number(course.id)));
}

export function filterSchedulesByCoursePackage(
  schedules: ScheduleCollection,
  coursePackageId: number | string | null | undefined
): ScheduleCollection {
  const numericPackageId = Number(coursePackageId) || 0;
  if (!numericPackageId) return schedules;
  const filterList = (items: ScheduleCollection[keyof ScheduleCollection]) =>
    items.filter((item) => Number(item.coursePackageId) === numericPackageId);

  return {
    currentWeek: filterList(schedules.currentWeek),
    lastWeek: filterList(schedules.lastWeek),
    history: filterList(schedules.history)
  };
}
