import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

type NoticeTone = "success" | "error";
type CoachSessionState = "IDLE" | "PREVIEW" | "SCHEDULED" | "RUNNING" | "PAUSED" | "ENDED" | "TERMINATED";
type ActiveCoachSessionState = Exclude<CoachSessionState, "IDLE">;

interface WeekScheduleRecord {
  id: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

interface CoachConsoleProps {
  authSession: {
    access_token: string;
    token_type: string;
  };
  currentWeekSchedules: WeekScheduleRecord[];
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

interface CoachWeekDay {
  key: string;
  label: string;
  dayNumber: string;
  scheduleCount: number;
}

interface TvDailyBundle {
  date: string;
  timeZone: string;
  checksum: string;
  generatedAt: string;
  scheduleCount: number;
  schedules: TvDailySchedule[];
}

interface TvDailySchedule {
  id: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
  contentChecksum?: string;
  course?: {
    script?: CoachCourseScript;
  };
}

interface CoachCourseScript {
  training?: {
    videoGroups?: CoachVideoGroup[];
    pods?: CoachPod[];
  };
}

interface CoachVideoGroup {
  id: string;
  name: string;
  screenCount: number;
  screens: CoachVideoGroupScreen[];
}

interface CoachVideoGroupScreen {
  id: string;
  screenIndex: number;
  videoCards: CoachVideoCard[];
}

interface CoachVideoCard {
  id: string;
  actionId: string;
  actionName: string;
  stationNumber: string;
  mediaUrl?: string;
}

interface CoachPod {
  id: string;
  name: string;
  videoGroupId: string;
}

interface CoachPreviewItem {
  id: string;
  mediaUrl: string;
  actionName: string;
}

interface PlaybackSession {
  id: string;
  state: ActiveCoachSessionState;
  version: number;
  scheduleId: string;
  courseId: number;
  courseName?: string;
  bundleChecksum: string;
  scheduledStartAtMs: number;
  serverStartAtMs: number;
  pausedAccumulatedMs: number;
  pausedAtMs: number;
  endedAtMs?: number;
  terminatedAtMs?: number;
  elapsedMs?: number;
  serverNowMs: number;
  updatedAtMs?: number;
  startDelayMs?: number;
  lastCommandId?: string;
  lastCommand?: {
    commandId?: string;
    action?: string;
    state?: string;
    resultVersion?: number;
  } | null;
}

interface PlaybackSessionEnvelope {
  ok?: boolean;
  serverNowMs?: number;
  session?: PlaybackSession | null;
  data?: PlaybackSession | null;
  mqtt?: {
    errors?: string[];
  };
}

const COURSE_TIME_ZONE = "Asia/Shanghai";

function todayValue(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COURSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatTime(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDateLabel(value?: string | Date | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "long"
  }).format(new Date(value));
}

function startOfWeek(date = new Date()): Date {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta);
  return base;
}

function getWeekDays(schedules: WeekScheduleRecord[]): CoachWeekDay[] {
  const monday = startOfWeek(new Date());
  const countMap = schedules.reduce<Record<string, number>>((result, item) => {
    const key = item.beginTime.slice(0, 10);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: COURSE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(current);

    return {
      key,
      label: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
      dayNumber: String(current.getDate()).padStart(2, "0"),
      scheduleCount: countMap[key] || 0
    };
  });
}

function buildCourseLogo(courseName: string): string {
  const parts = String(courseName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts.map((item) => item[0]?.toUpperCase() || "").join("");
  return (letters || "IN").slice(0, 2);
}

function buildFormalPreviews(schedule: TvDailySchedule | null): CoachPreviewItem[] {
  const previews: CoachPreviewItem[] = [];
  const script = schedule?.course?.script;
  const training = script?.training;
  if (!training) {
    return previews;
  }
  let index = 0;

  for (const group of training.videoGroups || []) {
    const orderedScreens = [...(group.screens || [])].sort((left, right) => left.screenIndex - right.screenIndex);
    for (const screen of orderedScreens) {
      for (const card of screen.videoCards || []) {
        previews.push({
          id: `preview-${group.id}-${screen.id}-${card.id}-${index++}`,
          mediaUrl: String(card.mediaUrl || ""),
          actionName: String(card.actionName || "")
        });
      }
    }
  }

  return previews;
}

function scheduleStartAtMs(schedule: TvDailySchedule): number {
  return new Date(schedule.beginTime).getTime();
}

function buildScheduleRange(schedule: TvDailySchedule): string {
  const start = new Date(schedule.beginTime);
  const end = new Date(start.getTime() + Number(schedule.duration || 0) * 60000);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function createCommandId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function activeSessionState(value: unknown): CoachSessionState {
  const state = String(value || "").toUpperCase();
  if (["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(state)) {
    return state as CoachSessionState;
  }
  return "IDLE";
}

function isActiveSessionState(value: CoachSessionState): boolean {
  return value === "PREVIEW" || value === "SCHEDULED" || value === "RUNNING" || value === "PAUSED";
}

function normalizePlaybackSession(payload: PlaybackSessionEnvelope | null): PlaybackSession | null {
  const session = payload?.session || payload?.data || null;
  if (!session?.id) {
    return null;
  }
  return {
    ...session,
    state: activeSessionState(session.state) === "IDLE" ? "PREVIEW" : (activeSessionState(session.state) as ActiveCoachSessionState),
    scheduleId: String(session.scheduleId || ""),
    courseId: Number(session.courseId || 0),
    version: Math.max(1, Number(session.version || 1)),
    serverNowMs: Number(payload?.serverNowMs || session.serverNowMs || Date.now())
  };
}

function shortSessionId(value?: string): string {
  const text = String(value || "");
  if (!text) {
    return "--";
  }
  return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const error = new Error((payload as { message?: string } | null)?.message || `请求失败 (${response.status})`) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

function isAuthExpiredMessage(message: string): boolean {
  return /登录已失效|重新登录|refresh token 已失效|客户端凭证无效|请求失败 \(401\)|请求失败 \(403\)/i.test(
    String(message || "")
  );
}

export default function CoachConsole({
  authSession,
  currentWeekSchedules,
  onBusyTextChange,
  onNotice,
  onAuthExpired
}: CoachConsoleProps) {
  const weekDays = useMemo(() => getWeekDays(currentWeekSchedules), [currentWeekSchedules]);
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [bundle, setBundle] = useState<TvDailyBundle | null>(null);
  const [sessionState, setSessionState] = useState<CoachSessionState>("IDLE");
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [selectedPlaybackSessionId, setSelectedPlaybackSessionId] = useState<string>("");
  const [playbackSession, setPlaybackSession] = useState<PlaybackSession | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [serverClockBase, setServerClockBase] = useState<{ serverNowMs: number; localNowMs: number } | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedSchedule =
    bundle?.schedules.find((item) => String(item.id) === String(selectedScheduleId)) || null;
  const previewItems = useMemo(() => buildFormalPreviews(selectedSchedule), [selectedSchedule]);
  const activePreviewItem = previewItems[previewIndex] || null;
  const authHeaders = {
    Authorization: `${authSession.token_type} ${authSession.access_token}`
  };
  const displayServerNowMs =
    serverClockBase && typeof performance !== "undefined"
      ? serverClockBase.serverNowMs + Math.max(0, performance.now() - serverClockBase.localNowMs)
      : playbackSession?.serverNowMs || Date.now();
  const displayElapsedMs =
    playbackSession && playbackSession.serverStartAtMs > 0
      ? Math.max(
          0,
          (sessionState === "PAUSED" && playbackSession.pausedAtMs > 0
            ? playbackSession.pausedAtMs
            : displayServerNowMs) -
            playbackSession.serverStartAtMs -
            Number(playbackSession.pausedAccumulatedMs || 0)
        )
      : 0;
  const selectedScheduleSessionState =
    playbackSession && String(playbackSession.scheduleId) === String(selectedScheduleId)
      ? sessionState
      : "IDLE";

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

  function handleRequestError(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    if (isAuthExpiredMessage(message)) {
      onAuthExpired(message);
      return;
    }
    onNotice(message, "error");
  }

  useEffect(() => {
    if (!weekDays.some((day) => day.key === selectedDate)) {
      setSelectedDate(todayValue());
    }
  }, [selectedDate, weekDays]);

  useEffect(() => {
    let cancelled = false;

    async function loadBundle() {
      onBusyTextChange("正在加载教练端课表...");

      try {
        const payload = await requestJson<TvDailyBundle>(
          `/api/tv/daily-bundle?date=${encodeURIComponent(selectedDate)}&timeZone=${encodeURIComponent(COURSE_TIME_ZONE)}`
        );
        if (cancelled) {
          return;
        }

        setBundle(payload);
        if (!payload.schedules.some((item) => String(item.id) === String(selectedScheduleId))) {
          setSelectedScheduleId("");
          setSelectedPlaybackSessionId("");
          setPlaybackSession(null);
          setServerClockBase(null);
          setSessionState("IDLE");
          setPreviewIndex(0);
        }
      } catch (error) {
        if (!cancelled) {
          handleRequestError(error, "加载教练端课表失败。");
        }
      } finally {
        if (!cancelled) {
          onBusyTextChange("");
        }
      }
    }

    void loadBundle();
    return () => {
      cancelled = true;
    };
  }, [onBusyTextChange, onNotice, selectedDate]);

  useEffect(() => {
    if (!previewItems.length) {
      setPreviewIndex(0);
      return;
    }

    if (previewIndex > previewItems.length - 1) {
      setPreviewIndex(0);
    }
  }, [previewIndex, previewItems.length]);

  useEffect(() => {
    if (!activePreviewItem?.mediaUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      const video = previewVideoRef.current;
      if (!video) {
        return;
      }

      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      void video.play().catch(() => {});
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activePreviewItem?.id, activePreviewItem?.mediaUrl]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const scheduleNextPoll = () => {
      const delay = document.visibilityState === "visible" ? 2000 : 15000;
      timer = window.setTimeout(async () => {
        if (!cancelled) {
          await fetchCurrentPlaybackSession(false);
          scheduleNextPoll();
        }
      }, delay);
    };

    void fetchCurrentPlaybackSession(false).finally(() => {
      if (!cancelled) {
        scheduleNextPoll();
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authSession.access_token, authSession.token_type]);

  async function publishControl(payload: Record<string, unknown>, busyText: string) {
    onBusyTextChange(busyText);

    try {
      await requestJson<{ ok: boolean }>("/api/tv/control", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      return true;
    } catch (error) {
      handleRequestError(error, "TV 控制指令发送失败。");
      return false;
    } finally {
      onBusyTextChange("");
    }
  }

  async function fetchCurrentPlaybackSession(showError = false): Promise<PlaybackSession | null> {
    try {
      const payload = await requestJson<PlaybackSessionEnvelope>("/api/tv/playback-sessions/current", {
        headers: authHeaders
      });
      const session = normalizePlaybackSession(payload);
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
      } else {
        const message = error instanceof Error ? error.message : "";
        if (isAuthExpiredMessage(message)) {
          onAuthExpired(message);
        }
      }
      return null;
    }
  }

  async function requestPlaybackSession(
    path: string,
    body: Record<string, unknown>,
    busyText: string,
    fallbackMessage: string
  ): Promise<PlaybackSession | null> {
    setPendingAction(String(body.commandId || path));
    onBusyTextChange(busyText);
    try {
      const payload = await requestJson<PlaybackSessionEnvelope>(path, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body)
      });
      const session = normalizePlaybackSession(payload);
      if (session) {
        applyPlaybackSession(session);
      }
      return session;
    } catch (error) {
      handleRequestError(error, fallbackMessage);
      return null;
    } finally {
      setPendingAction("");
      onBusyTextChange("");
    }
  }

  async function refreshBundle(manualNotice = true) {
    onBusyTextChange("正在刷新教练端课表...");
    try {
      const payload = await requestJson<TvDailyBundle>(
        `/api/tv/daily-bundle?date=${encodeURIComponent(selectedDate)}&timeZone=${encodeURIComponent(COURSE_TIME_ZONE)}`
      );
      setBundle(payload);
      if (manualNotice) {
        onNotice("教练端课表已刷新。");
      }
    } catch (error) {
      handleRequestError(error, "刷新课表失败。");
    } finally {
      onBusyTextChange("");
    }
  }

  async function handleRefreshTv() {
    const success = await publishControl(
      {
        type: "refresh_checksum",
        source: "coach-web",
        requestedAt: Date.now()
      },
      "正在通知 TV 端刷新课程校验..."
    );

    if (success) {
      onNotice("已通知 TV 端刷新课程校验。");
    }
  }

  async function enterPreview(schedule: TvDailySchedule): Promise<PlaybackSession | null> {
    const commandId = createCommandId();
    setPendingAction(commandId);
    onBusyTextChange("正在同步课程预览到 TV...");
    try {
      const payload = await requestJson<PlaybackSessionEnvelope>("/api/tv/playback-sessions/preview", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          commandId,
          scheduleId: String(schedule.id),
          courseId: schedule.courseId,
          scheduledStartAtMs: scheduleStartAtMs(schedule),
          bundleChecksum: String(schedule.contentChecksum || "")
        })
      });
      const session = normalizePlaybackSession(payload);
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
        if (current?.id) {
          const terminated = await requestPlaybackSession(
            `/api/tv/playback-sessions/${encodeURIComponent(current.id)}/terminate`,
            { commandId: createCommandId() },
            "正在终止当前课程...",
            "终止当前课程失败。"
          );
          if (!terminated) {
            return null;
          }
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

    if (
      playbackSession?.id &&
      isActiveSessionState(sessionState) &&
      String(playbackSession.scheduleId) !== String(schedule.id)
    ) {
      if (!window.confirm("当前已有未结束课程。开始这节课会终止当前课程，是否继续？")) {
        return;
      }
      const terminated = await requestPlaybackSession(
        `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/terminate`,
        { commandId: createCommandId() },
        "正在终止当前课程...",
        "终止当前课程失败。"
      );
      if (!terminated) {
        return;
      }
      applyPlaybackSession(null);
    }

    const session =
      playbackSession?.id && String(playbackSession.scheduleId) === String(schedule.id)
        ? playbackSession
        : await enterPreview(schedule);
    const sessionId = session?.id || selectedPlaybackSessionId;
    if (!sessionId) {
      onNotice("还没有可开始的课程 session，请先进入 preview。", "error");
      return;
    }

    const nextSession = await requestPlaybackSession(
      `/api/tv/playback-sessions/${encodeURIComponent(sessionId)}/start`,
      {
        commandId: createCommandId(),
        startDelayMs: 5000
      },
      "正在发送开始课程指令...",
      "开始课程失败。"
    );

    if (!nextSession) {
      return;
    }

    onNotice("课程开始指令已发送，TV 端会按服务端时间同步开始。");
  }

  async function startSelectedCourse() {
    if (!selectedSchedule) {
      return;
    }
    await startCourse(selectedSchedule);
  }

  async function pauseSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id) {
      return;
    }
    if (sessionState === "PAUSED") {
      return;
    }

    const session = await requestPlaybackSession(
      `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/pause`,
      {
        commandId: createCommandId()
      },
      "正在暂停课程...",
      "暂停课程失败。"
    );

    if (!session) {
      return;
    }

    onNotice("课程已暂停，TV 端会停在当前状态。");
  }

  async function resumeSelectedCourse() {
    if (!selectedSchedule || !playbackSession?.id) {
      return;
    }

    const session = await requestPlaybackSession(
      `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/resume`,
      {
        commandId: createCommandId()
      },
      "正在继续课程...",
      "继续课程失败。"
    );

    if (!session) {
      return;
    }

    onNotice("课程已继续。");
  }

  async function terminateSelectedCourse(nextSchedule?: TvDailySchedule) {
    if (!selectedSchedule || !playbackSession?.id) {
      if (nextSchedule) {
        await enterPreview(nextSchedule);
      }
      return;
    }

    const session = await requestPlaybackSession(
      `/api/tv/playback-sessions/${encodeURIComponent(playbackSession.id)}/terminate`,
      {
        commandId: createCommandId()
      },
      nextSchedule ? "正在终止当前课程并切换预览..." : "正在终止课程...",
      "终止课程失败。"
    );

    if (!session) {
      return;
    }

    setPlaybackSession(null);
    setServerClockBase(null);
    setSessionState("IDLE");
    setSelectedScheduleId("");
    setSelectedPlaybackSessionId("");
    setPreviewIndex(0);

    if (nextSchedule) {
      onNotice("当前课程已终止，正在切换到新的课程预览。");
      await enterPreview(nextSchedule);
      return;
    }

    onNotice("课程已终止，TV 端已回到课表页。");
  }

  async function handleScheduleClick(schedule: TvDailySchedule) {
    setSelectedScheduleId(String(schedule.id));
    setPreviewIndex(0);
  }

  function handlePrimaryAction() {
    if (!selectedSchedule) {
      return;
    }

    if (selectedScheduleSessionState === "PREVIEW" || selectedScheduleSessionState === "IDLE") {
      void startSelectedCourse();
      return;
    }

    if (selectedScheduleSessionState === "SCHEDULED" || selectedScheduleSessionState === "RUNNING") {
      void pauseSelectedCourse();
      return;
    }

    if (selectedScheduleSessionState === "PAUSED") {
      void resumeSelectedCourse();
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;

    if (startX == null || endX == null) {
      return;
    }

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 28) {
      return;
    }

    if (deltaX < 0 && previewIndex < previewItems.length - 1) {
      setPreviewIndex((current) => current + 1);
    } else if (deltaX > 0 && previewIndex > 0) {
      setPreviewIndex((current) => current - 1);
    }
  }

  function sessionStateForSchedule(schedule: TvDailySchedule): CoachSessionState {
    if (playbackSession && String(playbackSession.scheduleId) === String(schedule.id)) {
      return sessionState;
    }
    return "IDLE";
  }

  function buildScheduleBadge(schedule: TvDailySchedule): { label: string; tone: string } {
    const scheduleSessionState = sessionStateForSchedule(schedule);
    if (scheduleSessionState !== "IDLE") {
      if (scheduleSessionState === "SCHEDULED") {
        return { label: "SYNCING", tone: "scheduled" };
      }
      if (scheduleSessionState === "RUNNING") {
        return { label: "LIVE", tone: "live" };
      }
      if (scheduleSessionState === "PAUSED") {
        return { label: "PAUSED", tone: "paused" };
      }
      if (scheduleSessionState === "PREVIEW") {
        return { label: "PREVIEW", tone: "preview" };
      }
      if (scheduleSessionState === "ENDED" || scheduleSessionState === "TERMINATED") {
        return { label: "已结束", tone: "ended" };
      }
    }

    const now = Date.now();
    const startAt = scheduleStartAtMs(schedule);
    const endAt = startAt + Number(schedule.duration || 0) * 60000;
    if (now >= endAt) {
      return { label: "已结束", tone: "ended" };
    }
    if (now >= startAt) {
      return { label: "进行中", tone: "live" };
    }
    return { label: "待开始", tone: "idle" };
  }

  const filteredSchedules = bundle?.schedules || [];

  return (
    <section className="coach-console-page">
      <div className="coach-console-toolbar">
        <div className="coach-toolbar-copy">
          <p>Coach Console</p>
          <strong>{formatDateLabel(selectedDate)}</strong>
        </div>
        <div className="coach-toolbar-actions">
          <button type="button" className="ghost-button" onClick={() => void refreshBundle()}>
            刷新课表
          </button>
          <button type="button" className="primary-button" onClick={() => void handleRefreshTv()}>
            刷新 TV
          </button>
        </div>
      </div>

      <div className="coach-week-strip">
        {weekDays.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`coach-day-pill ${selectedDate === day.key ? "is-active" : ""}`}
            onClick={() => setSelectedDate(day.key)}
          >
            <span>{day.label}</span>
            <strong>{day.dayNumber}</strong>
          </button>
        ))}
      </div>

      <div className="coach-schedule-panel">
        <div className="coach-panel-head">
          <h2>今日课程表</h2>
          <span>{filteredSchedules.length} 节课程</span>
        </div>

        <div className="coach-schedule-list">
          {filteredSchedules.length ? (
            filteredSchedules.map((schedule) => {
              const badge = buildScheduleBadge(schedule);
              const isSelected = String(schedule.id) === String(selectedScheduleId);
              const scheduleSessionState = sessionStateForSchedule(schedule);
              const showRunningActions =
                scheduleSessionState === "SCHEDULED" ||
                scheduleSessionState === "RUNNING" ||
                scheduleSessionState === "PAUSED";

              return (
                <article
                  key={schedule.id}
                  className={`coach-schedule-card ${isSelected ? "is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="coach-schedule-main"
                    disabled={Boolean(pendingAction)}
                    onClick={() => void handleScheduleClick(schedule)}
                  >
                    <div className="coach-schedule-logo">{buildCourseLogo(schedule.courseName)}</div>
                    <div className="coach-schedule-copy">
                      <strong>{schedule.courseName}</strong>
                      <span>{buildScheduleRange(schedule)}</span>
                    </div>
                    <span className={`coach-schedule-badge is-${badge.tone}`}>{badge.label}</span>
                  </button>

                  {isSelected ? (
                    <div className="coach-schedule-actions">
                      {showRunningActions ? (
                        <>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={Boolean(pendingAction)}
                            onClick={() => {
                              if (scheduleSessionState === "PAUSED") {
                                void resumeSelectedCourse();
                                return;
                              }
                              void pauseSelectedCourse();
                            }}
                          >
                            {pendingAction ? "处理中..." : scheduleSessionState === "PAUSED" ? "继续" : "暂停"}
                          </button>
                          <button
                            type="button"
                            className="ghost-button danger"
                            disabled={Boolean(pendingAction)}
                            onClick={() => {
                              if (!window.confirm("是否结束当前课程？")) {
                                return;
                              }
                              void terminateSelectedCourse();
                            }}
                          >
                            结束
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={Boolean(pendingAction)}
                            onClick={() => void enterPreview(schedule)}
                          >
                            预览
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={Boolean(pendingAction)}
                            onClick={() => void startCourse(schedule)}
                          >
                            {pendingAction ? "处理中..." : "开始"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="coach-empty-block">这一天还没有排课。</div>
          )}
        </div>
      </div>

      <div className="coach-preview-panel">
        {selectedSchedule ? (
          <>
            <div className="coach-preview-head">
              <div>
                <h2>{selectedSchedule.courseName}</h2>
                <p>
                  {formatDateLabel(selectedSchedule.beginTime)} · {buildScheduleRange(selectedSchedule)}
                </p>
              </div>
              <span className={`coach-preview-state is-${selectedScheduleSessionState.toLowerCase()}`}>
                {selectedScheduleSessionState === "SCHEDULED"
                  ? "SYNCING"
                  : selectedScheduleSessionState === "RUNNING"
                  ? "LIVE"
                  : selectedScheduleSessionState === "PAUSED"
                    ? "PAUSED"
                    : selectedScheduleSessionState === "PREVIEW"
                      ? "PREVIEW"
                      : selectedScheduleSessionState === "ENDED" || selectedScheduleSessionState === "TERMINATED"
                        ? "ENDED"
                        : "IDLE"}
              </span>
            </div>
            {playbackSession && String(playbackSession.scheduleId) === String(selectedScheduleId) ? (
              <div className="coach-session-meta">
                <span>Session {shortSessionId(playbackSession.id)}</span>
                <span>v{playbackSession.version}</span>
                <span>{playbackSession.lastCommandId ? `cmd ${shortSessionId(playbackSession.lastCommandId)}` : "cmd --"}</span>
                {playbackSession.serverStartAtMs > 0 ? (
                  <span>elapsed {Math.floor(displayElapsedMs / 1000)}s</span>
                ) : null}
              </div>
            ) : null}

            <div className="coach-preview-stage">
              <div
                className="coach-preview-frame"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {activePreviewItem?.mediaUrl ? (
                  <video
                    key={activePreviewItem.id}
                    ref={previewVideoRef}
                    className="coach-preview-video"
                    src={activePreviewItem.mediaUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      video.currentTime = 0;
                      void video.play().catch(() => {});
                    }}
                    onCanPlay={(event) => {
                      void event.currentTarget.play().catch(() => {});
                    }}
                  />
                ) : (
                  <div className="coach-preview-empty">正式组还没有可预览的视频。</div>
                )}
                {previewItems.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="coach-preview-nav is-prev"
                      onClick={() => setPreviewIndex((current) => Math.max(current - 1, 0))}
                      disabled={previewIndex === 0}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="coach-preview-nav is-next"
                      onClick={() => setPreviewIndex((current) => Math.min(current + 1, previewItems.length - 1))}
                      disabled={previewIndex >= previewItems.length - 1}
                    >
                      ›
                    </button>
                  </>
                ) : null}
              </div>

              <div className="coach-preview-caption">
                <strong>{activePreviewItem?.actionName || "预览视频"}</strong>
                {previewItems.length ? (
                  <span className="coach-preview-index">
                    {previewIndex + 1} / {previewItems.length}
                  </span>
                ) : null}
                <span>
                  左右滑动切换正式组动作。课程卡片里的按钮负责预览、开始和课堂控制。
                </span>
              </div>
            </div>

            {previewItems.length > 1 ? (
              <div className="coach-preview-dots">
                {previewItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`coach-preview-dot ${previewIndex === index ? "is-active" : ""}`}
                    onClick={() => setPreviewIndex(index)}
                    aria-label={`查看第 ${index + 1} 个动作`}
                  />
                ))}
              </div>
            ) : null}

            <div className="coach-preview-actions">
              <button
                type="button"
                className="primary-button coach-primary-button"
                disabled={!selectedSchedule || Boolean(pendingAction)}
                onClick={handlePrimaryAction}
              >
                {pendingAction
                  ? "处理中..."
                  : selectedScheduleSessionState === "SCHEDULED" || selectedScheduleSessionState === "RUNNING"
                  ? "暂停课程"
                  : selectedScheduleSessionState === "PAUSED"
                    ? "继续课程"
                    : "开始课程"}
              </button>
              <button
                type="button"
                className={`ghost-button coach-terminate-button ${
                  isActiveSessionState(selectedScheduleSessionState)
                    ? "is-enabled"
                    : ""
                }`}
                disabled={!isActiveSessionState(selectedScheduleSessionState) || Boolean(pendingAction)}
                onClick={() => {
                  if (!window.confirm("是否终止当前课程？")) {
                    return;
                  }
                  void terminateSelectedCourse();
                }}
              >
                终止课程
              </button>
            </div>
          </>
        ) : (
          <div className="coach-empty-block is-large">点选上方课程，先进入 preview，再开始课程。</div>
        )}
      </div>
    </section>
  );
}
