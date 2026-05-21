import type { RefObject, TouchEvent } from "react";
import type { CoachSessionState, PlaybackSession } from "../../models/playback";
import type { CoachPreviewItem, TvDailySchedule } from "../../models/schedule";
import { shortSessionId } from "../../utils/format";
import { sessionStateLabel } from "../../utils/playback";
import { buildScheduleRange, formatDateLabel } from "../../utils/time";

interface PreviewPanelProps {
  activePreviewItem: CoachPreviewItem | null;
  displayElapsedMs: number;
  onSetPreviewIndex: (index: number | ((current: number) => number)) => void;
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
  playbackSession: PlaybackSession | null;
  previewIndex: number;
  previewItems: CoachPreviewItem[];
  previewVideoRef: RefObject<HTMLVideoElement>;
  selectedSchedule: TvDailySchedule | null;
  selectedScheduleId: string;
  selectedScheduleSessionState: CoachSessionState;
}

export function PreviewPanel(props: PreviewPanelProps) {
  if (!props.selectedSchedule) {
    return <div className="coach-preview-panel"><div className="coach-empty-block is-large">点选上方课程，先进入 preview，再开始课程。</div></div>;
  }
  const { selectedSchedule, selectedScheduleSessionState } = props;
  return (
    <div className="coach-preview-panel">
      <div className="coach-preview-head">
        <div>
          <h2>{selectedSchedule.courseName}</h2>
          <p>{formatDateLabel(selectedSchedule.beginTime)} · {buildScheduleRange(selectedSchedule)}</p>
        </div>
        <span className={`coach-preview-state is-${selectedScheduleSessionState.toLowerCase()}`}>{sessionStateLabel(selectedScheduleSessionState)}</span>
      </div>
      <SessionMeta {...props} />
      <PreviewStage {...props} />
      <PreviewDots {...props} />
    </div>
  );
}

function SessionMeta(props: PreviewPanelProps) {
  const isSelected = props.playbackSession && String(props.playbackSession.scheduleId) === String(props.selectedScheduleId);
  if (!isSelected || !props.playbackSession) return null;
  return (
    <div className="coach-session-meta">
      <span>Session {shortSessionId(props.playbackSession.id)}</span>
      <span>v{props.playbackSession.version}</span>
      <span>{props.playbackSession.lastCommandId ? `cmd ${shortSessionId(props.playbackSession.lastCommandId)}` : "cmd --"}</span>
      {props.playbackSession.serverStartAtMs > 0 ? <span>elapsed {Math.floor(props.displayElapsedMs / 1000)}s</span> : null}
    </div>
  );
}

function PreviewStage(props: PreviewPanelProps) {
  return (
    <div className="coach-preview-stage">
      <div className="coach-preview-frame" onTouchStart={props.onTouchStart} onTouchEnd={props.onTouchEnd}>
        {props.activePreviewItem?.mediaUrl ? (
          <video
            key={props.activePreviewItem.id}
            ref={props.previewVideoRef}
            className="coach-preview-video"
            src={props.activePreviewItem.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = 0;
              void event.currentTarget.play().catch(() => undefined);
            }}
            onCanPlay={(event) => void event.currentTarget.play().catch(() => undefined)}
          />
        ) : <div className="coach-preview-empty">正式组还没有可预览的视频。</div>}
        <PreviewNav {...props} />
      </div>
      <div className="coach-preview-caption">
        <strong>{props.activePreviewItem?.actionName || "预览视频"}</strong>
        {props.previewItems.length ? <span className="coach-preview-index">{props.previewIndex + 1} / {props.previewItems.length}</span> : null}
        <span>左右滑动切换正式组动作。课程卡片里的按钮负责预览、开始和课堂控制。</span>
      </div>
    </div>
  );
}

function PreviewNav(props: PreviewPanelProps) {
  if (props.previewItems.length <= 1) return null;
  return (
    <>
      <button type="button" className="coach-preview-nav is-prev" onClick={() => props.onSetPreviewIndex((current) => Math.max(current - 1, 0))} disabled={props.previewIndex === 0}>‹</button>
      <button type="button" className="coach-preview-nav is-next" onClick={() => props.onSetPreviewIndex((current) => Math.min(current + 1, props.previewItems.length - 1))} disabled={props.previewIndex >= props.previewItems.length - 1}>›</button>
    </>
  );
}

function PreviewDots(props: PreviewPanelProps) {
  if (props.previewItems.length <= 1) return null;
  return (
    <div className="coach-preview-dots">
      {props.previewItems.map((item, index) => (
        <button key={item.id} type="button" className={`coach-preview-dot ${props.previewIndex === index ? "is-active" : ""}`} onClick={() => props.onSetPreviewIndex(index)} aria-label={`查看第 ${index + 1} 个动作`} />
      ))}
    </div>
  );
}
