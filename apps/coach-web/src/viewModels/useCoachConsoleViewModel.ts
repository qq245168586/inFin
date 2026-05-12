import { useMemo, useRef, useState, type TouchEvent } from "react";
import type { AuthSession } from "../models/common";
import type { CoachConsoleViewModelProps } from "../models/consoleVm";
import type { CoachSessionState, PlaybackSession } from "../models/playback";
import type { CoachPreviewItem, TvDailySchedule } from "../models/schedule";
import {
  createPreviewSession,
  fetchCurrentPlayback,
  fetchDailyBundle,
  mutatePlaybackSession,
  venueBody,
  venueQuery
} from "../services/consoleService";
import { buildFormalPreviews, createCommandId, getErrorMessage, isActiveSessionState, isAuthExpiredMessage } from "../utils/format";
import { activeSessionState } from "../utils/playback";
import { getWeekDays, scheduleStartAtMs, todayValue } from "../utils/time";
import { useCoachConsoleEffects } from "./useCoachConsoleEffects";
import { useConsoleRefreshActions } from "./useConsoleRefreshActions";

export function useCoachConsoleViewModel({
  authSession,
  currentWeekSchedules,
  onBusyTextChange,
  onNotice,
  onAuthExpired
}: CoachConsoleViewModelProps) {
  const weekDays = useMemo(() => getWeekDays(currentWeekSchedules), [currentWeekSchedules]);
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchDailyBundle>> | null>(null);
  const [sessionState, setSessionState] = useState<CoachSessionState>("IDLE");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedPlaybackSessionId, setSelectedPlaybackSessionId] = useState("");
  const [playbackSession, setPlaybackSession] = useState<PlaybackSession | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [serverClockBase, setServerClockBase] = useState<{ serverNowMs: number; localNowMs: number } | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const isSuperAdmin = String(authSession.role || "").toLowerCase() === "superadmin";
  const selectedSchedule = bundle?.schedules.find((item) => String(item.id) === String(selectedScheduleId)) || null;
  const previewItems = useMemo(() => buildFormalPreviews(selectedSchedule), [selectedSchedule]);
  const activePreviewItem = previewItems[previewIndex] || null;
  const displayServerNowMs = serverClockBase && typeof performance !== "undefined"
    ? serverClockBase.serverNowMs + Math.max(0, performance.now() - serverClockBase.localNowMs)
    : playbackSession?.serverNowMs || Date.now();
  const displayElapsedMs = playbackSession && playbackSession.serverStartAtMs > 0
    ? Math.max(0, (sessionState === "PAUSED" && playbackSession.pausedAtMs > 0 ? playbackSession.pausedAtMs : displayServerNowMs) - playbackSession.serverStartAtMs - Number(playbackSession.pausedAccumulatedMs || 0))
    : 0;
  const selectedScheduleSessionState = playbackSession && String(playbackSession.scheduleId) === String(selectedScheduleId) ? sessionState : "IDLE";

  function handleRequestError(error: unknown, fallbackMessage: string) {
    const message = getErrorMessage(error) || fallbackMessage;
    if (isAuthExpiredMessage(message)) {
      onAuthExpired(message);
      return;
    }
    onNotice(message, "error");
  }

  function findScheduleForSession(session: PlaybackSession | null): TvDailySchedule | null {
    return session?.scheduleId ? bundle?.schedules.find((item) => String(item.id) === String(session.scheduleId)) || null : null;
  }

  function applyPlaybackSession(session: PlaybackSession | null) {
    setPlaybackSession(session);
    setSelectedPlaybackSessionId(session?.id || "");
    setSessionState(session ? activeSessionState(session.state) : "IDLE");
    if (session?.scheduleId && (!selectedScheduleId || String(selectedScheduleId) === String(session.scheduleId))) {
      setSelectedScheduleId(String(session.scheduleId));
    }
    if (session?.serverNowMs) {
      setServerClockBase({ serverNowMs: session.serverNowMs, localNowMs: performance.now() });
    }
  }

  async function fetchCurrentPlaybackSession(showError = false): Promise<PlaybackSession | null> {
    try {
      const query = venueQuery(authSession, isSuperAdmin, selectedSchedule || findScheduleForSession(playbackSession), playbackSession);
      const session = await fetchCurrentPlayback(authSession, query);
      if (session) {
        applyPlaybackSession(session);
      } else if (isActiveSessionState(sessionState)) {
        applyPlaybackSession(null);
        setSelectedScheduleId("");
        setPreviewIndex(0);
      }
      return session;
    } catch (error) {
      if (showError) {
        handleRequestError(error, "同步课程 session 失败。");
      } else if (isAuthExpiredMessage(getErrorMessage(error))) {
        onAuthExpired(getErrorMessage(error));
      }
      return null;
    }
  }

  async function requestSession(path: string, body: Record<string, unknown>, busyText: string, fallback: string) {
    setPendingAction(String(body.commandId || path));
    onBusyTextChange(busyText);
    try {
      const session = await mutatePlaybackSession(authSession, path, body);
      if (session) {
        applyPlaybackSession(session);
      }
      return session;
    } catch (error) {
      handleRequestError(error, fallback);
      return null;
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  const { handleRefreshTv, refreshBundle } = useConsoleRefreshActions({ authSession, handleRequestError, onBusyTextChange, onNotice, selectedDate, setBundle });

  async function terminateCurrent(nextSchedule?: TvDailySchedule) {
    if (!selectedSchedule || !playbackSession?.id) {
      if (nextSchedule) {
        await enterPreview(nextSchedule);
      }
      return null;
    }
    const session = await requestSession(
      `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/terminate`,
      venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, selectedSchedule, playbackSession),
      nextSchedule ? "正在终止当前课程并切换预览..." : "正在终止课程...",
      "终止课程失败。"
    );
    if (!session) {
      return null;
    }
    applyPlaybackSession(null);
    setSelectedScheduleId("");
    setPreviewIndex(0);
    if (nextSchedule) {
      onNotice("当前课程已终止，正在切换到新的课程预览。");
      await enterPreview(nextSchedule);
    } else {
      onNotice("课程已终止，TV 端已回到课表页。");
    }
    return session;
  }

  async function enterPreview(schedule: TvDailySchedule): Promise<PlaybackSession | null> {
    const commandId = createCommandId();
    setPendingAction(commandId);
    onBusyTextChange("正在同步课程预览到 TV...");
    try {
      const session = await createPreviewSession(authSession, schedule);
      if (session) {
        applyPlaybackSession(session);
      }
      setSelectedScheduleId(String(schedule.id));
      setPreviewIndex(0);
      onNotice("课程预览已同步到 TV。再次点击同一节课程即可正式开始。");
      return session;
    } catch (error) {
      const requestError = error as Error & { status?: number };
      if (requestError.status === 409) {
        const current = playbackSession || (await fetchCurrentPlaybackSession(false));
        if (!window.confirm("当前已有未结束课程。切换预览会终止当前课程，是否继续？")) {
          return null;
        }
        if (current?.id && !(await terminateCurrent(schedule))) {
          return null;
        }
        return enterPreview(schedule);
      }
      handleRequestError(error, "同步课程预览失败。");
      return null;
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  async function startCourse(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    if (playbackSession?.id && isActiveSessionState(sessionState) && String(playbackSession.scheduleId) !== String(schedule.id)) {
      if (!window.confirm("当前已有未结束课程。开始这节课会终止当前课程，是否继续？")) {
        return;
      }
      if (!(await terminateCurrent())) {
        return;
      }
    }
    const session = playbackSession?.id && String(playbackSession.scheduleId) === String(schedule.id) ? playbackSession : await enterPreview(schedule);
    const sessionId = session?.id || selectedPlaybackSessionId;
    if (!sessionId) {
      onNotice("还没有可开始的课程 session，请先进入 preview。", "error");
      return;
    }
    const nextSession = await requestSession(
      `/api/tv/playback-sessions/${encodeURIComponent(sessionId)}/start`,
      venueBody(authSession, isSuperAdmin, { commandId: createCommandId(), startDelayMs: 5000 }, schedule, session),
      "正在发送开始课程指令...",
      "开始课程失败。"
    );
    if (nextSession) {
      onNotice("课程开始指令已发送，TV 端会按服务端时间同步开始。");
    }
  }

  async function pauseSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id || sessionState === "PAUSED") {
      return;
    }
    const session = await requestSession(`/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/pause`, venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, selectedSchedule, playbackSession), "正在暂停课程...", "暂停课程失败。");
    if (session) {
      onNotice("课程已暂停，TV 端会停在当前状态。");
    }
  }

  async function resumeSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id) {
      return;
    }
    const session = await requestSession(`/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/resume`, venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, selectedSchedule, playbackSession), "正在继续课程...", "继续课程失败。");
    if (session) {
      onNotice("课程已继续。");
    }
  }

  function selectSchedule(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    setPreviewIndex(0);
  }

  function primaryAction() {
    if (!selectedSchedule) return;
    if (selectedScheduleSessionState === "PREVIEW" || selectedScheduleSessionState === "IDLE") void startCourse(selectedSchedule);
    if (selectedScheduleSessionState === "SCHEDULED" || selectedScheduleSessionState === "RUNNING") void pauseSelectedCourse();
    if (selectedScheduleSessionState === "PAUSED") void resumeSelectedCourse();
  }

  function sessionStateForSchedule(schedule: TvDailySchedule): CoachSessionState {
    return playbackSession && String(playbackSession.scheduleId) === String(schedule.id) ? sessionState : "IDLE";
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null || Math.abs(endX - startX) < 28) return;
    setPreviewIndex((current) => Math.min(Math.max(current + (endX < startX ? 1 : -1), 0), previewItems.length - 1));
  }

  useCoachConsoleEffects({
    activePreviewId: activePreviewItem?.id,
    activePreviewMediaUrl: activePreviewItem?.mediaUrl,
    authSession,
    fetchCurrentPlaybackSession,
    handleRequestError,
    onBusyTextChange,
    previewIndex,
    previewItemsLength: previewItems.length,
    previewVideoRef,
    selectedDate,
    setBundle,
    setPreviewIndex,
    setSelectedDate,
    weekDays
  });

  return {
    activePreviewItem,
    displayElapsedMs,
    enterPreview,
    filteredSchedules: bundle?.schedules || [],
    handleRefreshTv,
    handleTouchEnd,
    handleTouchStart,
    pauseSelectedCourse,
    playbackSession,
    pendingAction,
    previewIndex,
    previewItems,
    previewVideoRef,
    primaryAction,
    refreshBundle,
    resumeSelectedCourse,
    selectSchedule,
    selectedDate,
    selectedSchedule,
    selectedScheduleId,
    selectedScheduleSessionState,
    sessionStateForSchedule,
    setPreviewIndex,
    setSelectedDate,
    startCourse,
    terminateSelectedCourse: terminateCurrent,
    weekDays
  };
}
