import type { CoursePackageRecord } from "../../models/schedule";

export function ConsoleToolbar({
  activeCoursePackageId,
  coursePackages,
  dateLabel,
  disabled,
  onChangeCoursePackage,
  onRefreshBundle,
  onRefreshTv
}: {
  activeCoursePackageId: number;
  coursePackages: CoursePackageRecord[];
  dateLabel: string;
  disabled?: boolean;
  onChangeCoursePackage: (coursePackageId: number) => void;
  onRefreshBundle: () => void;
  onRefreshTv: () => void;
}) {
  return (
    <div className="coach-console-toolbar">
      <div className="coach-toolbar-copy">
        <p>Coach Console</p>
        <strong>{dateLabel}</strong>
      </div>
      <div className="coach-toolbar-actions">
        {coursePackages.length ? (
          <label className="coach-package-select">
            <span>课程包</span>
            <select
              value={activeCoursePackageId || ""}
              disabled={disabled || coursePackages.length <= 1}
              onChange={(event) => onChangeCoursePackage(Number(event.target.value))}
            >
              {coursePackages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="ghost-button" onClick={onRefreshBundle}>
          刷新课表
        </button>
        <button type="button" className="primary-button" onClick={onRefreshTv}>
          刷新 TV
        </button>
      </div>
    </div>
  );
}
