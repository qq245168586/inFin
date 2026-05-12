import type { CourseRecord } from "../../models/course/types.ts";
import { uid } from "../../utils/uid.ts";
import type { CourseDraft, CourseEditorTabState } from "./types.ts";
import { createEmptyCourseScript, normalizeCourseScriptLocal } from "./courseScriptNormalize.ts";

export function createCourseDraft(course: CourseRecord | null = null): CourseDraft {
  return {
    id: course?.id ?? null,
    typeIds: [...(course?.typeIds ?? [])],
    logoMedia: course?.logoMedia ?? null,
    logoFile: null,
    logoPreview: course?.logoMedia?.url ?? "",
    script: normalizeCourseScriptLocal(course?.script || createEmptyCourseScript())
  };
}

export function createCourseEditorTab(course: CourseRecord | null = null): CourseEditorTabState {
  return {
    tabId: uid("course-tab"),
    courseId: course?.id ?? null,
    title: course ? "编辑课程" : "添加课程",
    draft: createCourseDraft(course)
  };
}
