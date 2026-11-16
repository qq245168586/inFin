import Dialog from "../../components/Dialog.tsx";
import type { CourseGroups } from "../../models/course/groupCoursesByName.ts";

export interface ScheduleDraftValue {
  courseName: string;
  courseId: string;
  coursePackageId: string;
  version: string;
  date: string;
  time: string;
  duration: string;
}

export default function ScheduleDialog({
  draft,
  coursePackages,
  courseGroups,
  onDraftChange,
  onClose,
  onConfirm
}: {
  draft: ScheduleDraftValue;
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
            onChange={(event) => {
              const nextPackageId = event.target.value;
              onDraftChange((current) => ({
                ...current,
                coursePackageId: nextPackageId,
                courseName: "",
                courseId: "",
                version: ""
              }));
            }}
          >
            <option value="">请选择课程包</option>
            {coursePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
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
                {course.version}
              </option>
            ))}
          </select>
        </label>

        <div className="schedule-inline-row">
          <label className="field">
            <span>课程日期</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => onDraftChange((current) => ({ ...current, date: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>开始时间</span>
            <input
              type="time"
              value={draft.time}
              onChange={(event) => onDraftChange((current) => ({ ...current, time: event.target.value }))}
            />
          </label>
        </div>

        <label className="field">
          <span>时长（分钟）</span>
          <input
            type="number"
            min="1"
            value={draft.duration}
            onChange={(event) => onDraftChange((current) => ({ ...current, duration: event.target.value }))}
          />
        </label>
      </div>
    </Dialog>
  );
}
