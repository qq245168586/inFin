import type { CourseRecord } from "../models/course/types.ts";
import type { TemplateCollections, TemplateRecord } from "../models/templates.ts";
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

export function templateBelongsToCoursePackage(
  template: TemplateRecord,
  coursePackage?: CoursePackageRecord | null
): boolean {
  if (!coursePackage) return true;

  const packageIds = template.coursePackageIds?.length
    ? template.coursePackageIds
    : template.coursePackageId
      ? [template.coursePackageId]
      : [];

  return packageIds.some((id) => Number(id) === Number(coursePackage.id));
}

export function filterTemplateCollectionsByCoursePackage(
  collections: TemplateCollections,
  coursePackage?: CoursePackageRecord | null
): TemplateCollections {
  return {
    warmup: collections.warmup.filter((template) => templateBelongsToCoursePackage(template, coursePackage)),
    cooldown: collections.cooldown.filter((template) => templateBelongsToCoursePackage(template, coursePackage)),
    training: collections.training.filter((template) => templateBelongsToCoursePackage(template, coursePackage)),
    course: collections.course.filter((template) => templateBelongsToCoursePackage(template, coursePackage))
  };
}
