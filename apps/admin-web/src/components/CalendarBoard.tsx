import type { CSSProperties } from "react";
import { formatDateKey, formatTime, todayValue } from "../utils/datetime.ts";

export interface CalendarDay {
  key: string;
  title: string;
  subtitle: string;
}

export interface CalendarSchedule {
  id: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

const CALENDAR_START_HOUR = 0;
const CALENDAR_END_HOUR = 24;
const CALENDAR_HOUR_HEIGHT = 70;

function getTimeSlots(): Array<{ hour: number; label: string }> {
  return Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => {
    const hour = CALENDAR_START_HOUR + index;
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`
    };
  });
}

function getSchedulePlacement(schedule: CalendarSchedule): { top: number; height: number } {
  const date = new Date(schedule.beginTime);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const top = ((minutes - CALENDAR_START_HOUR * 60) / 60) * CALENDAR_HOUR_HEIGHT;
  const height = Math.max((Number(schedule.duration || 0) / 60) * CALENDAR_HOUR_HEIGHT, 54);

  return {
    top: Math.max(top, 0),
    height
  };
}

function isPastSchedule(schedule: CalendarSchedule): boolean {
  const dateKey = formatDateKey(schedule.beginTime);
  return Boolean(dateKey) && dateKey < todayValue();
}

export default function CalendarBoard({
  weekDays,
  schedules,
  onDelete
}: {
  weekDays: CalendarDay[];
  schedules: CalendarSchedule[];
  onDelete: (scheduleId: number) => void;
}) {
  const timeSlots = getTimeSlots();

  return (
    <div className="calendar-board-wrap" style={{ "--calendar-columns": weekDays.length } as CSSProperties}>
      <div className="calendar-head">
        <div className="calendar-time-corner" />
        <div className="calendar-day-heads">
          {weekDays.map((day) => (
            <div key={day.key} className="calendar-day-head">
              <strong>{day.title}</strong>
              <span>{day.subtitle}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-time-column">
          {timeSlots.map((slot) => (
            <div key={slot.hour} className="calendar-time-cell">
              <span>{slot.label}</span>
            </div>
          ))}
        </div>

        <div className="calendar-day-columns">
          {weekDays.map((day, dayIndex) => {
            const daySchedules = schedules.filter((item) => formatDateKey(item.beginTime) === day.key);

            return (
              <div key={day.key} className="calendar-day-column">
                {timeSlots.map((slot) => (
                  <div key={`${day.key}-${slot.hour}`} className="calendar-hour-line" />
                ))}

                {daySchedules.map((item, itemIndex) => {
                  const placement = getSchedulePlacement(item);
                  const past = isPastSchedule(item);

                  return (
                    <article
                      key={item.id}
                      className={`calendar-event tone-${(dayIndex + itemIndex) % 6} ${past ? "is-past" : ""}`}
                      style={{
                        top: `${placement.top}px`,
                        height: `${placement.height}px`
                      }}
                    >
                      <div className="calendar-event-top">
                        <span className="calendar-event-time">
                          {formatTime(item.beginTime)} - {formatTime(new Date(new Date(item.beginTime).getTime() + Number(item.duration || 0) * 60000))}
                        </span>
                        <button type="button" className="calendar-event-delete" onClick={() => onDelete(item.id)} disabled={past}>
                          删除
                        </button>
                      </div>
                      <strong>{item.courseName}</strong>
                      <p>版本 {item.version || "--"}</p>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {!schedules.length ? <div className="calendar-empty-state">当前周还没有排课，点击右上角“添加课程”开始创建。</div> : null}
    </div>
  );
}
