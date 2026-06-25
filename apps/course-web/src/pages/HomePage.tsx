import CalendarBoard, { type CalendarDay, type CalendarSchedule } from "../components/CalendarBoard.tsx";
import EmptyBlock from "../components/EmptyBlock.tsx";
import type { HomeTabKey } from "../app/navigation.ts";
import { HOME_TABS } from "../app/navigation.ts";
import { useI18n } from "../providers/I18nProvider.tsx";
import { formatDate, formatDateKey, todayValue } from "../utils/datetime.ts";

function getScheduleDate(schedule: CalendarSchedule): string {
  return schedule.date || formatDateKey(schedule.beginTime) || "";
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
  scheduleAnchorDate,
  onScheduleAnchorDateChange,
  onMoveScheduleWeek,
  onGoToday,
  schedules,
  scheduleLoading,
  onAddSchedule,
  onCopyWeekSchedules,
  onOpenScheduleCourseEditor,
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
  onGoToday: () => void;
  schedules: CalendarSchedule[];
  scheduleLoading?: boolean;
  onAddSchedule: () => void;
  onCopyWeekSchedules: () => void;
  onOpenScheduleCourseEditor: (courseId: number) => void;
  onDeleteSchedule: (id: number) => void;
}) {
  const calendarDays =
    selectedScheduleDate === "all" ? weekDays : weekDays.filter((day) => day.key === selectedScheduleDate);
  const scheduledDateKeys = new Set(schedules.map((item) => getScheduleDate(item)).filter(Boolean));
  const today = todayValue();
  const { t } = useI18n();

  return (
    <section className="page-card">
      <div className="page-card-head">
        <div>
          <p className="page-eyebrow">Scheduling</p>
          <h1>{t("课表")}</h1>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="primary-button" onClick={onAddSchedule}>
            {t("+ 添加课程")}
          </button>
          <button type="button" className="ghost-button" onClick={onCopyWeekSchedules}>
            {t("复制指定周排课")}
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
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div className="divider" />

      {scheduleLoading ? <div className="schedule-loading-strip">{t("正在加载课表...")}</div> : null}

      {homeTab === "history" ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("课程名称")}</th>
                <th>{t("课程版本")}</th>
                <th>{t("日期")}</th>
                <th>{t("课程信息")}</th>
                <th>{t("管理")}</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length ? (
                schedules.map((item) => {
                  const isPast = getScheduleDate(item) < today;
                  return (
                    <tr key={item.id} className={isPast ? "is-past" : ""}>
                      <td>{item.courseDeleted ? t("课程已删除") : item.courseName}</td>
                      <td>
                        {item.courseDeleted ? <span className="table-tag is-muted">--</span> : <span className="course-version-badge">{item.version || "--"}</span>}
                      </td>
                      <td className="cell-nowrap">{formatScheduleDate(getScheduleDate(item))}</td>
                      <td>
                        <div className="schedule-table-meta">
                          {item.description ? <span>{item.description}</span> : null}
                          {item.topic ? <span>{t("主题：")}{item.topic}</span> : null}
                          {item.stationText ? <span>{t("站点：")}{item.stationText}</span> : null}
                          {item.rotationType ? <span>{t("换站：")}{t(getRotationLabel(item.rotationType))}</span> : null}
                          {!item.description && !item.topic && !item.stationText && !item.rotationType ? <span>--</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="schedule-table-actions">
                          {!item.courseDeleted && item.courseId ? (
                            <button
                              type="button"
                              className="schedule-edit-course-button is-table"
                              onClick={() => onOpenScheduleCourseEditor(Number(item.courseId))}
                            >
                              {t("编辑课程")}
                            </button>
                          ) : null}
                          <button type="button" className="table-link danger" onClick={() => onDeleteSchedule(item.id)} disabled={isPast}>
                            {t("删除")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyBlock title={t("还没有历史排课")} copy={t("你添加过的课程排期会展示在这里。")} />
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
                  {t("上一周")}
                </button>
                <button type="button" className="primary-button calendar-today-button" onClick={onGoToday}>
                  {t("今天")}
                </button>
                <button type="button" className="ghost-button" onClick={() => onMoveScheduleWeek(1)}>
                  {t("下一周")}
                </button>
              </div>
            ) : null}

            <div className="calendar-date-strip">
              {homeTab === "currentWeek" ? (
                <label className="calendar-date-picker-pill">
                  <span>{t("日期选择")}</span>
                  <input
                    type="date"
                    value={scheduleAnchorDate}
                    onChange={(event) => onScheduleAnchorDateChange(event.target.value)}
                  />
                </label>
              ) : null}
            {weekDays.map((day) => (
              <button
                key={day.key}
                type="button"
                className={`calendar-date-pill ${scheduledDateKeys.has(day.key) ? "has-schedules" : ""} ${
                  day.key < today ? "is-past" : ""
                } ${selectedScheduleDate === day.key ? "is-active" : ""}`}
                onClick={() => onSelectedScheduleDateChange(day.key)}
              >
                <strong>{day.title}</strong>
                <span>{day.subtitle}</span>
              </button>
            ))}
            </div>
          </div>

          <CalendarBoard
            weekDays={calendarDays}
            schedules={schedules}
            onOpenCourseEditor={onOpenScheduleCourseEditor}
            onDelete={onDeleteSchedule}
          />
        </div>
      )}
    </section>
  );
}
