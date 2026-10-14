import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchSimulatorCourse, hasStoredAuthSession } from "./api.ts";
import { cacheCourseMedia, revokeCachedObjectUrls, type MediaCacheDiagnostic, type MediaCacheProgress } from "./mediaCache.ts";
import type { CoursePlan, CourseRecord, LocalPlaybackSession, SimulatorPlaybackState, TrainingScreenState, VideoCard, WaterfallItem, WaterfallScreenState } from "./types.ts";
import {
  HORIZONTAL_SCREEN,
  SIMULATED_VERTICAL_SCREENS,
  buildCourseStage,
  buildHorizontalProgress,
  buildPreviewTrainingState,
  buildTrainingScreenState,
  formatClock,
  getCooldownState,
  getCourseTotalSeconds,
  getWarmupState,
  scriptScreenIndexForPhysical,
  withResolvedMedia
} from "./playback.ts";

function createSession(courseId: number): LocalPlaybackSession {
  return {
    id: `sim-${Date.now().toString(36)}`,
    state: "IDLE",
    previousState: "IDLE",
    courseId,
    serverStartAtMs: 0,
    pausedAtMs: 0,
    pausedAccumulatedMs: 0,
    frozenElapsedMs: 0,
    plannedStartAtMs: 0
  };
}

function getCourseIdFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("courseId") || "";
  const courseId = Number(raw);
  return Number.isFinite(courseId) && courseId > 0 ? courseId : 0;
}

function sessionElapsedMs(session: LocalPlaybackSession, nowMs: number, totalMs: number): number {
  const state = session.state === "PLAN" ? session.previousState : session.state;
  if (state === "ENDED") return totalMs;
  if (state === "PAUSED") return Math.max(0, session.frozenElapsedMs);
  if (state === "RUNNING") return Math.max(0, nowMs - session.serverStartAtMs - session.pausedAccumulatedMs);
  return 0;
}

function nonPlanState(state: SimulatorPlaybackState, previous: LocalPlaybackSession["previousState"]): LocalPlaybackSession["previousState"] {
  return state === "PLAN" ? previous : state;
}

function emptyMediaCacheProgress(): MediaCacheProgress {
  return {
    status: "idle",
    completed: 0,
    total: 0,
    currentName: "",
    error: "",
    diagnostics: []
  };
}

export default function WebSimulatorApp() {
  const courseId = useMemo(getCourseIdFromUrl, []);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaCacheProgress, setMediaCacheProgress] = useState<MediaCacheProgress>(() => emptyMediaCacheProgress());
  const [notice, setNotice] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [session, setSession] = useState<LocalPlaybackSession>(() => createSession(courseId));
  const cachedObjectUrlsRef = useRef<string[]>([]);

  const totalSeconds = useMemo(() => getCourseTotalSeconds(course), [course]);
  const elapsedMs = sessionElapsedMs(session, nowMs, totalSeconds * 1000);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      revokeCachedObjectUrls(cachedObjectUrlsRef.current);
      cachedObjectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (session.state === "SCHEDULED" && session.plannedStartAtMs > 0 && nowMs >= session.plannedStartAtMs) {
      setSession((current) => ({ ...current, state: "RUNNING", previousState: "RUNNING" }));
    }
  }, [nowMs, session.plannedStartAtMs, session.state]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    revokeCachedObjectUrls(cachedObjectUrlsRef.current);
    cachedObjectUrlsRef.current = [];
    setCourse(null);
    setMediaCacheProgress(emptyMediaCacheProgress());
    setSession(createSession(courseId));

    if (!courseId) {
      setError("URL 缺少有效的 courseId。");
      setLoading(false);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (!hasStoredAuthSession()) {
      setError("请先在课程端登录，再从课程列表打开模拟器。");
      setLoading(false);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    setLoading(true);
    fetchSimulatorCourse(courseId)
      .then(async ({ course: loadedCourse, actions }) => {
        if (cancelled) return;
        const resolvedCourse = withResolvedMedia(loadedCourse, actions);
        const cachedMedia = await cacheCourseMedia(resolvedCourse, {
          signal: abortController.signal,
          onProgress: (progress) => {
            if (!cancelled) setMediaCacheProgress(progress);
          }
        });
        if (cancelled) {
          revokeCachedObjectUrls(cachedMedia.objectUrls);
          return;
        }
        cachedObjectUrlsRef.current = cachedMedia.objectUrls;
        setCourse(cachedMedia.course);
        setSession(createSession(cachedMedia.course.id));
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) return;
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        const message = loadError instanceof Error ? loadError.message : "加载课程失败。";
        setMediaCacheProgress((current) => ({
          ...current,
          status: "failed",
          error: message
        }));
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [courseId]);

  function pushNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function preview() {
    setSession((current) => ({
      ...current,
      state: "PREVIEW",
      previousState: "PREVIEW",
      serverStartAtMs: 0,
      pausedAtMs: 0,
      pausedAccumulatedMs: 0,
      frozenElapsedMs: 0,
      plannedStartAtMs: 0
    }));
    pushNotice("已进入本地预览，不会控制真实 TV。");
  }

  function start() {
    const startAt = Date.now() + 5000;
    setSession((current) => ({
      ...current,
      state: "SCHEDULED",
      previousState: "SCHEDULED",
      serverStartAtMs: startAt,
      plannedStartAtMs: startAt,
      pausedAtMs: 0,
      pausedAccumulatedMs: 0,
      frozenElapsedMs: 0
    }));
    pushNotice("课程将在 5 秒后开始。");
  }

  function pause() {
    if (session.state === "PAUSED") return;
    const frozenElapsedMs = sessionElapsedMs(session, Date.now(), totalSeconds * 1000);
    setSession((current) => ({
      ...current,
      state: "PAUSED",
      previousState: nonPlanState(current.state, current.previousState),
      pausedAtMs: Date.now(),
      frozenElapsedMs
    }));
    pushNotice("已暂停本地模拟。");
  }

  function resume() {
    if (session.state !== "PAUSED") return;
    const now = Date.now();
    const pauseDuration = Math.max(0, now - session.pausedAtMs);
    if (session.previousState === "SCHEDULED") {
      const remainingCountdownMs = Math.max(0, session.plannedStartAtMs - session.pausedAtMs);
      const nextStartAtMs = now + remainingCountdownMs;
      const nextState = remainingCountdownMs > 0 ? "SCHEDULED" : "RUNNING";
      setSession((current) => ({
        ...current,
        state: nextState,
        previousState: nextState,
        pausedAtMs: 0,
        serverStartAtMs: nextStartAtMs,
        plannedStartAtMs: nextStartAtMs
      }));
      pushNotice("已继续本地模拟。");
      return;
    }
    setSession((current) => ({
      ...current,
      state: "RUNNING",
      previousState: "RUNNING",
      pausedAtMs: 0,
      pausedAccumulatedMs: current.pausedAccumulatedMs + pauseDuration
    }));
    pushNotice("已继续本地模拟。");
  }

  function togglePlan() {
    setSession((current) => {
      if (current.state === "PLAN") {
        return { ...current, state: current.previousState };
      }
      return { ...current, state: "PLAN", previousState: nonPlanState(current.state, current.previousState) };
    });
  }

  function endCourse() {
    setSession((current) => ({
      ...current,
      state: "ENDED",
      previousState: "ENDED",
      frozenElapsedMs: totalSeconds * 1000
    }));
    pushNotice("课程已结束。");
  }

  function reset() {
    setSession(createSession(course?.id || courseId));
    pushNotice("已重置模拟器。");
  }

  const effectiveState = session.state === "PLAN" ? session.previousState : session.state;
  const countdownSeconds = Math.max(0, Math.ceil((session.plannedStartAtMs - nowMs) / 1000));
  const controlsReady = Boolean(course) && !loading && mediaCacheProgress.status === "ready";

  return (
    <div className="sim-app">
      <header className="sim-toolbar">
        <div className="sim-title-block">
          <span className="sim-eyebrow">Infini TV Simulator</span>
          <h1>{course?.name || "课程模拟器"}</h1>
          <div className="sim-meta">
            <span>Course {courseId || "--"}</span>
            <span>{course?.version ? `Version ${course.version}` : "Version --"}</span>
            <span>{effectiveState}</span>
            <span>
              {formatClock(elapsedSeconds)} / {formatClock(totalSeconds)}
            </span>
          </div>
        </div>
        <div className="sim-controls" aria-label="模拟控制">
          <button type="button" onClick={preview} disabled={!controlsReady}>预览</button>
          <button type="button" className="is-primary" onClick={start} disabled={!controlsReady}>开始课程</button>
          {session.state === "PAUSED" ? (
            <button type="button" onClick={resume} disabled={!controlsReady}>继续</button>
          ) : (
            <button type="button" onClick={pause} disabled={!controlsReady || !["SCHEDULED", "RUNNING", "PLAN"].includes(session.state)}>暂停</button>
          )}
          <button type="button" onClick={togglePlan} disabled={!controlsReady}>{session.state === "PLAN" ? "关闭计划" : "计划"}</button>
          <button type="button" onClick={endCourse} disabled={!controlsReady}>结束</button>
          <button type="button" onClick={reset} disabled={!controlsReady}>重置</button>
        </div>
      </header>

      {notice ? <div className="sim-toast">{notice}</div> : null}

      {loading || error ? (
        <main className="sim-message-panel">
          <div>
            <span>{loading ? "Loading" : "Error"}</span>
            <h2>{loading ? "正在准备课程资源..." : error}</h2>
            <MediaCacheStatus progress={mediaCacheProgress} />
            {!loading && error ? <a href="../">回到课程端</a> : null}
          </div>
        </main>
      ) : (
        <main className="sim-stage" aria-label="TV 四屏模拟">
          <div className="vertical-screen-row">
            {SIMULATED_VERTICAL_SCREENS.map((screenNumber) => (
              <TvScreenFrame key={screenNumber} screenNumber={screenNumber} orientation="vertical">
                <VerticalScreen
                  course={course}
                  screenNumber={screenNumber}
                  playbackState={session.state}
                  effectiveState={effectiveState}
                  elapsedSeconds={elapsedSeconds}
                  countdownSeconds={countdownSeconds}
                />
              </TvScreenFrame>
            ))}
          </div>
          <TvScreenFrame screenNumber={HORIZONTAL_SCREEN} orientation="horizontal">
            <HorizontalScreen
              course={course}
              playbackState={session.state}
              effectiveState={effectiveState}
              elapsedSeconds={elapsedSeconds}
              countdownSeconds={countdownSeconds}
            />
          </TvScreenFrame>
        </main>
      )}
    </div>
  );
}

function TvScreenFrame({ children, orientation, screenNumber }: { children: ReactNode; orientation: "vertical" | "horizontal"; screenNumber: number }) {
  return (
    <section className={`tv-frame is-${orientation}`} aria-label={`屏幕 ${screenNumber}`}>
      <div className="tv-frame-bar">
        <strong>SCREEN {screenNumber}</strong>
        <span>{orientation === "horizontal" ? "16:9" : "9:16"}</span>
      </div>
      <div className="tv-surface">{children}</div>
    </section>
  );
}

function MediaCacheStatus({ progress }: { progress: MediaCacheProgress }) {
  if (progress.status === "idle") return null;
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100;
  const title =
    progress.status === "ready"
      ? "课程视频已缓存"
      : progress.status === "failed"
        ? "课程视频缓存失败"
        : progress.total > 0
          ? `正在缓存视频 ${progress.completed}/${progress.total}`
          : "正在检查课程视频";
  return (
    <div className={`media-cache-status is-${progress.status}`}>
      <div className="media-cache-row">
        <strong>{title}</strong>
        <span>{percent}%</span>
      </div>
      <div className="media-cache-bar" aria-label="视频缓存进度">
        <span style={{ width: `${percent}%` }} />
      </div>
      {progress.currentName ? <p>当前资源：{progress.currentName}</p> : null}
      {progress.error ? <p>{progress.error}</p> : null}
      {progress.diagnostics.length ? (
        <details className="media-cache-log">
          <summary>诊断日志</summary>
          <pre>{progress.diagnostics.slice(-18).map(formatMediaCacheDiagnostic).join("\n")}</pre>
        </details>
      ) : null}
    </div>
  );
}

function formatMediaCacheDiagnostic(diagnostic: MediaCacheDiagnostic): string {
  const parts = [
    `#${diagnostic.index}/${diagnostic.total}`,
    diagnostic.event,
    diagnostic.mode,
    diagnostic.name,
    diagnostic.httpStatus ? `http=${diagnostic.httpStatus}` : "",
    diagnostic.bytes ? `${Math.round(diagnostic.bytes / 1024)}KB` : "",
    diagnostic.durationMs ? `${diagnostic.durationMs}ms` : "",
    diagnostic.speedKbps ? `${diagnostic.speedKbps}KB/s` : "",
    diagnostic.origin
  ].filter(Boolean);
  return `${parts.join(" | ")}${diagnostic.error ? ` | ${diagnostic.error}` : ""}`;
}

function VerticalScreen({
  course,
  countdownSeconds,
  effectiveState,
  elapsedSeconds,
  playbackState,
  screenNumber
}: {
  course: CourseRecord | null;
  countdownSeconds: number;
  effectiveState: SimulatorPlaybackState;
  elapsedSeconds: number;
  playbackState: SimulatorPlaybackState;
  screenNumber: number;
}) {
  const scriptScreenIndex = scriptScreenIndexForPhysical(screenNumber);
  if (!course) return <IdleSurface title="NO COURSE" copy="没有课程数据" />;
  if (playbackState === "PLAN") return <CoursePlanSurface courseName={course.name} plan={course.script?.plan} />;
  if (effectiveState === "IDLE") return <IdleSurface title={course.name} copy="等待预览或开始课程" />;
  if (effectiveState === "PREVIEW") {
    const previewState = buildPreviewTrainingState(course, scriptScreenIndex);
    return previewState ? <TrainingStateView state={previewState} paused={false} preview /> : <IdleSurface title={course.name} copy="暂无正式组内容" />;
  }
  if (effectiveState === "SCHEDULED") return <ReadySurface seconds={countdownSeconds} />;
  if (effectiveState === "ENDED") return <FinishSurface title={course.name} />;

  const stage = buildCourseStage(course, elapsedSeconds);
  if (stage.stage === "warmup") return <WaterfallStateView state={getWarmupState(course, stage.offsetSeconds)} label="WARM UP" paused={effectiveState === "PAUSED"} />;
  if (stage.stage === "cooldown") return <WaterfallStateView state={getCooldownState(course, stage.offsetSeconds)} label="COOL DOWN" paused={effectiveState === "PAUSED"} />;
  if (stage.stage === "finished") return <FinishSurface title={course.name} />;

  const trainingState = buildTrainingScreenState(course, scriptScreenIndex, stage.offsetSeconds);
  return trainingState ? <TrainingStateView state={trainingState} paused={effectiveState === "PAUSED"} /> : <IdleSurface title="TRAINING" copy="当前屏幕暂无动作" />;
}

function HorizontalScreen({
  course,
  countdownSeconds,
  effectiveState,
  elapsedSeconds,
  playbackState
}: {
  course: CourseRecord | null;
  countdownSeconds: number;
  effectiveState: SimulatorPlaybackState;
  elapsedSeconds: number;
  playbackState: SimulatorPlaybackState;
}) {
  if (!course) return <IdleSurface title="NO COURSE" copy="没有课程数据" />;
  if (playbackState === "PLAN") return <CoursePlanSurface courseName={course.name} plan={course.script?.plan} horizontal />;
  const progress = buildHorizontalProgress(course, elapsedSeconds);
  if (effectiveState === "IDLE") {
    return <HorizontalMainState course={course} progress={progress} primaryText="WAITING" remainingSeconds={0} />;
  }
  if (effectiveState === "PREVIEW") {
    const previewState = buildPreviewTrainingState(course, 1);
    return (
      <HorizontalMainState
        course={course}
        progress={progress}
        primaryText={previewState?.stageProgress || "PREVIEW"}
        secondaryText={previewState?.stageSecondaryText || ""}
        remainingSeconds={previewState?.remainingSeconds || 0}
        completedDots={previewState?.completedDots || 0}
        totalDots={previewState?.totalDots || 0}
      />
    );
  }
  if (effectiveState === "SCHEDULED") {
    return <HorizontalMainState course={course} progress={progress} primaryText={"READY FOR\nWARM UP"} remainingSeconds={countdownSeconds} />;
  }
  if (effectiveState === "ENDED") return <FinishSurface title={course.name} horizontal />;

  const stage = buildCourseStage(course, elapsedSeconds);
  if (stage.stage === "warmup") {
    const state = getWarmupState(course, stage.offsetSeconds);
    return <HorizontalMainState course={course} progress={progress} primaryText="WARM UP" remainingSeconds={state.remainingSeconds} paused={effectiveState === "PAUSED"} />;
  }
  if (stage.stage === "cooldown") {
    const state = getCooldownState(course, stage.offsetSeconds);
    return <HorizontalMainState course={course} progress={progress} primaryText="COOL DOWN" remainingSeconds={state.remainingSeconds} paused={effectiveState === "PAUSED"} />;
  }
  if (stage.stage === "finished") return <FinishSurface title={course.name} horizontal />;

  const trainingState = buildTrainingScreenState(course, 1, stage.offsetSeconds);
  return (
    <HorizontalMainState
      course={course}
      progress={progress}
      primaryText={trainingState?.stageProgress || "TRAINING"}
      secondaryText={trainingState?.stageSecondaryText || ""}
      remainingSeconds={trainingState?.remainingSeconds || 0}
      completedDots={trainingState?.completedDots || 0}
      totalDots={trainingState?.totalDots || 0}
      paused={effectiveState === "PAUSED"}
    />
  );
}

function IdleSurface({ copy, title }: { title: string; copy: string }) {
  return (
    <div className="tv-idle">
      <span>INFINI</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function ReadySurface({ seconds }: { seconds: number }) {
  return (
    <div className="tv-ready">
      <span>GET READY</span>
      <strong>{seconds}</strong>
      <p>课程即将开始</p>
    </div>
  );
}

function FinishSurface({ horizontal = false, title }: { title: string; horizontal?: boolean }) {
  return (
    <div className={`tv-finish${horizontal ? " is-horizontal" : ""}`}>
      <span>FINISH</span>
      <h2>{title}</h2>
      <p>COURSE COMPLETE</p>
    </div>
  );
}

function VideoPreview({ active, label, src }: { src: string; label: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed || !src) return;
    if (active) {
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active, failed, src]);

  if (!src || failed) {
    return <div className="video-empty">{label || "NO MEDIA"}</div>;
  }
  return (
    <video
      ref={videoRef}
      key={src}
      src={src}
      muted
      playsInline
      loop
      autoPlay={active}
      preload="auto"
      controls={false}
      onCanPlay={() => {
        if (active) videoRef.current?.play().catch(() => undefined);
      }}
      onError={() => setFailed(true)}
    />
  );
}

function WaterfallStateView({ label, paused, state }: { state: WaterfallScreenState; label: string; paused: boolean }) {
  const maxWindowStart = Math.max(state.items.length - 3, 0);
  const windowStart = Math.min(Math.max(state.activeIndex - 1, 0), maxWindowStart);
  const visible = state.items.slice(windowStart, windowStart + 3);
  return (
    <div className="tv-waterfall">
      <ScreenCountdown label={label} progress={`${state.activeIndex + 1} / ${Math.max(state.items.length, 1)}`} seconds={state.remainingSeconds} />
      <div className="waterfall-list">
        {visible.map((item, index) => {
          const itemIndex = windowStart + index;
          const active = itemIndex === state.activeIndex && !paused;
          return (
            <div className={`waterfall-row is-media-only${active ? " is-active" : ""}`} key={`${item.id || item.actionId}-${itemIndex}`}>
              <VideoPreview src={item.mediaUrl || ""} label={item.actionName || `Action ${itemIndex + 1}`} active={!paused} />
            </div>
          );
        })}
      </div>
      {paused ? <PauseOverlay /> : null}
    </div>
  );
}

function ScreenCountdown({ label, progress, seconds }: { label: string; progress: string; seconds: number }) {
  return (
    <div className="screen-countdown">
      <span>{label}</span>
      <strong>{formatClock(seconds)}</strong>
      <em>{progress}</em>
    </div>
  );
}

function TrainingStateView({ paused, preview = false, state }: { state: TrainingScreenState; paused: boolean; preview?: boolean }) {
  const transition = state.mode === "transition" || Boolean(state.transitionType);
  return (
    <div className={`tv-training${state.mode === "waterfall" ? " is-waterfall" : ""}${transition ? " is-transition" : ""}`}>
      <ScreenCountdown
        label={preview ? "PREVIEW" : state.stageLabel || "TRAINING"}
        progress={state.stageProgress || state.transitionType || state.podName}
        seconds={state.remainingSeconds}
      />
      {transition && !state.displayCards.length ? (
        <div className="transition-panel">
          <span>{state.transitionType || state.stageProgress || "READY"}</span>
        </div>
      ) : state.mode === "waterfall" ? (
        <TrainingWaterfall state={state} paused={paused} />
      ) : (
        <StationCardGrid state={state} paused={paused} />
      )}
      {state.hintText ? <div className="training-hint">{state.hintText}</div> : null}
      {state.totalDots > 0 ? <DotRow completed={state.completedDots} total={state.totalDots} /> : null}
      {paused ? <PauseOverlay /> : null}
    </div>
  );
}

function TrainingWaterfall({ paused, state }: { state: TrainingScreenState; paused: boolean }) {
  const maxWindowStart = Math.max(state.displayCards.length - 3, 0);
  const windowStart = Math.min(Math.max(state.activeCardIndex - 1, 0), maxWindowStart);
  return (
    <div className="waterfall-list">
      {state.displayCards.slice(windowStart, windowStart + 3).map((card, index) => {
        const cardIndex = windowStart + index;
        const active = state.playActiveCard && cardIndex === state.activeCardIndex && !paused;
        return (
          <div className={`waterfall-row is-media-only${active ? " is-active" : ""}`} key={`${card.id || card.actionId}-${cardIndex}`}>
            <VideoPreview src={card.mediaUrl || ""} label={card.actionName || `Action ${cardIndex + 1}`} active={!paused} />
          </div>
        );
      })}
    </div>
  );
}

function StationCardGrid({ paused, state }: { state: TrainingScreenState; paused: boolean }) {
  const rows: VideoCard[][] = [];
  let cursor = 0;
  for (const columns of state.rowLayouts.length ? state.rowLayouts : [1, 1, 1]) {
    rows.push(state.displayCards.slice(cursor, cursor + columns));
    cursor += columns;
  }
  if (cursor < state.displayCards.length) {
    rows.push(state.displayCards.slice(cursor));
  }

  return (
    <div className="station-grid">
      {rows.map((row, rowIndex) => (
        <div className="station-row" data-columns={row.length || 1} key={rowIndex}>
          {row.map((card, index) => {
            const globalIndex = state.displayCards.indexOf(card);
            const active = !paused && state.playActiveCard && (state.activeCardIndex < 0 || state.activeCardIndex === globalIndex);
            const stationLabel = card.stationNumber?.trim() || String(globalIndex + 1);
            return (
              <div className={`station-card${active ? " is-active" : ""}`} key={`${card.id || card.actionId}-${rowIndex}-${index}`}>
                <VideoPreview src={card.mediaUrl || ""} label={stationLabel} active={!paused} />
                <span className="station-badge">{stationLabel}</span>
                {card.target ? <span className="station-target">{card.target}</span> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DotRow({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="dot-row">
      {Array.from({ length: total }, (_, index) => (
        <span className={index < completed ? "is-complete" : ""} key={index} />
      ))}
    </div>
  );
}

function PauseOverlay() {
  return <div className="pause-overlay">PAUSED</div>;
}

function HorizontalMainState({
  completedDots = 0,
  course,
  paused = false,
  primaryText,
  progress,
  remainingSeconds,
  secondaryText = "",
  totalDots = 0
}: {
  course: CourseRecord;
  progress: ReturnType<typeof buildHorizontalProgress>;
  primaryText: string;
  remainingSeconds: number;
  secondaryText?: string;
  completedDots?: number;
  totalDots?: number;
  paused?: boolean;
}) {
  const safePrimary = paused ? "PAUSED" : primaryText || "WAITING";
  return (
    <div className="horizontal-main-state">
      <div className="horizontal-main-row">
        <HorizontalRing primaryText={safePrimary} secondaryText={secondaryText} completedDots={completedDots} totalDots={totalDots} seconds={remainingSeconds} />
        <div className="horizontal-state-column">
          <div className="horizontal-state-title">
            {safePrimary.trim().toUpperCase() === "WORK" ? <span className="horizontal-work-icon" aria-hidden="true" /> : null}
            <strong>{safePrimary}</strong>
          </div>
          {secondaryText && totalDots <= 0 ? <span className="horizontal-state-secondary">{secondaryText}</span> : null}
          {totalDots > 0 ? <HorizontalDotRow completed={completedDots} total={totalDots} /> : null}
          <em>{course.name}</em>
        </div>
      </div>
      <HorizontalTimeline progress={progress} />
      <div className="horizontal-work-time">{formatClock(progress.formalElapsedSeconds)}/{formatClock(progress.formalTotalSeconds)}</div>
      {paused ? <PauseOverlay /> : null}
    </div>
  );
}

function HorizontalRing({
  completedDots,
  primaryText,
  secondaryText,
  seconds,
  totalDots
}: {
  seconds: number;
  primaryText: string;
  secondaryText: string;
  completedDots: number;
  totalDots: number;
}) {
  const ringKey = `${primaryText}|${secondaryText}|${completedDots}|${totalDots}`;
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const [ring, setRing] = useState({ key: ringKey, totalSeconds: Math.max(safeSeconds, 1) });

  useEffect(() => {
    setRing((current) => {
      if (current.key !== ringKey || safeSeconds > current.totalSeconds || current.totalSeconds <= 0) {
        return { key: ringKey, totalSeconds: Math.max(safeSeconds, 1) };
      }
      return current;
    });
  }, [ringKey, safeSeconds]);

  const progress = safeSeconds <= 0 ? 0 : Math.min(1, safeSeconds / Math.max(ring.totalSeconds, 1));
  return (
    <div className="horizontal-ring" aria-label="横屏倒计时">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="horizontal-ring-track" cx="50" cy="50" r="43" pathLength={1} />
        <circle className="horizontal-ring-value" cx="50" cy="50" r="43" pathLength={1} style={{ strokeDashoffset: 1 - progress }} />
      </svg>
      <strong>{safeSeconds}</strong>
    </div>
  );
}

function HorizontalDotRow({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="horizontal-dot-row">
      {Array.from({ length: total }, (_, index) => (
        <span className={index < completed ? "is-complete" : ""} key={index} />
      ))}
    </div>
  );
}

function HorizontalTimeline({ progress }: { progress: ReturnType<typeof buildHorizontalProgress> }) {
  if (!progress.workSegments.length || progress.workTotalSeconds <= 0) {
    return <div className="horizontal-timeline is-empty" />;
  }
  return (
    <div className="horizontal-timeline" aria-label="正式组 work timeline">
      {progress.workSegments.map((segment, index) => {
        const elapsedInSegment = Math.max(0, Math.min(progress.workElapsedSeconds - segment.workStartSeconds, segment.durationSeconds));
        const fillPercent = (elapsedInSegment / Math.max(segment.durationSeconds, 1)) * 100;
        return (
          <div className="horizontal-timeline-part" key={`${segment.workStartSeconds}-${index}`}>
            <div className="horizontal-timeline-segment" style={{ flexGrow: Math.max(segment.durationSeconds, 1) }}>
              <span style={{ width: `${fillPercent}%` }} />
            </div>
            {segment.markerAfter && index < progress.workSegments.length - 1 ? <span className="horizontal-water-marker" aria-hidden="true" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function CoursePlanSurface({ courseName, horizontal = false, plan }: { courseName: string; plan?: CoursePlan; horizontal?: boolean }) {
  const sections = (plan?.sections || []).filter((section) => section.title || section.items?.length);
  return (
    <div className={`course-plan${horizontal ? " is-horizontal" : ""}`}>
      <div className="course-plan-head">
        <span>COURSE PLAN</span>
        <h2>{courseName}</h2>
      </div>
      {sections.length ? (
        <div className="course-plan-sections">
          {sections.map((section, sectionIndex) => (
            <section key={section.id || sectionIndex}>
              <h3>{section.title || `Section ${sectionIndex + 1}`}</h3>
              <ul>
                {(section.items || []).map((item, itemIndex) => (
                  <li key={item.id || itemIndex}>{item.text}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="course-plan-empty">当前课程没有计划内容。</p>
      )}
    </div>
  );
}
