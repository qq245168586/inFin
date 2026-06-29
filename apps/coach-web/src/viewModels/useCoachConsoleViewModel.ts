import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import type { AuthSession } from "../models/common";
import type { CoachConsoleViewModelProps } from "../models/consoleVm";
import type { CoachSessionState, PlaybackSession } from "../models/playback";
import type { CoachPreviewItem, TvDailySchedule } from "../models/schedule";
import { useI18n } from "../providers/I18nProvider";
import {
  createPreviewSession,
  fetchCurrentPlayback,
  fetchDailyBundle,
  fetchVenueCoursePackages,
  mutatePlaybackSession,
  showCoursePlanOnTv,
  startScheduleSession,
  switchActiveCoursePackage,
  venueBody,
  venueQuery
} from "../services/consoleService";
import { buildFormalPreviews, createCommandId, getErrorMessage, isActiveSessionState, isAuthExpiredMessage } from "../utils/format";
import { COACH_COURSE_PACKAGE_CHANGED_EVENT } from "../utils/events";
import { activeSessionState, canReusePlaybackSessionForSchedule } from "../utils/playback";
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
  const { t } = useI18n();
  const weekDays = useMemo(() => getWeekDays(currentWeekSchedules), [currentWeekSchedules]);
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchDailyBundle>> | null>(null);
  const [sessionState, setSessionState] = useState<CoachSessionState>("IDLE");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedPlaybackSessionId, setSelectedPlaybackSessionId] = useState("");
  const [playbackSession, setPlaybackSession] = useState<PlaybackSession | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [coursePackages, setCoursePackages] = useState<Awaited<ReturnType<typeof fetchVenueCoursePackages>> | null>(null);
  const [activeCoursePackageId, setActiveCoursePackageId] = useState<number>(0);
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
  const isVenueBusy = isActiveSessionState(sessionState);

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
    } else {
      setServerClockBase(null);
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
        handleRequestError(error, t("同步课程 session 失败。"));
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

  async function requestStartFromSchedule(schedule: TvDailySchedule, body: Record<string, unknown>) {
    setPendingAction(String(body.commandId || schedule.id));
    onBusyTextChange(t("正在发送开始课程指令..."));
    try {
      const session = await startScheduleSession(authSession, schedule, body);
      if (session) {
        applyPlaybackSession(session);
      }
      return session;
    } catch (error) {
      handleRequestError(error, t("开始课程失败。"));
      return null;
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  const { handleRefreshTv, refreshBundle } = useConsoleRefreshActions({ authSession, handleRequestError, onBusyTextChange, onNotice, selectedDate, setBundle });

  async function loadCoursePackages(showError = false) {
    try {
      const payload = await fetchVenueCoursePackages(authSession);
      setCoursePackages(payload);
      setActiveCoursePackageId(Number(payload.activeCoursePackageId || payload.venue?.activeCoursePackageId || payload.packages?.[0]?.id || 0));
      return payload;
    } catch (error) {
      if (showError) {
        handleRequestError(error, t("加载课程包失败。"));
      } else if (isAuthExpiredMessage(getErrorMessage(error))) {
        onAuthExpired(getErrorMessage(error));
      }
      return null;
    }
  }

  async function changeActiveCoursePackage(coursePackageId: number) {
    if (!coursePackageId || coursePackageId === activeCoursePackageId) {
      return;
    }
    if (isVenueBusy) {
      onNotice(t("课程正在运行，结束后才能切换课程包。"), "error");
      return;
    }
    const commandId = createCommandId();
    setPendingAction(commandId);
    onBusyTextChange(t("正在切换场馆课程包..."));
    try {
      const payload = await switchActiveCoursePackage(authSession, coursePackageId, commandId);
      setCoursePackages(payload);
      setActiveCoursePackageId(Number(payload.activeCoursePackageId || coursePackageId));
      setSelectedScheduleId("");
      setPreviewIndex(0);
      applyPlaybackSession(null);
      setBundle(await fetchDailyBundle(selectedDate, authSession));
      onNotice(payload.warning || t("课程包已切换，TV 会重新同步课表资源。"), payload.warning ? "error" : undefined);
    } catch (error) {
      handleRequestError(error, t("切换课程包失败。"));
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

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
      nextSchedule ? t("正在终止当前课程并切换预览...") : t("正在终止课程..."),
      t("终止课程失败。")
    );
    if (!session) {
      return null;
    }
    applyPlaybackSession(null);
    setSelectedScheduleId("");
    setPreviewIndex(0);
    if (nextSchedule) {
      onNotice(t("当前课程已终止，正在切换到新的课程预览。"));
      await enterPreview(nextSchedule);
    } else {
      onNotice(t("课程已终止，TV 端已回到课表页。"));
    }
    return session;
  }

  async function enterPreview(schedule: TvDailySchedule): Promise<PlaybackSession | null> {
    const commandId = createCommandId();
    setPendingAction(commandId);
    onBusyTextChange(t("正在同步课程预览到 TV..."));
    try {
      const session = await createPreviewSession(authSession, schedule);
      if (session) {
        applyPlaybackSession(session);
      }
      setSelectedScheduleId(String(schedule.id));
      setPreviewIndex(0);
      onNotice(t("课程预览已同步到 TV。可以在课程卡片里开始课程。"));
      return session;
    } catch (error) {
      const requestError = error as Error & { status?: number };
      if (requestError.status === 409) {
        const current = playbackSession || (await fetchCurrentPlaybackSession(false));
        if (!window.confirm(t("当前已有未结束课程。切换预览会终止当前课程，是否继续？"))) {
          return null;
        }
        if (current?.id && !(await terminateCurrent(schedule))) {
          return null;
        }
        return enterPreview(schedule);
      }
      handleRequestError(error, t("同步课程预览失败。"));
      return null;
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  async function exitPreview(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    if (!playbackSession?.id || String(playbackSession.scheduleId) !== String(schedule.id) || sessionState !== "PREVIEW") {
      return null;
    }
    const session = await requestSession(
      `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/terminate`,
      venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, schedule, playbackSession),
      t("正在退出课程预览..."),
      t("退出预览失败。")
    );
    if (!session) {
      return null;
    }
    applyPlaybackSession(null);
    setSelectedScheduleId(String(schedule.id));
    setPreviewIndex(0);
    onNotice(t("已退出预览，TV 端已回到课表页。"));
    return session;
  }

  async function startCourse(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    if (playbackSession?.id && isActiveSessionState(sessionState) && String(playbackSession.scheduleId) !== String(schedule.id)) {
      if (!window.confirm(t("当前已有未结束课程。开始这节课会终止当前课程，是否继续？"))) {
        return;
      }
      if (!(await terminateCurrent())) {
        return;
      }
    }
    const startBody = venueBody(authSession, isSuperAdmin, { commandId: createCommandId(), startDelayMs: 5000 }, schedule, playbackSession);
    const shouldReusePlaybackSession = canReusePlaybackSessionForSchedule(playbackSession, sessionState, schedule.id);
    const nextSession = shouldReusePlaybackSession && playbackSession?.id
      ? await requestSession(
        `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/start`,
        startBody,
        t("正在发送开始课程指令..."),
        t("开始课程失败。")
      )
      : await requestStartFromSchedule(schedule, startBody);
    if (nextSession) {
      onNotice(t("课程开始指令已发送，TV 端会按服务端时间同步开始。"));
    }
  }

  async function pauseSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id || sessionState === "PAUSED") {
      return;
    }
    const session = await requestSession(`/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/pause`, venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, selectedSchedule, playbackSession), t("正在暂停课程..."), t("暂停课程失败。"));
    if (session) {
      onNotice(t("课程已暂停，TV 端会停在当前状态。"));
    }
  }

  async function resumeSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id) {
      return;
    }
    const session = await requestSession(`/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/resume`, venueBody(authSession, isSuperAdmin, { commandId: createCommandId() }, selectedSchedule, playbackSession), t("正在继续课程..."), t("继续课程失败。"));
    if (session) {
      onNotice(t("课程已继续。"));
    }
  }

  async function showSelectedCoursePlan(schedule: TvDailySchedule) {
    const commandId = createCommandId();
    setSelectedScheduleId(String(schedule.id));
    setPendingAction(commandId);
    onBusyTextChange(t("正在同步课程计划到 TV..."));
    try {
      await showCoursePlanOnTv(
        authSession,
        venueBody(
          authSession,
          isSuperAdmin,
          {
            commandId,
            scheduleId: String(schedule.id),
            courseId: schedule.courseId,
            courseName: schedule.courseName,
            playbackSessionId: playbackSession?.id || ""
          },
          schedule,
          playbackSession
        )
      );
      onNotice(t("课程计划已同步到 TV。"));
    } catch (error) {
      handleRequestError(error, t("同步课程计划失败。"));
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  function selectSchedule(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    setPreviewIndex(0);
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

  useEffect(() => {
    void loadCoursePackages(false);
  }, [authSession.access_token, authSession.token_type]);

  useEffect(() => {
    function handleCoursePackageChanged(event: Event) {
      const detail = (event as CustomEvent<{ activeCoursePackageId?: number }>).detail;
      const nextCoursePackageId = Number(detail?.activeCoursePackageId || 0);
      if (nextCoursePackageId) {
        setActiveCoursePackageId(nextCoursePackageId);
      }
      setSelectedScheduleId("");
      setPreviewIndex(0);
      applyPlaybackSession(null);
      void loadCoursePackages(false);
      fetchDailyBundle(selectedDate, authSession)
        .then(setBundle)
        .catch((error) => handleRequestError(error, t("刷新课程包课表失败。")));
    }

    window.addEventListener(COACH_COURSE_PACKAGE_CHANGED_EVENT, handleCoursePackageChanged);
    return () => window.removeEventListener(COACH_COURSE_PACKAGE_CHANGED_EVENT, handleCoursePackageChanged);
  }, [authSession.access_token, authSession.token_type, selectedDate]);

  return {
    activePreviewItem,
    activeCoursePackageId,
    changeActiveCoursePackage,
    coursePackages: coursePackages?.packages || [],
    displayElapsedMs,
    enterPreview,
    exitPreview,
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
    showSelectedCoursePlan,
    startCourse,
    terminateSelectedCourse: terminateCurrent,
    weekDays
  };
}
