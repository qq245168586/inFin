import { cloneDeep } from "../../utils/cloneDeep.ts";
import { getErrorMessage } from "../../utils/errors.ts";
import { readNonNegativeNumber } from "../../utils/number.ts";
import { requestJson } from "../../services/requestJson.ts";
import { uploadBinary } from "../../services/uploadBinary.ts";
import type { CourseRecord } from "../../models/course/types.ts";
import type { CourseDraft } from "./types.ts";
import { getCourseDraftIssues } from "./courseValidation.ts";
import { normalizeCourseScriptLocal } from "./courseScriptNormalize.ts";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

type NoticeTone = "info" | "error";

export default function useCourseCrudVm({
  authHeader,
  courseEditor,
  onBusyText,
  onNotice,
  onReloadMeta,
  onSavedCourse,
  onDeletedCourse
}: {
  authHeader: string;
  courseEditor: CourseDraft | null;
  onBusyText: (value: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onReloadMeta: () => Promise<void>;
  onSavedCourse: (course: CourseRecord) => void;
  onDeletedCourse: (courseId: number) => void;
}) {
  async function saveCourse() {
    if (!courseEditor) return;

    const issues = getCourseDraftIssues(courseEditor);
    if (issues.length) {
      onNotice(issues[0], "error");
      return;
    }

    onBusyText("正在保存课程...");

    try {
      let logoMedia = courseEditor.logoMedia;
      if (courseEditor.logoFile) {
        logoMedia = await uploadBinary("image", courseEditor.logoFile);
      }

      const script = normalizeCourseScriptLocal(cloneDeep(courseEditor.script));
      script.metadata.name = courseEditor.script.metadata.name.trim();
      script.metadata.creator = courseEditor.script.metadata.creator.trim();
      script.metadata.version = courseEditor.script.metadata.version.trim();
      script.metadata.defaultHydrateSeconds = readNonNegativeNumber(courseEditor.script.metadata.defaultHydrateSeconds, 0);

      const payload = {
        name: script.metadata.name,
        creator: script.metadata.creator,
        version: script.metadata.version,
        typeIds: courseEditor.typeIds,
        logoMedia,
        script
      };

      let savedCourse: CourseRecord;
      if (courseEditor.id) {
        const response = await requestJson<ApiResponse<CourseRecord>>(`/api/courses/${courseEditor.id}`, {
          method: "PUT",
          headers: authHeader ? { Authorization: authHeader } : {},
          body: JSON.stringify(payload)
        });
        savedCourse = response.data;
      } else {
        const response = await requestJson<ApiResponse<CourseRecord>>("/api/courses", {
          method: "POST",
          headers: authHeader ? { Authorization: authHeader } : {},
          body: JSON.stringify(payload)
        });
        savedCourse = response.data;
      }

      onSavedCourse(savedCourse);
      await onReloadMeta();
      onNotice("课程已保存。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }

  async function removeCourse(courseId: number) {
    if (!window.confirm("确认删除这个课程吗？")) return;
    onBusyText("正在删除课程...");
    try {
      await requestJson(`/api/courses/${courseId}`, { method: "DELETE", headers: authHeader ? { Authorization: authHeader } : {} });
      onDeletedCourse(courseId);
      await onReloadMeta();
      onNotice("课程已删除。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }

  return { saveCourse, removeCourse };
}
