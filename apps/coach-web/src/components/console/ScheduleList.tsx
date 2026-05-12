import type { CoachSessionState } from "../../models/playback";
import type { TvDailySchedule } from "../../models/schedule";
import { buildCourseLogo } from "../../utils/format";
import { buildScheduleBadge } from "../../utils/playback";
import { buildScheduleRange, scheduleStartAtMs } from "../../utils/time";

interface ScheduleListProps {
  pendingAction: string;
  schedules: TvDailySchedule[];
  selectedScheduleId: string;
  onEnterPreview: (schedule: TvDailySchedule) => void;
  onPause: () => void;
  onResume: () => void;
  onSelect: (schedule: TvDailySchedule) => void;
  onStart: (schedule: TvDailySchedule) => void;
  onTerminate: () => void;
  sessionStateForSchedule: (schedule: TvDailySchedule) => CoachSessionState;
}

export function ScheduleList(props: ScheduleListProps) {
  const { pendingAction, schedules, selectedScheduleId, sessionStateForSchedule } = props;
  return (
    <div className="coach-schedule-panel">
      <div className="coach-panel-head">
        <h2>今日课程表</h2>
        <span>{schedules.length} 节课程</span>
      </div>
      <div className="coach-schedule-list">
        {schedules.length ? schedules.map((schedule) => {
          const scheduleState = sessionStateForSchedule(schedule);
          const badge = buildScheduleBadge(scheduleState, scheduleStartAtMs(schedule), schedule.duration);
          const isSelected = String(schedule.id) === String(selectedScheduleId);
          const showRunningActions = scheduleState === "SCHEDULED" || scheduleState === "RUNNING" || scheduleState === "PAUSED";
          return (
            <article key={schedule.id} className={`coach-schedule-card ${isSelected ? "is-selected" : ""}`}>
              <button type="button" className="coach-schedule-main" disabled={Boolean(pendingAction)} onClick={() => props.onSelect(schedule)}>
                <div className="coach-schedule-logo">{buildCourseLogo(schedule.courseName)}</div>
                <div className="coach-schedule-copy">
                  <strong>{schedule.courseName}</strong>
                  <span>{buildScheduleRange(schedule)}</span>
                </div>
                <span className={`coach-schedule-badge is-${badge.tone}`}>{badge.label}</span>
              </button>
              {isSelected ? <ScheduleActions schedule={schedule} scheduleState={scheduleState} showRunningActions={showRunningActions} {...props} /> : null}
            </article>
          );
        }) : <div className="coach-empty-block">这一天还没有排课。</div>}
      </div>
    </div>
  );
}

function ScheduleActions(props: ScheduleListProps & { schedule: TvDailySchedule; scheduleState: CoachSessionState; showRunningActions: boolean }) {
  if (props.showRunningActions) {
    return (
      <div className="coach-schedule-actions">
        <button type="button" className="primary-button" disabled={Boolean(props.pendingAction)} onClick={() => props.scheduleState === "PAUSED" ? props.onResume() : props.onPause()}>
          {props.pendingAction ? "处理中..." : props.scheduleState === "PAUSED" ? "继续" : "暂停"}
        </button>
        <button
          type="button"
          className="ghost-button danger"
          disabled={Boolean(props.pendingAction)}
          onClick={() => window.confirm("是否结束当前课程？") && props.onTerminate()}
        >
          结束
        </button>
      </div>
    );
  }

  return (
    <div className="coach-schedule-actions">
      <button type="button" className="ghost-button" disabled={Boolean(props.pendingAction)} onClick={() => props.onEnterPreview(props.schedule)}>
        预览
      </button>
      <button type="button" className="primary-button" disabled={Boolean(props.pendingAction)} onClick={() => props.onStart(props.schedule)}>
        {props.pendingAction ? "处理中..." : "开始"}
      </button>
    </div>
  );
}

