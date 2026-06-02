import type { CoachSessionState } from "../../models/playback";
import type { CoachCourseScript, CoachPod, CoachPodScreen, CoachVideoGroup, TvDailySchedule } from "../../models/schedule";
import { buildCourseLogo } from "../../utils/format";
import { buildScheduleBadge } from "../../utils/playback";

interface ScheduleListProps {
  pendingAction: string;
  schedules: TvDailySchedule[];
  selectedScheduleId: string;
  onEnterPreview: (schedule: TvDailySchedule) => void;
  onExitPreview: (schedule: TvDailySchedule) => void;
  onPause: () => void;
  onResume: () => void;
  onSelect: (schedule: TvDailySchedule) => void;
  onShowPlan: (schedule: TvDailySchedule) => void;
  onStart: (schedule: TvDailySchedule) => void;
  onTerminate: () => void;
  sessionStateForSchedule: (schedule: TvDailySchedule) => CoachSessionState;
}

interface ScheduleCardInfo {
  name: string;
  topic: string;
  description: string;
  stationText: string;
  workText: string;
  restText: string;
  rotationText: string;
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
          const badge = buildScheduleBadge(scheduleState);
          const isSelected = String(schedule.id) === String(selectedScheduleId);
          const showRunningActions = scheduleState === "SCHEDULED" || scheduleState === "RUNNING" || scheduleState === "PAUSED";
          const info = buildScheduleCardInfo(schedule);
          return (
            <article key={schedule.id} className={`coach-schedule-card ${isSelected ? "is-selected" : ""}`}>
              <button type="button" className="coach-schedule-main" disabled={Boolean(pendingAction)} onClick={() => props.onSelect(schedule)}>
                <div className="coach-schedule-logo">{buildCourseLogo(info.name)}</div>
                <div className="coach-schedule-copy">
                  <div className="coach-schedule-title-row">
                    <span className="coach-schedule-topic">{info.topic}</span>
                    <span className={`coach-schedule-badge is-${badge.tone}`}>{badge.label}</span>
                  </div>
                  <strong>{info.name}</strong>
                  <p>{info.description}</p>
                  <div className="coach-schedule-metrics" aria-label="课程训练信息">
                    <ScheduleMetric label="站点" value={info.stationText} />
                    <ScheduleMetric label="WORK" value={info.workText} />
                    <ScheduleMetric label="REST" value={info.restText} />
                    <ScheduleMetric label="换站" value={info.rotationText} />
                  </div>
                </div>
              </button>
              {isSelected ? <ScheduleActions schedule={schedule} scheduleState={scheduleState} showRunningActions={showRunningActions} {...props} /> : null}
            </article>
          );
        }) : <div className="coach-empty-block">这一天还没有排课。</div>}
      </div>
    </div>
  );
}

function ScheduleMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="coach-schedule-metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function ScheduleActions(props: ScheduleListProps & { schedule: TvDailySchedule; scheduleState: CoachSessionState; showRunningActions: boolean }) {
  if (props.showRunningActions) {
    return (
      <div className="coach-schedule-actions">
        <button type="button" className="ghost-button" disabled={Boolean(props.pendingAction)} onClick={() => props.onShowPlan(props.schedule)}>
          计划
        </button>
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
      <button type="button" className="ghost-button" disabled={Boolean(props.pendingAction)} onClick={() => props.onShowPlan(props.schedule)}>
        计划
      </button>
      <button
        type="button"
        className="ghost-button"
        disabled={Boolean(props.pendingAction)}
        onClick={() => props.scheduleState === "PREVIEW" ? props.onExitPreview(props.schedule) : props.onEnterPreview(props.schedule)}
      >
        {props.scheduleState === "PREVIEW" ? "退出预览" : "预览"}
      </button>
      <button type="button" className="primary-button" disabled={Boolean(props.pendingAction)} onClick={() => props.onStart(props.schedule)}>
        {props.pendingAction ? "处理中..." : "开始"}
      </button>
    </div>
  );
}

function buildScheduleCardInfo(schedule: TvDailySchedule): ScheduleCardInfo {
  const course = schedule.course?.script || null;
  const metadata = course?.metadata || {};
  const rotationType = firstText(metadata.rotationType, schedule.rotationType, "REGION").toUpperCase();
  const pod = findFirstSchedulePod(course);
  const screen = findFirstScheduleScreen(pod);
  const group = findScheduleVideoGroup(course, pod?.videoGroupId || "");

  return {
    name: firstText(metadata.name, schedule.courseName, "未命名课程"),
    topic: firstText(metadata.topic, schedule.topic, "综合训练"),
    description: firstText(metadata.description, schedule.description, "按教练编排完成今日训练。"),
    stationText: buildScheduleStationText(group),
    workText: buildScheduleWorkText(screen, metadata),
    restText: buildScheduleRestText(screen, metadata),
    rotationText: buildRotationText(rotationType)
  };
}

function firstText(...values: Array<unknown>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function findFirstSchedulePod(course: CoachCourseScript | null): CoachPod | null {
  const pods = course?.training?.pods || [];
  return pods.find((pod) => Boolean(pod?.videoGroupId)) || pods[0] || null;
}

function findFirstScheduleScreen(pod: CoachPod | null): CoachPodScreen | null {
  const screens = pod?.screens || [];
  return screens.find((screen) => Boolean(screen?.setConfigs?.length)) || screens[0] || null;
}

function findScheduleVideoGroup(course: CoachCourseScript | null, videoGroupId: string): CoachVideoGroup | null {
  if (!videoGroupId) return null;
  return (course?.training?.videoGroups || []).find((group) => group.id === videoGroupId) || null;
}

function buildScheduleStationText(group: CoachVideoGroup | null): string {
  if (!group) return "-";
  const stationNumbers = new Set<string>();
  let cardCount = 0;
  for (const screen of group.screens || []) {
    for (const card of screen.videoCards || []) {
      if (firstText(card.actionId, card.actionName)) {
        cardCount += 1;
      }
      const stationNumber = firstText(card.stationNumber);
      if (stationNumber) {
        stationNumbers.add(stationNumber);
      }
    }
  }

  const stationCount = stationNumbers.size || cardCount;
  return stationCount > 0 ? `${stationCount} 站` : "-";
}

function buildScheduleWorkText(screen: CoachPodScreen | null, metadata: NonNullable<CoachCourseScript["metadata"]>): string {
  const seconds = uniquePositiveSeconds((screen?.setConfigs || []).map((config) => config.workSeconds));
  if (!seconds.length) {
    seconds.push(...uniquePositiveSeconds([metadata.trainingPanel?.workSeconds, metadata.workSeconds]));
  }
  return formatScheduleSeconds(seconds);
}

function buildScheduleRestText(screen: CoachPodScreen | null, metadata: NonNullable<CoachCourseScript["metadata"]>): string {
  const seconds = uniquePositiveSeconds((screen?.setConfigs || []).map((config) => config.restSeconds));
  if (!seconds.length) {
    seconds.push(...uniquePositiveSeconds([screen?.stationRestSeconds, metadata.trainingPanel?.restSeconds, metadata.restSeconds]));
  }
  return formatScheduleSeconds(seconds);
}

function uniquePositiveSeconds(values: Array<unknown>): number[] {
  const result: number[] = [];
  values.forEach((value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && !result.includes(numeric)) {
      result.push(numeric);
    }
  });
  return result;
}

function formatScheduleSeconds(seconds: number[]): string {
  return seconds.length ? `${seconds.join("/")}s` : "-";
}

function buildRotationText(rotationType: string): string {
  if (rotationType === "LANE") return "跑道换站";
  if (rotationType === "SNAKE") return "蛇形换站";
  return "区域轮转";
}
