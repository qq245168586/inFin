import { requestJson } from "../requestJson.ts";
import type { MediaRecord } from "../../models/media.ts";
import type { CourseRecord } from "../../models/course/types.ts";
import type { CoursePackageRecord } from "../../pages/venues/types.ts";

export interface TypeOption {
  id: number;
  name: string;
}

export interface ActionRecord {
  id: number;
  name: string;
  typeIds: number[];
  media: MediaRecord | null;
  createTime: string;
  updateTime: string;
}

export interface ScheduleRecord {
  id: number;
  courseId: number;
  coursePackageId?: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

export interface ScheduleCollection {
  currentWeek: ScheduleRecord[];
  lastWeek: ScheduleRecord[];
  history: ScheduleRecord[];
}

export interface WaterfallTemplateRecord {
  id: number;
  kind: "warmup" | "cooldown";
  name: string;
  section: import("../../models/course/types.ts").WaterfallSection;
  updateTime: string;
}

export interface TrainingTemplateRecord {
  id: number;
  kind: "training";
  name: string;
  videoGroup: import("../../models/course/types.ts").VideoGroup;
  updateTime: string;
}

export interface TemplateCollections {
  warmup: WaterfallTemplateRecord[];
  cooldown: WaterfallTemplateRecord[];
  training: TrainingTemplateRecord[];
}

export interface MetaPayload {
  actionTypes: TypeOption[];
  lessonTypes: TypeOption[];
  actions: ActionRecord[];
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  templates: TemplateCollections;
  schedules: ScheduleCollection;
  now: string;
}

export async function fetchMeta(authHeader = ""): Promise<MetaPayload> {
  return await requestJson<MetaPayload>("/api/meta", {
    headers: authHeader ? { Authorization: authHeader } : {}
  });
}
