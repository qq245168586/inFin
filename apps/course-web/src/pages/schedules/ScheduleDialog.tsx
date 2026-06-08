import { useState } from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole
} from "@floating-ui/react";
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

function ScheduleCourseSeriesOption({
  name,
  courses,
  isActive,
  draftCourseId,
  onSelectCourse
}: {
  name: string;
  courses: CourseRecord[];
  isActive: boolean;
  draftCourseId: string;
  onSelectCourse: (course: CourseRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "right-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip({ fallbackPlacements: ["left-start", "right-start"] }), shift({ padding: 16 })]
  });
  const hover = useHover(context, { delay: { open: 50, close: 80 }, handleClose: safePolygon() });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  function handleSelectCourse(course: CourseRecord) {
    onSelectCourse(course);
    setIsOpen(false);
  }

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps({
          className: `schedule-course-option is-series ${isActive ? "is-active" : ""} ${isOpen ? "is-flyout-open" : ""}`,
          tabIndex: 0
        })}
      >
        <span className="schedule-course-option-main">
          <strong>{name}</strong>
          <span className="schedule-course-count">共 {courses.length} 版</span>
        </span>
        <span className="schedule-course-arrow">›</span>
      </div>

      {isOpen ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps({
              className: "schedule-course-flyout"
            })}
          >
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={`schedule-course-version-option ${String(draftCourseId) === String(course.id) ? "is-active" : ""}`}
                onClick={() => handleSelectCourse(course)}
              >
                <strong>{course.name}</strong>
                <span className="course-inline-version">Version {course.version || "--"}</span>
              </button>
            ))}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
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

  function selectCourse(course: CourseRecord) {
    onDraftChange((current) => ({
      ...current,
      courseName: course.name,
      courseId: String(course.id),
      version: course.version || ""
    }));
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
                  <ScheduleCourseSeriesOption
                    key={name}
                    name={name}
                    courses={courses}
                    isActive={isActiveGroup}
                    draftCourseId={draft.courseId}
                    onSelectCourse={selectCourse}
                  />
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
