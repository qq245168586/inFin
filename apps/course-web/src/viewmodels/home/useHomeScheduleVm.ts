import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarDay, CalendarSchedule } from "../../components/CalendarBoard.tsx";
import type { CourseRecord } from "../../models/course/types.ts";
import { groupCoursesByName } from "../../models/course/groupCoursesByName.ts";
import type { HomeTabKey } from "../../app/navigation.ts";
import type { ScheduleCollection } from "../../services/api/meta.ts";
import type { CoursePackageRecord } from "../../pages/venues/types.ts";
import { copyLastWeekSchedules, createSchedule, deleteSchedule } from "../../services/api/schedules.ts";
import { composeCnDateTime, todayValue } from "../../utils/datetime.ts";
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

function getWeekDays(offsetWeeks: number): CalendarDay[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta + offsetWeeks * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
      current.getDate()
    ).padStart(2, "0")}`;

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
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("all");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftValue | null>(null);

  const weekDays = useMemo(() => getWeekDays(homeTab === "lastWeek" ? -1 : 0), [homeTab]);
  const weekDayKeysSignature = useMemo(() => weekDays.map((day) => day.key).join("|"), [weekDays]);

  useEffect(() => {
    if (selectedScheduleDate !== "all" && !weekDays.some((day) => day.key === selectedScheduleDate)) {
      setSelectedScheduleDate("all");
    }
  }, [selectedScheduleDate, weekDayKeysSignature, weekDays]);

  const visibleSchedules = useMemo<CalendarSchedule[]>(() => {
    const current =
      homeTab === "currentWeek" ? schedules.currentWeek : homeTab === "lastWeek" ? schedules.lastWeek : schedules.history;
    return current.map((schedule) => {
      const course = courses.find((item) => Number(item.id) === Number(schedule.courseId));
      return {
        ...schedule,
        date: schedule.date || schedule.beginTime?.slice(0, 10),
        description: schedule.description ?? course?.description ?? course?.script?.metadata?.description,
        topic: schedule.topic ?? course?.topic ?? course?.script?.metadata?.topic,
        rotationType: schedule.rotationType ?? course?.rotationType ?? course?.script?.metadata?.rotationType
      };
    });
  }, [courses, homeTab, schedules.currentWeek, schedules.history, schedules.lastWeek]);

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

    setScheduleDraft(createScheduleDraft(courses, coursePackages, selectedScheduleDate !== "all" ? selectedScheduleDate : ""));
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
