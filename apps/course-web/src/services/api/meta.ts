import { requestJson } from "../requestJson.ts";
import type { MediaRecord } from "../../models/media.ts";
import type { CourseRecord, CourseRotationType } from "../../models/course/types.ts";
import type { CoursePackageRecord } from "../../pages/venues/types.ts";
import type { TemplateCollections } from "../../models/templates.ts";

export interface TypeOption {
  id: number;
  name: string;
  coursePackageIds?: number[];
}

export interface ActionRecord {
  id: number;
  name: string;
  description?: string;
  author?: string;
  ownerUsername?: string;
  typeIds: number[];
  courseTags: string[];
  coursePackageIds?: number[];
  media: MediaRecord | null;
  createTime: string;
  updateTime: string;
}

export interface ScheduleRecord {
  id: number;
  courseId: number;
  courseDeleted?: boolean;
  coursePackageId?: number;
  courseName: string;
  version: string;
  date?: string;
  beginTime?: string;
  duration?: number;
  description?: string;
  topic?: string;
  rotationType?: CourseRotationType;
  stationText?: string;
}

export interface ScheduleCollection {
  currentWeek: ScheduleRecord[];
  lastWeek: ScheduleRecord[];
  history: ScheduleRecord[];
}

export interface MetaPayload {
  actionTypes: TypeOption[];
  lessonTypes: TypeOption[];
  actions: ActionRecord[];
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  templates: TemplateCollections;
  schedules: ScheduleCollection;
  coursesMode?: "summary" | "mixed" | "full";
  now: string;
}

export async function fetchMeta(
  authHeader = "",
  options: {
    coursePackageId?: number | null;
    courseId?: number | null;
    includeFullCourses?: boolean;
    includeSchedules?: boolean;
  } = {}
): Promise<MetaPayload> {
  const params = new URLSearchParams();
  if (options.includeFullCourses) {
    params.set("courseDetail", "full");
  }
  const coursePackageId = Number(options.coursePackageId || 0);
  if (coursePackageId > 0) {
    params.set("coursePackageId", String(coursePackageId));
  }
  const courseId = Number(options.courseId || 0);
  if (courseId > 0) {
    params.set("courseId", String(courseId));
    params.set("courseDetail", "full");
  }
  if (options.includeSchedules === false) {
    params.set("includeSchedules", "0");
  }

  const query = params.toString();
  return await requestJson<MetaPayload>(`/api/meta${query ? `?${query}` : ""}`, {
    headers: authHeader ? { Authorization: authHeader } : {}
  });
}
