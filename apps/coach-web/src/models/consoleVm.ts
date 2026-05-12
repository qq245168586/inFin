import type { AuthSession, NoticeTone } from "./common";
import type { WeekScheduleRecord } from "./schedule";

export interface CoachConsoleViewModelProps {
  authSession: AuthSession;
  currentWeekSchedules: WeekScheduleRecord[];
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

