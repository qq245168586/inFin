import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarDay, CalendarSchedule } from "../../components/CalendarBoard.tsx";
import type { CourseRecord } from "../../models/course/types.ts";
import { groupCoursesByName } from "../../models/course/groupCoursesByName.ts";
import type { HomeTabKey } from "../../app/navigation.ts";
import type { ScheduleCollection } from "../../services/api/meta.ts";
import type { CoursePackageRecord } from "../../pages/venues/types.ts";
import { copyLastWeekSchedules, createSchedule, deleteSchedule } from "../../services/api/schedules.ts";
import { addDaysValue, composeCnDateTime, formatDateKey, todayValue, weekStartValue } from "../../utils/datetime.ts";
import { getErrorMessage } from "../../utils/errors.ts";

export interface ScheduleDraftValue {
  courseName: string;
  courseId: string;
  coursePackageId: string;
  version: string;
  date: string;
}

function coursesForPackage(courses: CourseRecord[], coursePackage?: CoursePackageRecord | null): CourseRecord[] {
  if (!coursePackage) return courses;
  const ids = new Set((coursePackage.courseIds || []).map(Number));
  if (!ids.size) return [];
  return courses.filter((course) => ids.has(Number(course.id)));
}

function createScheduleDraft(courses: CourseRecord[], coursePackages: CoursePackageRecord[], preferredDate = ""): ScheduleDraftValue {
  const firstPackage = coursePackages[0] || null;
  const packageCourses = coursesForPackage(courses, firstPackage);
  const first = [...packageCourses].sort((left, right) => {
    if (left.name === right.name) {
      return left.version.localeCompare(right.version);
    }
    return left.name.localeCompare(right.name);
  })[0];

  return {
    courseName: first?.name ?? "",
    courseId: first ? String(first.id) : "",
    coursePackageId: firstPackage ? String(firstPackage.id) : "",
    version: first?.version ?? "",
    date: preferredDate || todayValue()
  };
}

function getScheduleDateKey(schedule: CalendarSchedule): string {
  return schedule.date || formatDateKey(schedule.beginTime) || "";
}

function buildScheduleStationText(course?: CourseRecord | null): string {
  const script = course?.script;
  const videoGroups = script?.training?.videoGroups || [];
  const pods = script?.training?.pods || [];
  const pod = pods.find((item) => Boolean(item?.videoGroupId)) || pods[0] || null;
  const group = videoGroups.find((item) => item.id === pod?.videoGroupId) || videoGroups[0] || null;
  if (!group) return "";

  const stationNumbers = new Set<string>();
  let cardCount = 0;
  for (const screen of group.screens || []) {
    for (const card of screen.videoCards || []) {
      const stationNumber = String(card?.stationNumber || "").trim();
      if (stationNumber) {
        stationNumbers.add(stationNumber);
      }
      if (String(card?.actionId || "").trim() || String(card?.actionName || "").trim()) {
        cardCount += 1;
      }
    }
  }

  const stationCount = stationNumbers.size || cardCount;
  return stationCount > 0 ? `${stationCount} 站` : "";
}

function getWeekDays(anchorDate: string): CalendarDay[] {
  const weekStart = weekStartValue(anchorDate);
  const base = new Date(`${weekStart}T12:00:00+08:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    const dateKey = formatDateKey(current);

    return {
      key: dateKey,
      title: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
      subtitle: `${current.getMonth() + 1}.${current.getDate()}`
    };
  });
}

export default function useHomeScheduleVm({
  courses,
  coursePackages,
  schedules,
  onBusyText,
  onNotice,
  onReloadMeta
}: {
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  schedules: ScheduleCollection;
  onBusyText: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onReloadMeta: () => Promise<void>;
}) {
  const [homeTab, setHomeTab] = useState<HomeTabKey>("currentWeek");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [scheduleAnchorDate, setScheduleAnchorDateRaw] = useState(todayValue());
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftValue | null>(null);

  const lastWeekAnchorDate = useMemo(() => addDaysValue(todayValue(), -7), []);
  const weekDays = useMemo(
    () => getWeekDays(homeTab === "lastWeek" ? lastWeekAnchorDate : scheduleAnchorDate),
    [homeTab, lastWeekAnchorDate, scheduleAnchorDate]
  );
  const weekDayKeysSignature = useMemo(() => weekDays.map((day) => day.key).join("|"), [weekDays]);

  useEffect(() => {
    if (homeTab === "currentWeek" && !weekDays.some((day) => day.key === selectedScheduleDate)) {
      setSelectedScheduleDate(scheduleAnchorDate);
    } else if (homeTab === "lastWeek") {
      setSelectedScheduleDate("all");
    }
  }, [homeTab, scheduleAnchorDate, selectedScheduleDate, weekDayKeysSignature, weekDays]);

  const enrichSchedule = useCallback(
    (schedule: CalendarSchedule): CalendarSchedule => {
      const course = courses.find((item) => Number(item.id) === Number(schedule.courseId));
      return {
        ...schedule,
        date: schedule.date || formatDateKey(schedule.beginTime),
        description: schedule.description ?? course?.description ?? course?.script?.metadata?.description,
        topic: schedule.topic ?? course?.topic ?? course?.script?.metadata?.topic,
        rotationType: schedule.rotationType ?? course?.rotationType ?? course?.script?.metadata?.rotationType,
        stationText: schedule.stationText ?? buildScheduleStationText(course)
      };
    },
    [courses]
  );

  const allSchedules = useMemo<CalendarSchedule[]>(() => {
    const seen = new Set<number>();
    return [...schedules.currentWeek, ...schedules.lastWeek, ...schedules.history]
      .filter((item) => {
        const key = Number(item.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(enrichSchedule);
  }, [enrichSchedule, schedules.currentWeek, schedules.history, schedules.lastWeek]);

  const visibleSchedules = useMemo<CalendarSchedule[]>(() => {
    if (homeTab === "lastWeek") {
      return schedules.lastWeek.map(enrichSchedule);
    }
    if (homeTab === "history") {
      return allSchedules;
    }
    const weekKeys = new Set(weekDays.map((day) => day.key));
    return allSchedules.filter((item) => weekKeys.has(getScheduleDateKey(item)));
  }, [allSchedules, enrichSchedule, homeTab, schedules.lastWeek, weekDays]);

  const setScheduleAnchorDate = useCallback((value: string) => {
    const nextValue = value || todayValue();
    setScheduleAnchorDateRaw(nextValue);
    setSelectedScheduleDate(nextValue);
  }, []);

  const moveScheduleWeek = useCallback((deltaWeeks: number) => {
    setScheduleAnchorDateRaw((current) => {
      const nextValue = addDaysValue(current || todayValue(), deltaWeeks * 7);
      setSelectedScheduleDate(nextValue);
      return nextValue;
    });
  }, []);

  const activeDraftPackage = useMemo(() => {
    const packageId = scheduleDraft?.coursePackageId || "";
    return coursePackages.find((item) => String(item.id) === String(packageId)) || coursePackages[0] || null;
  }, [coursePackages, scheduleDraft?.coursePackageId]);

  const courseGroups = useMemo(() => groupCoursesByName(coursesForPackage(courses, activeDraftPackage)), [activeDraftPackage, courses]);

  const openScheduleDialog = useCallback(() => {
    if (!courses.length) {
      onNotice("请先在课程页创建课程。", "error");
      return;
    }
    if (!coursePackages.length) {
      onNotice("请先创建或授权课程包。", "error");
      return;
    }

    setScheduleDraft(createScheduleDraft(courses, coursePackages, selectedScheduleDate >= todayValue() ? selectedScheduleDate : todayValue()));
  }, [coursePackages, courses, onNotice, selectedScheduleDate]);

  const closeScheduleDialog = useCallback(() => setScheduleDraft(null), []);

  const updateScheduleDraft = useCallback(
    (updater: (current: ScheduleDraftValue) => ScheduleDraftValue) => {
      setScheduleDraft((current) => (current ? updater(current) : current));
    },
    []
  );

  const saveSchedule = useCallback(async () => {
    if (!scheduleDraft?.courseId) {
      onNotice("请选择课程。", "error");
      return;
    }
    if (!scheduleDraft.coursePackageId) {
      onNotice("请选择课程包。", "error");
      return;
    }
    if (!scheduleDraft.date) {
      onNotice("请选择课程日期。", "error");
      return;
    }
    if (scheduleDraft.date < todayValue()) {
      onNotice("过去日期不能排课。", "error");
      return;
    }

    onBusyText("正在保存排课...");
    try {
      await createSchedule({
        courseId: Number(scheduleDraft.courseId),
        coursePackageId: Number(scheduleDraft.coursePackageId) || undefined,
        version: scheduleDraft.version,
        date: scheduleDraft.date,
        beginTime: composeCnDateTime(scheduleDraft.date, "00:00"),
        duration: 0
      });

      await onReloadMeta();
      setScheduleDraft(null);
      onNotice("排课已添加。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [onBusyText, onNotice, onReloadMeta, scheduleDraft]);

  const copyLastWeek = useCallback(async () => {
    const activeCoursePackageId = Number(coursePackages[0]?.id) || 0;
    if (!activeCoursePackageId) {
      onNotice("请先选择课程包。", "error");
      return;
    }
    if (schedules.currentWeek.length && !window.confirm("本周已有排课，确认用上周排课覆盖本周吗？")) {
      return;
    }

    onBusyText("正在复制上周排课...");
    try {
      await copyLastWeekSchedules(activeCoursePackageId);
      await onReloadMeta();
      onNotice("上周排课已复制到本周。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [coursePackages, onBusyText, onNotice, onReloadMeta, schedules.currentWeek.length]);

  const removeSchedule = useCallback(
    async (scheduleId: number) => {
      if (!window.confirm("确认删除这个排课吗？")) {
        return;
      }

      onBusyText("正在删除排课...");
      try {
        await deleteSchedule(scheduleId);
        await onReloadMeta();
        onNotice("排课已删除。");
      } catch (error) {
        onNotice(getErrorMessage(error), "error");
      } finally {
        onBusyText("");
      }
    },
    [onBusyText, onNotice, onReloadMeta]
  );

  return {
    homeTab,
    setHomeTab,
    selectedScheduleDate,
    setSelectedScheduleDate,
    scheduleAnchorDate,
    setScheduleAnchorDate,
    moveScheduleWeek,
    weekDays,
    visibleSchedules,
    courseGroups,
    scheduleDraft,
    openScheduleDialog,
    closeScheduleDialog,
    updateScheduleDraft,
    saveSchedule,
    copyLastWeek,
    removeSchedule
  };
}
