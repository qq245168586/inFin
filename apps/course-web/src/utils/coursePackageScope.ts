import type { CourseRecord } from "../models/course/types.ts";
import type { TemplateCollections, TemplateRecord } from "../models/templates.ts";
import type { CoursePackageRecord } from "../pages/venues/types.ts";
import type { ActionRecord, ScheduleRecord, TypeOption } from "../services/api/meta.ts";

interface CoursePackageScopedRecord {
  coursePackageId?: number | null;
  coursePackageIds?: number[];
}

export function isGlobalCoursePackage(coursePackage?: CoursePackageRecord | null): boolean {
  return coursePackage?.accessScope === "GLOBAL";
}

export function getResourceCoursePackageIds(
  record: CoursePackageScopedRecord,
  coursePackages: CoursePackageRecord[]
): number[] {
  const explicitIds = (record.coursePackageIds || []).map(Number).filter(Boolean);
  if (explicitIds.length) return [...new Set(explicitIds)];

  const directId = Number(record.coursePackageId) || 0;
  if (directId) return [directId];

  const defaultPackageId = Number(coursePackages.find((item) => item.isDefault)?.id) || 0;
  return defaultPackageId ? [defaultPackageId] : [];
}

export function getCrossPackageSourceLabel(
  record: CoursePackageScopedRecord,
  selectedCoursePackage: CoursePackageRecord | null | undefined,
  coursePackages: CoursePackageRecord[]
): string {
  if (!isGlobalCoursePackage(selectedCoursePackage)) return "";

  const ownerIds = getResourceCoursePackageIds(record, coursePackages);
  if (!ownerIds.length || ownerIds.includes(Number(selectedCoursePackage?.id))) return "";

  return ownerIds
    .map((id) => coursePackages.find((item) => Number(item.id) === id)?.name || `课程包 ${id}`)
    .join(" / ");
}

export function resolveExistingCoursePackageId(
  resourceCoursePackageId: number | null | undefined,
  selectedCoursePackageId: number | null | undefined
): number | null {
  return Number(resourceCoursePackageId) || Number(selectedCoursePackageId) || null;
}

export function resolveActionWriteCoursePackageIds(
  existingCoursePackageIds: number[] | null | undefined,
  isExisting: boolean,
  selectedCoursePackageId: number | null | undefined
): number[] {
  if (isExisting) {
    return [...new Set((existingCoursePackageIds || []).map(Number).filter(Boolean))];
  }
  const selectedId = Number(selectedCoursePackageId) || 0;
  return selectedId ? [selectedId] : [];
}

export function recordMatchesCoursePackageIds(
  record: CoursePackageScopedRecord,
  targetCoursePackageIds: number[],
  coursePackages: CoursePackageRecord[]
): boolean {
  const targets = new Set(targetCoursePackageIds.map(Number).filter(Boolean));
  return getResourceCoursePackageIds(record, coursePackages).some((id) => targets.has(id));
}

export function filterCoursesByCoursePackage(
  courses: CourseRecord[],
  coursePackage?: CoursePackageRecord | null
): CourseRecord[] {
  if (!coursePackage) return courses;
  if (isGlobalCoursePackage(coursePackage)) return courses;

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
  if (isGlobalCoursePackage(coursePackage)) return true;

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
  if (isGlobalCoursePackage(coursePackage)) return true;

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
