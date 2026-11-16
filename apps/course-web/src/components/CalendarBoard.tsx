import type { CourseRotationType } from "../models/course/types.ts";
import { useI18n } from "../providers/I18nProvider.tsx";
import { todayValue } from "../utils/datetime.ts";

export interface CalendarDay {
  key: string;
  title: string;
  subtitle: string;
}

export interface CalendarSchedule {
  id: number;
  courseId?: number;
  courseDeleted?: boolean;
  courseName: string;
  version: string;
  date?: string;
  beginTime?: string;
  duration?: number;
  description?: string;
  topic?: string;
  rotationType?: CourseRotationType;
  stationText?: string;
}

const ROTATION_TYPE_LABELS: Record<CourseRotationType, string> = {
  REGION: "区域循环",
  LANE: "跑道换站",
  SNAKE: "蛇形换站"
};

function getScheduleDateKey(schedule: CalendarSchedule): string {
  return schedule.date || schedule.beginTime?.slice(0, 10) || "";
}

function getScheduleDescription(schedule: CalendarSchedule): string {
  return schedule.description?.trim() || "";
}

function getScheduleTopic(schedule: CalendarSchedule): string {
  return schedule.topic?.trim() || "";
}

function getScheduleRotationLabel(schedule: CalendarSchedule): string {
  return schedule.rotationType ? ROTATION_TYPE_LABELS[schedule.rotationType] || schedule.rotationType : "";
}

function formatDateKey(dateKey: string): string {
  return dateKey.replace(/-/g, "/");
}

export default function CalendarBoard({
  weekDays,
  schedules,
  onOpenCourseEditor,
  onDelete
}: {
  weekDays: CalendarDay[];
  schedules: CalendarSchedule[];
  onOpenCourseEditor: (courseId: number) => void;
  onDelete: (scheduleId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="schedule-day-list">
      {weekDays.map((day) => {
        const daySchedules = schedules.filter((item) => getScheduleDateKey(item) === day.key);

        return (
          <section key={day.key} className={`schedule-day-section ${day.key < todayValue() ? "is-past" : ""}`}>
            <div className="schedule-day-head">
              <div>
                <strong>{day.title}</strong>
                <span>{day.subtitle}</span>
              </div>
              <small>{formatDateKey(day.key)}</small>
            </div>

            {daySchedules.length ? (
              <div className="schedule-day-cards">
                {daySchedules.map((item, itemIndex) => {
                  const description = getScheduleDescription(item);
                  const topic = getScheduleTopic(item);
                  const rotationLabel = getScheduleRotationLabel(item);
                  const stationText = item.stationText?.trim() || "";
                  const isPast = getScheduleDateKey(item) < todayValue();

                  return (
                    <article key={item.id} className={`schedule-list-card tone-${itemIndex % 6} ${isPast ? "is-past" : ""}`}>
                      <div className="schedule-list-card-main">
                        <div>
                          {!item.courseDeleted ? <span className="schedule-version-badge">Version {item.version || "--"}</span> : null}
                          <strong>{item.courseDeleted ? t("课程已删除") : item.courseName}</strong>
                        </div>
                        <button type="button" className="table-link danger" onClick={() => onDelete(item.id)} disabled={isPast}>
                          {t("删除")}
                        </button>
                      </div>

                      {description ? <p>{description}</p> : null}

                      {topic || stationText || rotationLabel ? (
                        <div className="schedule-meta-row">
                          {topic ? <span>{t("主题：")}{topic}</span> : null}
                          {stationText ? <span>{t("站点：")}{stationText}</span> : null}
                          {rotationLabel ? <span>{t("换站：")}{t(rotationLabel)}</span> : null}
                        </div>
                      ) : null}

                      {!item.courseDeleted && item.courseId ? (
                        <div className="schedule-card-actions">
                          <button
                            type="button"
                            className="schedule-edit-course-button"
                            onClick={() => onOpenCourseEditor(Number(item.courseId))}
                          >
                            {t("编辑课程")}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="schedule-day-empty">{t("当天未安排课程")}</div>
            )}
          </section>
        );
      })}

      {!schedules.length ? <div className="calendar-empty-state">{t("当前周还没有排课，点击右上角“添加课程”开始创建。")}</div> : null}
    </div>
  );
}
