import { useState } from "react";
import Dialog from "../../components/Dialog.tsx";
import type { CourseGroups } from "../../models/course/groupCoursesByName.ts";
import type { CourseRecord } from "../../models/course/types.ts";
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
  courseGroups,
  onDraftChange,
  onClose,
  onConfirm
}: {
  draft: ScheduleDraftValue;
  courseGroups: CourseGroups;
  onDraftChange: (updater: (current: ScheduleDraftValue) => ScheduleDraftValue) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const courseGroupEntries = Object.entries(courseGroups).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  const [activeSeriesName, setActiveSeriesName] = useState("");

  function selectCourse(course: CourseRecord) {
    onDraftChange((current) => ({
      ...current,
      courseName: course.name,
      courseId: String(course.id),
      version: course.version || ""
    }));
    setActiveSeriesName("");
  }

  return (
    <Dialog title="添加排课" width={900} onClose={onClose} onConfirm={onConfirm}>
      <div className="dialog-form">
        <div className="field">
          <span>请选择课程</span>
          <div className="schedule-course-picker">
            {courseGroupEntries.length ? (
              courseGroupEntries.map(([name, courses]) => {
                const isSeries = courses.length > 1;
                const representative = courses[0];
                const isActiveGroup = draft.courseName === name;
                if (!isSeries) {
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`schedule-course-option ${String(draft.courseId) === String(representative.id) ? "is-active" : ""}`}
                      onClick={() => selectCourse(representative)}
                    >
                      <span className="schedule-course-option-main">
                        <strong>{name}</strong>
                        <span className="course-inline-version">Version {representative.version || "--"}</span>
                      </span>
                    </button>
                  );
                }

                return (
                  <div
                    key={name}
                    className={`schedule-course-option is-series ${isActiveGroup ? "is-active" : ""} ${
                      activeSeriesName === name ? "is-flyout-open" : ""
                    }`}
                    tabIndex={0}
                    onMouseEnter={() => setActiveSeriesName(name)}
                    onMouseLeave={() => setActiveSeriesName((current) => (current === name ? "" : current))}
                    onFocus={() => setActiveSeriesName(name)}
                  >
                    <span className="schedule-course-option-main">
                      <strong>{name}</strong>
                      <span className="schedule-course-count">共 {courses.length} 版</span>
                    </span>
                    <span className="schedule-course-arrow">›</span>
                    <div className="schedule-course-flyout">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          className={`schedule-course-version-option ${String(draft.courseId) === String(course.id) ? "is-active" : ""}`}
                          onClick={() => selectCourse(course)}
                        >
                          <strong>{course.name}</strong>
                          <span className="course-inline-version">Version {course.version || "--"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="schedule-course-empty">当前课程包没有可排课程</div>
            )}
          </div>
        </div>

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
