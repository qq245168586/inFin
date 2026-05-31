import CalendarBoard, { type CalendarDay, type CalendarSchedule } from "../components/CalendarBoard.tsx";
import EmptyBlock from "../components/EmptyBlock.tsx";
import type { HomeTabKey } from "../app/navigation.ts";
import { HOME_TABS } from "../app/navigation.ts";
import { formatDateTime } from "../utils/datetime.ts";

export default function HomePage({
  weekDays,
  homeTab,
  onHomeTabChange,
  selectedScheduleDate,
  onSelectedScheduleDateChange,
  scheduleAnchorDate,
  onScheduleAnchorDateChange,
  onMoveScheduleWeek,
  schedules,
  onAddSchedule,
  onCopyLastWeek,
  onDeleteSchedule
}: {
  weekDays: CalendarDay[];
  homeTab: HomeTabKey;
  onHomeTabChange: (tab: HomeTabKey) => void;
  selectedScheduleDate: string;
  onSelectedScheduleDateChange: (value: string) => void;
  scheduleAnchorDate: string;
  onScheduleAnchorDateChange: (value: string) => void;
  onMoveScheduleWeek: (deltaWeeks: number) => void;
  schedules: CalendarSchedule[];
  onAddSchedule: () => void;
  onCopyLastWeek: () => void;
  onDeleteSchedule: (id: number) => void;
}) {
  const calendarDays =
    selectedScheduleDate === "all" ? weekDays : weekDays.filter((day) => day.key === selectedScheduleDate);

  return (
    <section className="page-card">
      <div className="page-card-head">
        <div>
          <p className="page-eyebrow">Scheduling</p>
          <h1>课表</h1>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="primary-button" onClick={onAddSchedule}>
            + 添加课程
          </button>
          <button type="button" className="ghost-button" onClick={onCopyLastWeek}>
            一键复制上周排课
          </button>
        </div>
      </div>

      <div className="tab-row">
        {HOME_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-button ${homeTab === tab.key ? "is-active" : ""}`}
            onClick={() => onHomeTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="divider" />

      {homeTab === "history" ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>课程名称</th>
                <th>课程版本</th>
                <th>排课时间</th>
                <th>时长</th>
                <th>管理</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length ? (
                schedules.map((item) => (
                  <tr key={item.id}>
                    <td>{item.courseName}</td>
                    <td>{item.version}</td>
                    <td className="cell-nowrap">{formatDateTime(item.beginTime)}</td>
                    <td>{item.duration} min</td>
                    <td>
                      <button type="button" className="table-link danger" onClick={() => onDeleteSchedule(item.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyBlock title="还没有排课" copy="你添加过的课程排期会展示在这里。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="calendar-date-toolbar">
            {homeTab === "currentWeek" ? (
              <div className="calendar-jump-controls">
                <button type="button" className="ghost-button" onClick={() => onMoveScheduleWeek(-1)}>
                  上一周
                </button>
                <label className="calendar-jump-field">
                  <span>跳转日期</span>
                  <input
                    type="date"
                    value={scheduleAnchorDate}
                    onChange={(event) => onScheduleAnchorDateChange(event.target.value)}
                  />
                </label>
                <button type="button" className="ghost-button" onClick={() => onMoveScheduleWeek(1)}>
                  下一周
                </button>
              </div>
            ) : null}

            <div className="calendar-date-strip">
              <button
                type="button"
                className={`calendar-date-pill ${selectedScheduleDate === "all" ? "is-active" : ""}`}
                onClick={() => onSelectedScheduleDateChange("all")}
              >
                全部日期
              </button>
              {weekDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`calendar-date-pill ${selectedScheduleDate === day.key ? "is-active" : ""}`}
                  onClick={() => onSelectedScheduleDateChange(day.key)}
                >
                  <strong>{day.title}</strong>
                  <span>{day.subtitle}</span>
                </button>
              ))}
            </div>
          </div>

          <CalendarBoard weekDays={calendarDays} schedules={schedules} onDelete={onDeleteSchedule} />
        </div>
      )}
    </section>
  );
}
