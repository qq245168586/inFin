import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarDay, CalendarSchedule } from "../../components/CalendarBoard.tsx";
import type { CourseRecord } from "../../models/course/types.ts";
import { groupCoursesByName } from "../../models/course/groupCoursesByName.ts";
import type { HomeTabKey } from "../../app/navigation.ts";
import type { ScheduleCollection } from "../../services/api/meta.ts";
import type { CoursePackageRecord } from "../../pages/venues/types.ts";
import { copyWeekSchedules, createSchedule, deleteSchedule } from "../../services/api/schedules.ts";
import { RequestJsonError } from "../../services/requestJson.ts";
import { addDaysValue, composeCnDateTime, formatDateKey, todayValue, weekStartValue } from "../../utils/datetime.ts";
import { getErrorMessage } from "../../utils/errors.ts";
import {
  buildCopyWeekSchedulesPayload,
  createCopyWeekSchedulesDraft,
  type CopyWeekSchedulesDraftValue
} from "./copyWeekSchedules.ts";

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

function isCopyWeekConflict(error: unknown): boolean {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();
  return (
    (error instanceof RequestJsonError && error.status === 409) ||
    message.includes("已有排课") ||
    message.includes("已存在") ||
    message.includes("冲突") ||
    lowerMessage.includes("already") ||
    lowerMessage.includes("exist") ||
    lowerMessage.includes("conflict")
  );
}

export default function useHomeScheduleVm({
  courses,
  coursePackages,
  schedules,
  authHeader = "",
  onBusyText,
  onNotice,
  onReloadMeta
}: {
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  schedules: ScheduleCollection;
  authHeader?: string;
  onBusyText: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onReloadMeta: () => Promise<void>;
}) {
  const [homeTab, setHomeTab] = useState<HomeTabKey>("currentWeek");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(todayValue());
  const [scheduleAnchorDate, setScheduleAnchorDateRaw] = useState(todayValue());
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftValue | null>(null);
  const [copyWeekDraft, setCopyWeekDraft] = useState<CopyWeekSchedulesDraftValue | null>(null);

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
      const courseDeleted = Boolean(schedule.courseDeleted || (schedule.courseId && !course));
      return {
        ...schedule,
        courseDeleted,
        courseName: courseDeleted ? "课程已删除" : schedule.courseName,
        date: schedule.date || formatDateKey(schedule.beginTime),
        description: courseDeleted ? "" : schedule.description ?? course?.description ?? course?.script?.metadata?.description,
        topic: courseDeleted ? "" : schedule.topic ?? course?.topic ?? course?.script?.metadata?.topic,
        rotationType: courseDeleted ? undefined : schedule.rotationType ?? course?.rotationType ?? course?.script?.metadata?.rotationType,
        stationText: courseDeleted ? "" : schedule.stationText ?? buildScheduleStationText(course)
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

  const goToday = useCallback(() => {
    const today = todayValue();
    setHomeTab("currentWeek");
    setScheduleAnchorDateRaw(today);
    setSelectedScheduleDate(today);
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

  const openCopyWeekDialog = useCallback(() => {
    if (!coursePackages.length || !coursePackages[0]?.id) {
      onNotice("当前课程包为空，不能复制排课。", "error");
      return;
    }

    setCopyWeekDraft(createCopyWeekSchedulesDraft());
  }, [coursePackages, onNotice]);

  const closeCopyWeekDialog = useCallback(() => setCopyWeekDraft(null), []);

  const updateCopyWeekDraft = useCallback(
    (updater: (current: CopyWeekSchedulesDraftValue) => CopyWeekSchedulesDraftValue) => {
      setCopyWeekDraft((current) => (current ? updater(current) : current));
    },
    []
  );

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
      }, authHeader);

      await onReloadMeta();
      setScheduleDraft(null);
      onNotice("排课已添加。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [authHeader, onBusyText, onNotice, onReloadMeta, scheduleDraft]);

  const copyWeek = useCallback(async () => {
    const payloadResult = buildCopyWeekSchedulesPayload({
      coursePackageId: coursePackages[0]?.id,
      draft: copyWeekDraft
    });
    if (payloadResult.ok === false) {
      onNotice(payloadResult.message, "error");
      return;
    }

    const payload = payloadResult.payload;

    onBusyText("正在复制指定周排课...");
    try {
      await copyWeekSchedules(payload, authHeader);
      await onReloadMeta();
      setCopyWeekDraft(null);
      onNotice("排课复制成功。");
    } catch (error) {
      if (isCopyWeekConflict(error)) {
        if (!window.confirm("目标周已有排课，确认覆盖目标周排课吗？")) {
          return;
        }

        try {
          onBusyText("正在覆盖目标周排课...");
          await copyWeekSchedules({ ...payload, replaceExisting: true }, authHeader);
          await onReloadMeta();
          setCopyWeekDraft(null);
          onNotice("排课复制成功。");
        } catch (retryError) {
          onNotice(getErrorMessage(retryError), "error");
        }
        return;
      }

      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [authHeader, copyWeekDraft, coursePackages, onBusyText, onNotice, onReloadMeta]);

  const removeSchedule = useCallback(
    async (scheduleId: number) => {
      if (!window.confirm("确认删除这个排课吗？")) {
        return;
      }

      onBusyText("正在删除排课...");
      try {
        await deleteSchedule(scheduleId, authHeader);
        await onReloadMeta();
        onNotice("排课已删除。");
      } catch (error) {
        onNotice(getErrorMessage(error), "error");
      } finally {
        onBusyText("");
      }
    },
    [authHeader, onBusyText, onNotice, onReloadMeta]
  );

  return {
    homeTab,
    setHomeTab,
    selectedScheduleDate,
    setSelectedScheduleDate,
    scheduleAnchorDate,
    setScheduleAnchorDate,
    moveScheduleWeek,
    goToday,
    weekDays,
    visibleSchedules,
    courseGroups,
    scheduleDraft,
    copyWeekDraft,
    openScheduleDialog,
    closeScheduleDialog,
    openCopyWeekDialog,
    closeCopyWeekDialog,
    updateScheduleDraft,
    updateCopyWeekDraft,
    saveSchedule,
    copyWeek,
    removeSchedule
  };
}
