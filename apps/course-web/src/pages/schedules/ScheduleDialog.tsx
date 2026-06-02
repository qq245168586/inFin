import Dialog from "../../components/Dialog.tsx";
import type { CourseGroups } from "../../models/course/groupCoursesByName.ts";
import { todayValue } from "../../utils/datetime.ts";

export interface ScheduleDraftValue {
  courseName: string;
  courseId: string;
  coursePackageId: string;
  version: string;
  date: string;
}

export default function ScheduleDialog({
  draft,
  coursePackage,
  coursePackages,
  courseGroups,
  onDraftChange,
  onClose,
  onConfirm
}: {
  draft: ScheduleDraftValue;
  coursePackage: { id: number; name: string; courseIds?: number[] } | null;
  coursePackages: Array<{ id: number; name: string; courseIds?: number[] }>;
  courseGroups: CourseGroups;
  onDraftChange: (updater: (current: ScheduleDraftValue) => ScheduleDraftValue) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title="添加排课" onClose={onClose} onConfirm={onConfirm}>
      <div className="dialog-form">
        <label className="field">
          <span>请选择课程包</span>
          <select
            value={draft.coursePackageId}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                coursePackageId: event.target.value,
                courseName: "",
                courseId: "",
                version: ""
              }))
            }
          >
            <option value="">{coursePackage ? "请选择课程包" : "未选择课程包"}</option>
            {coursePackages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>请选择课程</span>
          <select
            value={draft.courseName}
            onChange={(event) => {
              const nextName = event.target.value;
              const group = courseGroups[nextName] || [];
              const first = group[0];
              onDraftChange((current) => ({
                ...current,
                courseName: nextName,
                courseId: first ? String(first.id) : "",
                version: first?.version || ""
              }));
            }}
          >
            <option value="">请选择课程</option>
            {Object.keys(courseGroups).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>请选择版本</span>
          <select
            value={draft.courseId}
            onChange={(event) => {
              const selected = (courseGroups[draft.courseName] || []).find((course) => String(course.id) === event.target.value);
              onDraftChange((current) => ({
                ...current,
                courseId: event.target.value,
                version: selected?.version || ""
              }));
            }}
          >
            <option value="">请选择版本</option>
            {(courseGroups[draft.courseName] || []).map((course) => (
              <option key={course.id} value={course.id}>
                Version {course.version || "--"} · #{course.id}
              </option>
            ))}
          </select>
        </label>

        {draft.courseName && draft.version ? (
          <div className="schedule-dialog-selected-course">
            <span className="schedule-version-badge">Version {draft.version}</span>
            <strong>{draft.courseName}</strong>
          </div>
        ) : null}

        <label className="field">
          <span>课程日期</span>
          <input
            type="date"
            min={todayValue()}
            value={draft.date}
            onChange={(event) => onDraftChange((current) => ({ ...current, date: event.target.value }))}
          />
        </label>
      </div>
    </Dialog>
  );
}
