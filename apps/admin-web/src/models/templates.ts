import type { VideoGroup, WaterfallSection } from "./course/types.ts";
import { cloneVideoGroupForEditor, cloneWaterfallSectionForEditor, getVideoGroupCardCount, getWaterfallSectionTotal } from "./course/factories.ts";
import { formatSecondsLabel } from "../utils/datetime.ts";

export type TemplateKind = "warmup" | "cooldown" | "training";

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

export type TemplateRecord = WaterfallTemplateRecord | TrainingTemplateRecord;

export interface TemplateCollections {
  warmup: WaterfallTemplateRecord[];
  cooldown: WaterfallTemplateRecord[];
  training: TrainingTemplateRecord[];
}

export interface TemplateDraft {
  id: number | null;
  kind: TemplateKind;
  name: string;
  section: WaterfallSection | null;
  videoGroup: VideoGroup | null;
}

export function createTemplateCollections(): TemplateCollections {
  return { warmup: [], cooldown: [], training: [] };
}

export function getTemplateKindLabel(kind: TemplateKind): string {
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
      videoGroup: cloneVideoGroupForEditor(trainingTemplate?.videoGroup, trainingTemplate?.name ?? "正式组模板")
    };
  }

  const waterfallTemplate = template as WaterfallTemplateRecord | null;
  const title = resolvedKind === "cooldown" ? "冷身" : "热身";
  return {
    id: waterfallTemplate?.id ?? null,
    kind: resolvedKind,
    name: waterfallTemplate?.name ?? "",
    section: cloneWaterfallSectionForEditor(waterfallTemplate?.section, title),
    videoGroup: null
  };
}

export function formatTemplateSummary(template: TemplateRecord): string {
  if (template.kind === "training") {
    return `${template.videoGroup.screenCount === 1 ? "单屏瀑布" : "三屏站点"} · ${getVideoGroupCardCount(template.videoGroup)} 个动作位`;
  }

  return `${template.section.items.length} 个动作 · ${formatSecondsLabel(getWaterfallSectionTotal(template.section))}`;
}

export const TEMPLATE_TABS: Array<{ key: TemplateKind; label: string }> = [
  { key: "warmup", label: "热身模板" },
  { key: "training", label: "正式组模板" },
  { key: "cooldown", label: "冷身模板" }
];
