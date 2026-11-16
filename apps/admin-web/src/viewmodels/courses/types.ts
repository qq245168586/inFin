import type { CourseEditorTitle, CourseScript } from "../../models/course/types.ts";
import type { MediaRecord } from "../../models/media.ts";

export interface CourseDraft {
  id: number | null;
  typeIds: number[];
  logoMedia: MediaRecord | null;
  logoFile: File | null;
  logoPreview: string;
  script: CourseScript;
}

export interface CourseEditorTabState {
  tabId: string;
  courseId: number | null;
  title: CourseEditorTitle;
  draft: CourseDraft;
}
