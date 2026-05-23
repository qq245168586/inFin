import FilterChips from "../../components/FilterChips.tsx";
import type { CourseRecord } from "../../models/course/types.ts";
import { cloneCourseScriptWithFreshIds } from "../../models/course/factories.ts";
import type { TemplateDraft } from "../../models/templates.ts";
import type { CoursePackageRecord } from "../venues/types.ts";
import { formatTemplateSummary } from "../../models/templates.ts";
import { toggleNumberId } from "../../utils/array.ts";

export default function CourseTemplateEditor({
  draft,
  courses,
  coursePackages,
  lessonTypes,
  onUpdateDraft
}: {
  draft: TemplateDraft;
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  lessonTypes: Array<{ id: number; name: string }>;
  onUpdateDraft: (updater: (current: TemplateDraft) => TemplateDraft) => void;
}) {
  if (draft.kind !== "course") return null;

  const selectedCourse = draft.sourceCourseId
    ? courses.find((course) => Number(course.id) === Number(draft.sourceCourseId)) || null
    : null;

  function applySourceCourse(course: CourseRecord | null) {
    onUpdateDraft((current) => {
      if (!course) {
        return { ...current, sourceCourseId: null };
      }

      const sourcePackage = coursePackages.find((coursePackage) =>
        (coursePackage.courseIds || []).some((courseId) => Number(courseId) === Number(course.id))
      );

      return {
        ...current,
        name: current.name || course.name,
        courseName: course.name,
        logoMedia: course.logoMedia,
        typeIds: [...course.typeIds],
        script: cloneCourseScriptWithFreshIds(course.script),
        coursePackageId: current.coursePackageId || sourcePackage?.id || null,
        sourceCourseId: course.id,
        summary: course.summary
      };
    });
  }

  return (
    <>
      <div className="form-row two">
        <label className="field">
          <span>从已有课程生成</span>
          <select
            value={draft.sourceCourseId ? String(draft.sourceCourseId) : ""}
            onChange={(event) => {
              const course = courses.find((item) => String(item.id) === event.target.value) || null;
              applySourceCourse(course);
            }}
          >
            <option value="">请选择来源课程</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} · {course.version}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>课程包归属</span>
          <select
            value={draft.coursePackageId ? String(draft.coursePackageId) : ""}
            onChange={(event) =>
              onUpdateDraft((current) => ({
                ...current,
                coursePackageId: event.target.value ? Number(event.target.value) : null
              }))
            }
          >
            <option value="">未指定课程包</option>
            {coursePackages.map((coursePackage) => (
              <option key={coursePackage.id} value={coursePackage.id}>
                {coursePackage.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row two">
        <label className="field">
          <span>模板内默认课程名</span>
          <input
            value={draft.courseName}
            onChange={(event) => onUpdateDraft((current) => ({ ...current, courseName: event.target.value }))}
            placeholder="从模板创建时仍会默认使用模板名称"
          />
        </label>

        <label className="field">
          <span>Logo</span>
          <input value={draft.logoMedia?.originalName || draft.logoMedia?.filename || draft.logoMedia?.url || "未设置 Logo"} readOnly />
        </label>
      </div>

      <div className="filter-line">
        <span className="filter-label">课程类型</span>
        <FilterChips
          options={lessonTypes}
          selectedIds={draft.typeIds}
          onToggle={(typeId) =>
            onUpdateDraft((current) => ({ ...current, typeIds: toggleNumberId(current.typeIds, typeId) }))
          }
        />
      </div>

      <div className="page-section">
        <div className="section-head">
          <div>
            <p className="section-copy">
              {draft.script
                ? formatTemplateSummary({
                    id: draft.id || 0,
                    kind: "course",
                    name: draft.name || "整课模板",
                    courseName: draft.courseName,
                    logoMedia: draft.logoMedia,
                    typeIds: draft.typeIds,
                    script: draft.script,
                    coursePackageId: draft.coursePackageId,
                    sourceCourseId: draft.sourceCourseId,
                    summary: draft.summary,
                    updateTime: ""
                  })
                : "选择来源课程后会复制完整脚本、热身、冷身、屏幕、站点和 Pod 规则。"}
            </p>
            {selectedCourse ? <p className="section-copy">来源课程：{selectedCourse.name}</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
