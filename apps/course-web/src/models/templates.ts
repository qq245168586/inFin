import type { CourseScript, CourseSummary, VideoGroup, WaterfallSection } from "./course/types.ts";
import type { MediaRecord } from "./media.ts";
import {
  cloneCourseScriptWithFreshIds,
  cloneVideoGroupForEditor,
  cloneWaterfallSectionForEditor,
  getVideoGroupCardCount,
  getWaterfallSectionTotal
} from "./course/factories.ts";
import { formatSecondsLabel } from "../utils/datetime.ts";

export type SegmentTemplateKind = "warmup" | "cooldown" | "training";
export type TemplateKind = SegmentTemplateKind | "course";

export interface WaterfallTemplateRecord {
  id: number;
  kind: "warmup" | "cooldown";
  name: string;
  section: WaterfallSection;
  updateTime: string;
}

export interface TrainingTemplateRecord {
  id: number;
  kind: "training";
  name: string;
  videoGroup: VideoGroup;
  updateTime: string;
}

export interface CourseTemplateRecord {
  id: number;
  kind: "course";
  name: string;
  courseName: string;
  logoMedia: MediaRecord | null;
  typeIds: number[];
  script: CourseScript;
  coursePackageId?: number | null;
  coursePackageIds?: number[];
  summary?: CourseSummary | null;
  sourceCourseId?: number | null;
  updateTime: string;
}

export type TemplateRecord = WaterfallTemplateRecord | TrainingTemplateRecord | CourseTemplateRecord;

export interface TemplateCollections {
  warmup: WaterfallTemplateRecord[];
  cooldown: WaterfallTemplateRecord[];
  training: TrainingTemplateRecord[];
  course: CourseTemplateRecord[];
}

export interface TemplateDraft {
  id: number | null;
  kind: TemplateKind;
  name: string;
  section: WaterfallSection | null;
  videoGroup: VideoGroup | null;
  courseName: string;
  logoMedia: MediaRecord | null;
  logoFile: File | null;
  logoPreview: string;
  typeIds: number[];
  script: CourseScript | null;
  coursePackageId: number | null;
  sourceCourseId: number | null;
  summary: CourseSummary | null;
}

export function createTemplateCollections(): TemplateCollections {
  return { warmup: [], cooldown: [], training: [], course: [] };
}

export function getTemplateKindLabel(kind: TemplateKind): string {
  if (kind === "course") return "整课模板";
  if (kind === "cooldown") return "冷身模板";
  if (kind === "training") return "正式组模板";
  return "热身模板";
}

export function createTemplateDraft(template: TemplateRecord | null = null, kind: TemplateKind = "warmup"): TemplateDraft {
  const resolvedKind = template?.kind || kind;
  if (resolvedKind === "training") {
    const trainingTemplate = template as TrainingTemplateRecord | null;
    return {
      id: trainingTemplate?.id ?? null,
      kind: "training",
      name: trainingTemplate?.name ?? "",
      section: null,
      videoGroup: cloneVideoGroupForEditor(trainingTemplate?.videoGroup, trainingTemplate?.name ?? "正式组模板"),
      courseName: "",
      logoMedia: null,
      logoFile: null,
      logoPreview: "",
      typeIds: [],
      script: null,
      coursePackageId: null,
      sourceCourseId: null,
      summary: null
    };
  }

  if (resolvedKind === "course") {
    const courseTemplate = template as CourseTemplateRecord | null;
    const coursePackageId = courseTemplate?.coursePackageId ?? courseTemplate?.coursePackageIds?.[0] ?? null;
    return {
      id: courseTemplate?.id ?? null,
      kind: "course",
      name: courseTemplate?.name ?? "",
      section: null,
      videoGroup: null,
      courseName: courseTemplate?.courseName ?? courseTemplate?.script?.metadata?.name ?? courseTemplate?.name ?? "",
      logoMedia: courseTemplate?.logoMedia ?? null,
      logoFile: null,
      logoPreview: courseTemplate?.logoMedia?.url ?? "",
      typeIds: [...(courseTemplate?.typeIds ?? [])],
      script: courseTemplate?.script ? cloneCourseScriptWithFreshIds(courseTemplate.script) : null,
      coursePackageId,
      sourceCourseId: courseTemplate?.sourceCourseId ?? null,
      summary: courseTemplate?.summary ?? null
    };
  }

  const waterfallTemplate = template as WaterfallTemplateRecord | null;
  const title = resolvedKind === "cooldown" ? "冷身" : "热身";
  return {
    id: waterfallTemplate?.id ?? null,
    kind: resolvedKind,
    name: waterfallTemplate?.name ?? "",
    section: cloneWaterfallSectionForEditor(waterfallTemplate?.section, title),
    videoGroup: null,
    courseName: "",
    logoMedia: null,
    logoFile: null,
    logoPreview: "",
    typeIds: [],
    script: null,
    coursePackageId: null,
    sourceCourseId: null,
    summary: null
  };
}

export function formatTemplateSummary(template: TemplateRecord): string {
  if (template.kind === "course") {
    const warmupCount = template.summary?.warmupActionCount ?? template.script.sections.warmup.items.length;
    const trainingCount =
      template.summary?.trainingCardCount ??
      template.script.training.videoGroups.reduce(
        (total, group) => total + group.screens.reduce((screenTotal, screen) => screenTotal + screen.videoCards.length, 0),
        0
      );
    const podCount = template.summary?.podCount ?? template.script.training.pods.length;
    return `${warmupCount} 热身 / ${trainingCount} 训练动作 / ${podCount} Pod`;
  }

  if (template.kind === "training") {
    return `${template.videoGroup.screenCount === 1 ? "单屏瀑布" : "三屏站点"} · ${getVideoGroupCardCount(template.videoGroup)} 个动作位`;
  }

  return `${template.section.items.length} 个动作 · ${formatSecondsLabel(getWaterfallSectionTotal(template.section))}`;
}

export const TEMPLATE_TABS: Array<{ key: TemplateKind; label: string }> = [
  { key: "warmup", label: "热身模板" },
  { key: "training", label: "正式组模板" },
  { key: "cooldown", label: "冷身模板" },
  { key: "course", label: "整课模板" }
];
