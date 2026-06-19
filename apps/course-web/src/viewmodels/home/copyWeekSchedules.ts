import type { CopyWeekSchedulesPayload } from "../../services/api/schedules.ts";
import { addDaysValue, todayValue, weekStartValue } from "../../utils/datetime.ts";

export interface CopyWeekSchedulesDraftValue {
  sourceWeekStart: string;
  targetWeekStart: string;
}

export type CopyWeekSchedulesPayloadResult =
  | {
      ok: true;
      payload: CopyWeekSchedulesPayload;
    }
  | {
      ok: false;
      message: string;
    };

export function createCopyWeekSchedulesDraft(currentDate = todayValue()): CopyWeekSchedulesDraftValue {
  const currentWeekStart = weekStartValue(currentDate);
  return {
    sourceWeekStart: addDaysValue(currentWeekStart, -7),
    targetWeekStart: addDaysValue(currentWeekStart, 7)
  };
}

export function buildCopyWeekSchedulesPayload({
  coursePackageId,
  draft,
  currentDate = todayValue(),
  replaceExisting = false
}: {
  coursePackageId?: number | string | null;
  draft?: CopyWeekSchedulesDraftValue | null;
  currentDate?: string;
  replaceExisting?: boolean;
}): CopyWeekSchedulesPayloadResult {
  const activeCoursePackageId = Number(coursePackageId) || 0;
  if (!activeCoursePackageId) {
    return {
      ok: false,
      message: "当前课程包为空，不能复制排课。"
    };
  }
  if (!draft?.sourceWeekStart || !draft.targetWeekStart) {
    return {
      ok: false,
      message: "请选择来源周和目标周。"
    };
  }

  const currentWeekStart = weekStartValue(currentDate);
  const sourceWeekStart = weekStartValue(draft.sourceWeekStart);
  const targetWeekStart = weekStartValue(draft.targetWeekStart);
  if (sourceWeekStart >= currentWeekStart) {
    return {
      ok: false,
      message: "来源周只能选择过去周。"
    };
  }
  if (targetWeekStart <= currentWeekStart) {
    return {
      ok: false,
      message: "目标周只能选择未来周。"
    };
  }

  return {
    ok: true,
    payload: {
      coursePackageId: activeCoursePackageId,
      sourceWeekStart,
      targetWeekStart,
      replaceExisting
    }
  };
}
