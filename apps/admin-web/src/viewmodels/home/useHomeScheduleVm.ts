import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarDay, CalendarSchedule } from "../../components/CalendarBoard.tsx";
import type { CourseRecord } from "../../models/course/types.ts";
import { groupCoursesByName } from "../../models/course/groupCoursesByName.ts";
import type { HomeTabKey } from "../../app/navigation.ts";
import type { ScheduleCollection } from "../../services/api/meta.ts";
import { copyLastWeekSchedules, createSchedule, deleteSchedule } from "../../services/api/schedules.ts";
import { composeCnDateTime, todayValue } from "../../utils/datetime.ts";
import { getErrorMessage } from "../../utils/errors.ts";

export interface ScheduleDraftValue {
  courseName: string;
  courseId: string;
  version: string;
  date: string;
  time: string;
  duration: string;
}

function createScheduleDraft(courses: CourseRecord[], preferredDate = ""): ScheduleDraftValue {
  const first = [...courses].sort((left, right) => {
    if (left.name === right.name) {
      return left.version.localeCompare(right.version);
    }
    return left.name.localeCompare(right.name);
  })[0];

  return {
    courseName: first?.name ?? "",
    courseId: first ? String(first.id) : "",
    version: first?.version ?? "",
    date: preferredDate || todayValue(),
    time: "19:00",
    duration: "45"
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
  schedules,
  onBusyText,
  onNotice,
  onReloadMeta
}: {
  courses: CourseRecord[];
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
    return current;
  }, [homeTab, schedules.currentWeek, schedules.history, schedules.lastWeek]);

  const courseGroups = useMemo(() => groupCoursesByName(courses), [courses]);

  const openScheduleDialog = useCallback(() => {
    if (!courses.length) {
      onNotice("请先在课程页创建课程。", "error");
      return;
    }

    setScheduleDraft(createScheduleDraft(courses, selectedScheduleDate !== "all" ? selectedScheduleDate : ""));
  }, [courses, onNotice, selectedScheduleDate]);

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
    if (!scheduleDraft.date || !scheduleDraft.time) {
      onNotice("请选择课程日期和开始时间。", "error");
      return;
    }
    if (!scheduleDraft.duration || Number(scheduleDraft.duration) <= 0) {
      onNotice("请输入正确的课程时长。", "error");
      return;
    }

    onBusyText("正在保存排课...");
    try {
      await createSchedule({
        courseId: Number(scheduleDraft.courseId),
        version: scheduleDraft.version,
        beginTime: composeCnDateTime(scheduleDraft.date, scheduleDraft.time),
        duration: Number(scheduleDraft.duration)
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
    if (schedules.currentWeek.length && !window.confirm("本周已有排课，确认用上周排课覆盖本周吗？")) {
      return;
    }

    onBusyText("正在复制上周排课...");
    try {
      await copyLastWeekSchedules();
      await onReloadMeta();
      onNotice("上周排课已复制到本周。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }, [onBusyText, onNotice, onReloadMeta, schedules.currentWeek.length]);

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
