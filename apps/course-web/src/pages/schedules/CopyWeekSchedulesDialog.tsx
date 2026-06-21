import Dialog from "../../components/Dialog.tsx";
import { addDaysValue, todayValue, weekStartValue } from "../../utils/datetime.ts";
import type { CopyWeekSchedulesDraftValue } from "../../viewmodels/home/copyWeekSchedules.ts";

function normalizeWeekStart(value: string): string {
  return value ? weekStartValue(value) : "";
}

function formatDateLabel(value: string): string {
  return value ? value.replace(/-/g, "/") : "--";
}

function formatWeekRange(value: string): string {
  if (!value) return "--";
  const weekStart = weekStartValue(value);
  return `${formatDateLabel(weekStart)} - ${formatDateLabel(addDaysValue(weekStart, 6))}`;
}

export default function CopyWeekSchedulesDialog({
  draft,
  onDraftChange,
  onClose,
  onConfirm
}: {
  draft: CopyWeekSchedulesDraftValue;
  onDraftChange: (updater: (current: CopyWeekSchedulesDraftValue) => CopyWeekSchedulesDraftValue) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const currentWeekStart = weekStartValue(todayValue());
  const sourceMax = addDaysValue(currentWeekStart, 6);
  const targetMin = addDaysValue(currentWeekStart, 7);
  const confirmDisabled =
    !draft.sourceWeekStart ||
    !draft.targetWeekStart ||
    draft.sourceWeekStart > currentWeekStart ||
    draft.targetWeekStart <= currentWeekStart;

  return (
    <Dialog title="复制指定周排课" width={520} onClose={onClose} onConfirm={onConfirm} confirmText="复制" confirmDisabled={confirmDisabled}>
      <div className="dialog-form copy-week-dialog">
        <label className="field">
          <span>来源周</span>
          <input
            type="date"
            max={sourceMax}
            value={draft.sourceWeekStart}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                sourceWeekStart: normalizeWeekStart(event.target.value)
              }))
            }
          />
          <small>过去周或本周 · {formatWeekRange(draft.sourceWeekStart)}</small>
        </label>

        <label className="field">
          <span>目标周</span>
          <input
            type="date"
            min={targetMin}
            value={draft.targetWeekStart}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                targetWeekStart: normalizeWeekStart(event.target.value)
              }))
            }
          />
          <small>未来周 · {formatWeekRange(draft.targetWeekStart)}</small>
        </label>

        <p className="copy-week-note">来源周和目标周都会按周一作为起始日期。</p>
      </div>
    </Dialog>
  );
}
