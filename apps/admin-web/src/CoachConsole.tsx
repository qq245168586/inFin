import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

type NoticeTone = "success" | "error";
type CoachSessionState = "IDLE" | "PREVIEW" | "RUNNING" | "PAUSED";

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

function createPlaybackSessionId(schedule: TvDailySchedule): string {
  const base = `schedule-${schedule.id}-${Date.now()}`;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${base}-${crypto.randomUUID()}`;
  }
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
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
    throw new Error((payload as { message?: string } | null)?.message || `请求失败 (${response.status})`);
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

  async function enterPreview(schedule: TvDailySchedule) {
    const playbackSessionId = createPlaybackSessionId(schedule);
    const success = await publishControl(
      {
        type: "preview_course",
        source: "coach-web",
        scheduleId: String(schedule.id),
        courseId: schedule.courseId,
        scheduledStartAtMs: scheduleStartAtMs(schedule),
        playbackSessionId,
        bundleChecksum: String(schedule.contentChecksum || ""),
        requestedAt: Date.now()
      },
      "正在同步课程预览到 TV..."
    );

    if (!success) {
      return;
    }

    setSelectedScheduleId(String(schedule.id));
    setSelectedPlaybackSessionId(playbackSessionId);
    setSessionState("PREVIEW");
    setPreviewIndex(0);
    onNotice("课程预览已同步到 TV。再次点击同一节课程即可正式开始。");
  }

  async function startSelectedCourse() {
    if (!selectedSchedule) {
      return;
    }

    const playbackSessionId = selectedPlaybackSessionId || createPlaybackSessionId(selectedSchedule);
    const playbackStartAtMs = Date.now() + 2000;
    const success = await publishControl(
      {
        type: "start_course",
        source: "coach-web",
        scheduleId: String(selectedSchedule.id),
        courseId: selectedSchedule.courseId,
        scheduledStartAtMs: scheduleStartAtMs(selectedSchedule),
        playbackSessionId,
        bundleChecksum: String(selectedSchedule.contentChecksum || ""),
        playbackStartAtMs,
        requestedAt: Date.now()
      },
      "正在发送开始课程指令..."
    );

    if (!success) {
      return;
    }

    setSelectedPlaybackSessionId(playbackSessionId);
    setSessionState("RUNNING");
    onNotice("课程开始指令已发送，TV 端会按统一时间同步开始。");
  }

  async function pauseSelectedCourse() {
    if (!selectedSchedule) {
      return;
    }

    const success = await publishControl(
      {
        type: "pause_course",
        source: "coach-web",
        scheduleId: String(selectedSchedule.id),
        courseId: selectedSchedule.courseId,
        scheduledStartAtMs: scheduleStartAtMs(selectedSchedule),
        playbackSessionId: selectedPlaybackSessionId,
        pausedAtMs: Date.now(),
        requestedAt: Date.now()
      },
      "正在暂停课程..."
    );

    if (!success) {
      return;
    }

    setSessionState("PAUSED");
    onNotice("课程已暂停，TV 端会停在当前状态。");
  }

  async function resumeSelectedCourse() {
    if (!selectedSchedule) {
      return;
    }

    const success = await publishControl(
      {
        type: "resume_course",
        source: "coach-web",
        scheduleId: String(selectedSchedule.id),
        courseId: selectedSchedule.courseId,
        scheduledStartAtMs: scheduleStartAtMs(selectedSchedule),
        playbackSessionId: selectedPlaybackSessionId,
        resumedAtMs: Date.now(),
        requestedAt: Date.now()
      },
      "正在继续课程..."
    );

    if (!success) {
      return;
    }

    setSessionState("RUNNING");
    onNotice("课程已继续。");
  }

  async function terminateSelectedCourse(nextSchedule?: TvDailySchedule) {
    if (!selectedSchedule) {
      if (nextSchedule) {
        await enterPreview(nextSchedule);
      }
      return;
    }

    const success = await publishControl(
      {
        type: "terminate_course",
        source: "coach-web",
        scheduleId: String(selectedSchedule.id),
        courseId: selectedSchedule.courseId,
        scheduledStartAtMs: scheduleStartAtMs(selectedSchedule),
        playbackSessionId: selectedPlaybackSessionId,
        requestedAt: Date.now()
      },
      nextSchedule ? "正在终止当前课程并切换预览..." : "正在终止课程..."
    );

    if (!success) {
      return;
    }

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
    const isCurrent = String(schedule.id) === String(selectedScheduleId);

    if (!isCurrent && (sessionState === "RUNNING" || sessionState === "PAUSED")) {
      if (!window.confirm("切换到另一节课程会终止当前课程，是否继续？")) {
        return;
      }
      await terminateSelectedCourse(schedule);
      return;
    }

    if (isCurrent && sessionState === "PREVIEW") {
      await startSelectedCourse();
      return;
    }

    if (!isCurrent || sessionState === "IDLE") {
      await enterPreview(schedule);
    }
  }

  function handlePrimaryAction() {
    if (!selectedSchedule) {
      return;
    }

    if (sessionState === "PREVIEW") {
      void startSelectedCourse();
      return;
    }

    if (sessionState === "RUNNING") {
      void pauseSelectedCourse();
      return;
    }

    if (sessionState === "PAUSED") {
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

  function buildScheduleBadge(schedule: TvDailySchedule): { label: string; tone: string } {
    const isSelected = String(schedule.id) === String(selectedScheduleId);
    if (isSelected) {
      if (sessionState === "RUNNING") {
        return { label: "LIVE", tone: "live" };
      }
      if (sessionState === "PAUSED") {
        return { label: "PAUSED", tone: "paused" };
      }
      if (sessionState === "PREVIEW") {
        return { label: "PREVIEW", tone: "preview" };
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

              return (
                <button
                  key={schedule.id}
                  type="button"
                  className={`coach-schedule-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => void handleScheduleClick(schedule)}
                >
                  <div className="coach-schedule-logo">{buildCourseLogo(schedule.courseName)}</div>
                  <div className="coach-schedule-copy">
                    <strong>{schedule.courseName}</strong>
                    <span>{buildScheduleRange(schedule)}</span>
                  </div>
                  <span className={`coach-schedule-badge is-${badge.tone}`}>{badge.label}</span>
                </button>
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
              <span className={`coach-preview-state is-${sessionState.toLowerCase()}`}>
                {sessionState === "RUNNING"
                  ? "LIVE"
                  : sessionState === "PAUSED"
                    ? "PAUSED"
                    : sessionState === "PREVIEW"
                      ? "PREVIEW"
                      : "IDLE"}
              </span>
            </div>

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
                  左右滑动切换正式组动作。点一次课程进入 preview，再点开始正式上课。
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
                disabled={!selectedSchedule || sessionState === "IDLE"}
                onClick={handlePrimaryAction}
              >
                {sessionState === "RUNNING"
                  ? "暂停课程"
                  : sessionState === "PAUSED"
                    ? "继续课程"
                    : "开始课程"}
              </button>
              <button
                type="button"
                className={`ghost-button coach-terminate-button ${
                  sessionState === "PREVIEW" || sessionState === "RUNNING" || sessionState === "PAUSED"
                    ? "is-enabled"
                    : ""
                }`}
                disabled={
                  sessionState !== "PREVIEW" && sessionState !== "RUNNING" && sessionState !== "PAUSED"
                }
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
