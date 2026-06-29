import type { CoachWeekDay } from "../../models/schedule";
import { useI18n } from "../../providers/I18nProvider";

export function WeekStrip({ days, selectedDate, onSelectDate }: { days: CoachWeekDay[]; selectedDate: string; onSelectDate: (date: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="coach-week-strip">
      {days.map((day) => (
        <button
          key={day.key}
          type="button"
          className={`coach-day-pill ${selectedDate === day.key ? "is-active" : ""}`}
          onClick={() => onSelectDate(day.key)}
        >
          <span>{t(day.label)}</span>
          <strong>{day.dayNumber}</strong>
        </button>
      ))}
    </div>
  );
}
