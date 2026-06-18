import type { CourseRecord } from "../models/course/types.ts";
import type { TemplateCollections, TemplateRecord } from "../models/templates.ts";
import type { CoursePackageRecord } from "../pages/venues/types.ts";
import type { ActionRecord, ScheduleRecord, TypeOption } from "../services/api/meta.ts";

interface CoursePackageScopedRecord {
  coursePackageIds?: number[];
}

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

export function recordBelongsToCoursePackage(
  record: CoursePackageScopedRecord,
  coursePackage?: CoursePackageRecord | null
): boolean {
  if (!coursePackage) return true;

  const coursePackageIds = (record.coursePackageIds || []).map(Number).filter(Boolean);
  if (!coursePackageIds.length) {
    return Boolean(coursePackage.isDefault);
  }
  return coursePackageIds.includes(Number(coursePackage.id));
}

export function filterActionsByCoursePackage<T extends ActionRecord>(
  actions: T[],
  coursePackage?: CoursePackageRecord | null
): T[] {
  return actions.filter((action) => recordBelongsToCoursePackage(action, coursePackage));
}

export function filterActionTypesByCoursePackage<T extends TypeOption>(
  actionTypes: T[],
  coursePackage?: CoursePackageRecord | null
): T[] {
  return actionTypes.filter((type) => recordBelongsToCoursePackage(type, coursePackage));
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
