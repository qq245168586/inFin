import CalendarBoard, { type CalendarDay, type CalendarSchedule } from "../components/CalendarBoard.tsx";
import EmptyBlock from "../components/EmptyBlock.tsx";
import type { HomeTabKey } from "../app/navigation.ts";
import { HOME_TABS } from "../app/navigation.ts";
import { formatDate } from "../utils/datetime.ts";

function getScheduleDate(schedule: CalendarSchedule): string {
  return schedule.date || schedule.beginTime?.slice(0, 10) || "";
}

function formatScheduleDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replace(/-/g, "/") : formatDate(value);
}

function getRotationLabel(value?: CalendarSchedule["rotationType"]): string {
  if (value === "LANE") return "跑道换站";
  if (value === "SNAKE") return "蛇形换站";
  if (value === "REGION") return "区域循环";
  return "";
}

export default function HomePage({
  weekDays,
  homeTab,
  onHomeTabChange,
  selectedScheduleDate,
  onSelectedScheduleDateChange,
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
                <th>日期</th>
                <th>课程信息</th>
                <th>管理</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length ? (
                schedules.map((item) => (
                  <tr key={item.id}>
                    <td>{item.courseName}</td>
                    <td>{item.version}</td>
                    <td className="cell-nowrap">{formatScheduleDate(getScheduleDate(item))}</td>
                    <td>
                      <div className="schedule-table-meta">
                        {item.description ? <span>{item.description}</span> : null}
                        {item.topic ? <span>主题：{item.topic}</span> : null}
                        {item.rotationType ? <span>换站：{getRotationLabel(item.rotationType)}</span> : null}
                        {!item.description && !item.topic && !item.rotationType ? <span>--</span> : null}
                      </div>
                    </td>
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
                    <EmptyBlock title="还没有历史排课" copy="你添加过的课程排期会展示在这里。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="calendar-wrap">
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

          <CalendarBoard weekDays={calendarDays} schedules={schedules} onDelete={onDeleteSchedule} />
        </div>
      )}
    </section>
  );
}
