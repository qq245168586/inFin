import type { CoachWeekDay, TvDailySchedule, WeekScheduleRecord } from "../models/schedule";

export const COURSE_TIME_ZONE = "Asia/Shanghai";

export function todayValue(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COURSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function formatTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatDateLabel(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "long"
  }).format(new Date(value));
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function startOfWeek(date = new Date()): Date {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta);
  return base;
}

export function getWeekDays(schedules: WeekScheduleRecord[]): CoachWeekDay[] {
  const monday = startOfWeek(new Date());
  const countMap = schedules.reduce<Record<string, number>>((result, item) => {
    const key = item.beginTime.slice(0, 10);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: COURSE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(current);

    return {
      key,
      label: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
      dayNumber: String(current.getDate()).padStart(2, "0"),
      scheduleCount: countMap[key] || 0
    };
  });
}

export function scheduleStartAtMs(schedule: TvDailySchedule): number {
  return new Date(schedule.beginTime).getTime();
}

export function buildScheduleRange(schedule: TvDailySchedule): string {
  const start = new Date(schedule.beginTime);
  const end = new Date(start.getTime() + Number(schedule.duration || 0) * 60000);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

