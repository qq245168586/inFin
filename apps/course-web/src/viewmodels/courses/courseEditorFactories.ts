import type { CourseRecord, CourseScript } from "../../models/course/types.ts";
import type { CourseTemplateRecord } from "../../models/templates.ts";
import { uid } from "../../utils/uid.ts";
import type { CourseDraft, CourseEditorTabState } from "./types.ts";
import { createEmptyCourseScript, normalizeCourseScriptLocal } from "./courseScriptNormalize.ts";
import { cloneCourseScriptWithFreshIds } from "../../models/course/factories.ts";

function compactTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function createTrainingSnapshot(script: Pick<CourseScript, "training">): string {
  return JSON.stringify(script.training);
}

export function createCourseDraft(course: CourseRecord | null = null): CourseDraft {
  const script = course?.script || createEmptyCourseScript();
  const metadata = {
    ...script.metadata,
    description: script.metadata?.description ?? course?.description ?? "",
    topic: script.metadata?.topic || course?.topic || "",
    rotationType: script.metadata?.rotationType || course?.rotationType || "REGION"
  };

  return {
    id: course?.id ?? null,
    typeIds: [...(course?.typeIds ?? [])],
    logoMedia: course?.logoMedia ?? null,
    logoFile: null,
    logoPreview: course?.logoMedia?.url ?? "",
    script: normalizeCourseScriptLocal({ ...script, metadata })
  };
}

export function createCourseDraftFromCourseTemplate(template: CourseTemplateRecord): CourseDraft {
  const script = normalizeCourseScriptLocal(
    cloneCourseScriptWithFreshIds(template.script, `template-${template.id}-${compactTimestamp()}`)
  );
  script.metadata.name = template.courseName || script.metadata.name || template.name;
  script.metadata.description = script.metadata.description || template.description || "";
  script.metadata.topic = script.metadata.topic || template.topic || "";
  script.metadata.rotationType = script.metadata.rotationType || template.rotationType || "REGION";

  return {
    id: null,
    typeIds: [...(template.typeIds || [])],
    logoMedia: template.logoMedia || null,
    logoFile: null,
    logoPreview: template.logoMedia?.url || "",
    script,
    sourceCourseTemplate: {
      templateId: template.id,
      templateName: template.name,
      initialTrainingSnapshot: createTrainingSnapshot(script)
    }
  };
}

export function createCourseEditorTab(course: CourseRecord | null = null, coursePackageId: number | null = null): CourseEditorTabState {
  return {
    tabId: uid("course-tab"),
    courseId: course?.id ?? null,
    coursePackageId,
    title: course ? "编辑课程" : "添加课程",
    draft: createCourseDraft(course)
  };
}
