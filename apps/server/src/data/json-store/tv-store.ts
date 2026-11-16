// @ts-nocheck
import { authenticateDiagnosticDevice } from "../../services/tv-diagnostic-schema.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CONSOLE_ACCOUNT_PRESETS,
  DB_BACKUP_RETENTION,
  DEFAULT_ACCOUNT_NAMESPACE,
  DEFAULT_COURSE_PACKAGE_NAME,
  PLAYBACK_ACTIVE_STATES,
  PLAYBACK_COOLDOWN_READY_SECONDS,
  PLAYBACK_PREVIEW_TTL_MS,
  PLAYBACK_TERMINAL_CURRENT_TTL_MS,
  PLAYBACK_TERMINAL_STATES,
  PLAYBACK_TRAINING_READY_SECONDS,
  PLAYBACK_WARMUP_READY_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SUPERADMIN_USERNAMES,
  TV_ONLINE_THRESHOLD_MS,
  TV_SCREEN_COUNT,
  __dirname,
  actionAllowsUser,
  actionMatchesCoursePackageScope,
  actionTypeMatchesCoursePackageScope,
  addCalendarDays,
  addUniqueCourseSeconds,
  appPackageRoot,
  assertCanSaveTemplate,
  attachCourseBasics,
  backupRoot,
  buildActionMediaMap,
  buildAppPackageDownloadPath,
  buildTvScreenSnapshot,
  calculateFileChecksum,
  calculatePlaybackElapsedMs,
  calendarDateDiffDays,
  calendarDateStartIso,
  cleanupExpiredSessions,
  clone,
  clonePlainObject,
  coerceCourseScript,
  collectActionIdsFromCourseScript,
  collectCourseStationRules,
  collectScriptResources,
  compactCoursePackageLookupText,
  configureStorageRoot,
  copyDirectoryRecursive,
  courseAllowsUser,
  coursePackageAllowsCourse,
  courseStationRuleAliases,
  courseStationRuleFields,
  courseSummaryFromScript,
  courseTypeTagsFromTypeIds,
  createAppPackageStoredName,
  createAuthPayload,
  createDatabaseBackup,
  createDefaultState,
  createPlaybackSessionId,
  createStoredName,
  dbFile,
  decorateTvDeviceSnapshot,
  dedupeActionTypesWithinPackages,
  dedupeLessonTypesWithinPackages,
  defaultHydrateSecondsFromCourse,
  defaultState,
  defaultStorageRoot,
  deriveCourseMetadataFields,
  deriveCourseStationRules,
  deriveCourseSwitchRule,
  deriveCourseSwitchRuleFromSources,
  deriveCourseTopicFromTypeIds,
  deriveTrainingPanel,
  endOfWeek,
  ensureConsoleAccountSeeds,
  ensureDir,
  environmentLabelForNamespace,
  estimateCoursePlaybackDurationMs,
  findCoursePackageIdByNameCandidates,
  findPlaybackSessionById,
  findTvScreenForRequest,
  formatBackupStamp,
  formatCalendarDate,
  formatCourseSecondsList,
  fs,
  getActiveCoursePackageIdForNamespace,
  getActivePlaybackSessionEntry,
  getAppPackageFilePath,
  getCalendarWeekRange,
  getCoursePackageByIdInternal,
  getCoursePackageCourseIdSet,
  getCourseTemplatePackageIds,
  getCurrentPlaybackSessionEntry,
  getDatabaseStatus,
  getDefaultCoursePackageId,
  getDefaultOrHybridCoursePackageId,
  getPlaybackSessionDurationMs,
  getRecentTerminalPlaybackSessionEntry,
  getScopedRecordPackageIds,
  getTemplateFallbackCoursePackageIds,
  getTwelveRoundCoursePackageId,
  getUserVisibleCourseIdSet,
  getUserVisibleCoursePackageIdSet,
  getVenueById,
  hasCourseStationRuleValues,
  hasTrainingPlaybackPods,
  hasWaterfallPlaybackItems,
  hashValue,
  inCalendarDateRange,
  inRange,
  inferAppPlatformFromFilename,
  inferAppVersionFromFilename,
  inferCoursePackageIdForCourse,
  isFutureTime,
  isMd5Digest,
  isPlainObject,
  isSeedEnvironmentLabel,
  isVenuePlaybackActive,
  lessonTypeAllowsUser,
  lessonTypeMatchesCoursePackageScope,
  listBackupFiles,
  listCopyableSchedulesInWeek,
  listCoursePackagesForUser,
  listSchedulesByDate,
  listSchedulesInWeek,
  listTemplatesByKind,
  loadState,
  materializePlaybackSession,
  md5Text,
  mediaRoot,
  migrateDefaultStorageIfNeeded,
  nextId,
  normalizeAccountNamespace,
  normalizeActionPayload,
  normalizeActionRecord,
  normalizeActionTypeRecord,
  normalizeAllowedClients,
  normalizeAppPackageRecord,
  normalizeAppPlatform,
  normalizeCalendarDate,
  normalizeClientName,
  normalizeCourseIdentityText,
  normalizeCoursePackageId,
  normalizeCoursePackageLookupText,
  normalizeCoursePackageRecord,
  normalizeCoursePayload,
  normalizeCourseRotationType,
  normalizeCourseStationRules,
  normalizeCourseTag,
  normalizeCourseTags,
  normalizeCourseTemplateName,
  normalizeCourseTemplatePackageIds,
  normalizeCourseTemplatePayload,
  normalizeCourseTopLevelMetadata,
  normalizeLessonTypePackages,
  normalizeLoadedState,
  normalizeLoadedStateDidChange,
  normalizeLoadedTemplateCoursePackageIds,
  normalizePassword,
  normalizePlaybackCommand,
  normalizePlaybackSessionEntry,
  normalizePlaybackState,
  normalizeReadyDurations,
  normalizeScheduleBeginTimePayload,
  normalizeScheduleEntry,
  normalizeScreenAccountNamespace,
  normalizeTemplateCoursePackageIds,
  normalizeTemplatePayload,
  normalizeTemplateSourceCourseId,
  normalizeTemplateVideoGroup,
  normalizeTvPlaybackState,
  normalizeTvScreenPayload,
  normalizeTvUpdateState,
  normalizeUserPackageIds,
  normalizeVenueAccountNamespace,
  normalizeVenueId,
  normalizeVenuePackageIds,
  normalizeWaterfallTemplateSection,
  nowIso,
  numberList,
  padNumber,
  parseScheduleWeekStart,
  path,
  persist,
  pickCourseStationRuleValue,
  pickTextField,
  prepareActionOwnerPayload,
  prepareCourseOwnerPayload,
  pruneBackupFiles,
  publicUserInfo,
  randomToken,
  readTextIfExists,
  recordPlaybackCommand,
  reloadStoreState,
  resolveActionName,
  resolveCourseRuleScript,
  resolveMediaUrl,
  resolveScriptMediaUrls,
  resolveTvRequestAccountNamespace,
  resolveVenueActiveCoursePackageId,
  resolveWriteCoursePackageId,
  resolveWriteCoursePackageIds,
  safeNumber,
  safeTimeMs,
  sanitizeCoursePackageIds,
  sanitizeSegment,
  scheduleCalendarDate,
  scheduleHasExistingCourse,
  scheduleMatchesCoursePackage,
  scopedRecordBelongsToCoursePackage,
  secondsFromNow,
  serializeAppPackage,
  serializeCourse,
  serializeCoursePackage,
  serializeCourseSummary,
  serializePlaybackSession,
  serializeTemplate,
  sortByNewest,
  startOfWeek,
  state,
  storageRoot,
  stripMediaSuffix,
  stripSeedCourseExamples,
  syncActionCourseTagsForCourse,
  syncAllActionCourseTagsFromCourses,
  syncAppPackageState,
  syncCourseStationRules,
  targetWeekConflictError,
  templateAllowsUser,
  templateUid,
  trimText,
  tryLoadStateFile,
  upsertTvScreen,
  userAllowsClient,
  userIdentityText,
  validCoursePackageIdSet,
  validateTemplatePayload,
  withTime,
  writeStateSnapshot,
  writeTextAtomic
} from "./core.js";
import { getCourseById } from "./content-store.js";

/**
 * 组装 TV schedule entry，把排课、课程和视频资源合成 TV bundle 使用的稳定结构。
 */
function buildTvScheduleEntry(schedule) {
  const course = getCourseById(schedule.courseId);

  if (!course) {
    return null;
  }

  const resolvedScript = resolveScriptMediaUrls(course.script);
  const entry = {
    id: schedule.id,
    courseId: schedule.courseId,
    coursePackageId: normalizeCoursePackageId(schedule.coursePackageId),
    courseName: schedule.courseName,
    version: schedule.version,
    description: schedule.description,
    topic: schedule.topic,
    rotationType: schedule.rotationType,
    stationRules: schedule.stationRules || normalizeCourseStationRules(),
    beginTime: schedule.beginTime,
    duration: schedule.duration,
    course: {
      ...course,
      stationRules: course.stationRules || normalizeCourseStationRules(),
      script: resolvedScript
    }
  };

  entry.contentChecksum = hashValue({
    schedule: {
      id: entry.id,
      courseId: entry.courseId,
      courseName: entry.courseName,
      version: entry.version,
      description: entry.description,
      topic: entry.topic,
      rotationType: entry.rotationType,
      stationRules: entry.stationRules,
      beginTime: entry.beginTime,
      duration: entry.duration
    },
    course: entry.course
  });
  entry.resources = collectScriptResources(resolvedScript);
  return entry;
}

/**
 * 读取 tv daily bundle，并保持返回结构稳定。
 */
export function getTvDailyBundle(dateText, timeZone = "Asia/Shanghai", accountNamespace = "", tvScope = {}) {
  const date = normalizeCalendarDate(dateText, timeZone);
  const requestedNamespace = resolveTvRequestAccountNamespace(accountNamespace, tvScope);
  const activeCoursePackageId = requestedNamespace
    ? getActiveCoursePackageIdForNamespace(requestedNamespace)
    : 0;
  const schedules = requestedNamespace && activeCoursePackageId
    ? listSchedulesByDate(date, timeZone)
        .filter((item) => scheduleMatchesCoursePackage(item, activeCoursePackageId))
        .map(buildTvScheduleEntry)
        .filter(Boolean)
    : [];

  const resourceMap = new Map();

  for (const schedule of schedules) {

    for (const resource of schedule.resources || []) {
      resourceMap.set(resource.key, resource);
    }
  }

  const resources = [...resourceMap.values()].sort((left, right) => left.key.localeCompare(right.key));
  const checksum = hashValue({
    date,
    coursePackageId: activeCoursePackageId || 0,
    scheduleCount: schedules.length,
    schedules: schedules.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      coursePackageId: normalizeCoursePackageId(item.coursePackageId),
      beginTime: item.beginTime,
      contentChecksum: item.contentChecksum
    })),
    resources: resources.map((item) => ({
      key: item.key,
      url: item.url,
      checksum: trimText(item.checksum),
      sizeBytes: safeNumber(item.sizeBytes)
    }))
  });

  return {
    date,
    timeZone,
    coursePackageId: activeCoursePackageId || 0,
    checksum,
    generatedAt: nowIso(),
    scheduleCount: schedules.length,
    schedules,
    resources
  };
}

/**
 * 读取 tv daily checksum，并保持返回结构稳定。
 */
export function getTvDailyChecksum(dateText, timeZone = "Asia/Shanghai", accountNamespace = "", tvScope = {}) {
  const bundle = getTvDailyBundle(dateText, timeZone, accountNamespace, tvScope);
  return {
    date: bundle.date,
    timeZone: bundle.timeZone,
    checksum: bundle.checksum,
    generatedAt: bundle.generatedAt,
    scheduleCount: bundle.scheduleCount,
    schedules: bundle.schedules.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      coursePackageId: normalizeCoursePackageId(item.coursePackageId),
      courseName: item.courseName,
      version: item.version,
      description: item.description,
      topic: item.topic,
      rotationType: item.rotationType,
      stationRules: item.stationRules || normalizeCourseStationRules(),
      beginTime: item.beginTime,
      duration: item.duration,
      contentChecksum: item.contentChecksum
    }))
  };
}

/**
 * 读取 tv schedule bundle，并保持返回结构稳定。
 */
export function getTvScheduleBundle(scheduleId) {
  const numericId = Number(scheduleId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  const schedule = state.schedules.map(attachCourseBasics).find((item) => item.id === numericId);

  if (!schedule) {
    return null;
  }

  const entry = buildTvScheduleEntry(schedule);

  if (!entry) {
    return null;
  }

  const resources = [...(entry.resources || [])].sort((left, right) => left.key.localeCompare(right.key));
  return {
    scheduleId: entry.id,
    coursePackageId: normalizeCoursePackageId(entry.coursePackageId),
    generatedAt: nowIso(),
    checksum: hashValue({
      scheduleId: entry.id,
      contentChecksum: entry.contentChecksum,
      resources: resources.map((item) => ({
        key: item.key,
        url: item.url,
        checksum: trimText(item.checksum),
        sizeBytes: safeNumber(item.sizeBytes)
      }))
    }),
    schedule: entry,
    resources
  };
}

/**
 * 读取 current playback session，并保持返回结构稳定。
 */
export function getCurrentPlaybackSession(accountNamespace = "") {
  return serializePlaybackSession(getCurrentPlaybackSessionEntry(accountNamespace));
}

/**
 * 读取 active playback session，并保持返回结构稳定。
 */
export function getActivePlaybackSession(accountNamespace = "") {
  return serializePlaybackSession(getActivePlaybackSessionEntry(accountNamespace));
}

/**
 * 读取 current playback session for tv，并保持返回结构稳定。
 */
export function getCurrentPlaybackSessionForTv(payload = {}) {
  const requestedAccountNamespace = normalizeScreenAccountNamespace(payload.accountNamespace);
  const requestedDeviceId = trimText(payload.deviceId).toUpperCase();
  const requestedScreenNumber = Number(payload.screenNumber) || 0;
  const matchedScreen =
    (state.tvScreens || []).find((item) => {
      const sameDevice = requestedDeviceId && trimText(item.deviceId).toUpperCase() === requestedDeviceId;
      const sameScreen =
        requestedScreenNumber >= 1
        && normalizeScreenAccountNamespace(item.accountNamespace) === requestedAccountNamespace
        && Number(item.screenNumber) === requestedScreenNumber;
      return sameDevice || sameScreen;
    }) || null;
  const accountNamespace =
    normalizeScreenAccountNamespace(matchedScreen?.accountNamespace)
    || requestedAccountNamespace
    || DEFAULT_ACCOUNT_NAMESPACE;
  const active = getActivePlaybackSessionEntry(accountNamespace);
  const screenSessionId = trimText(matchedScreen?.playbackSessionId);

  if (active) {
    return serializePlaybackSession(active);
  }

  const screenSession = screenSessionId ? findPlaybackSessionById(screenSessionId, accountNamespace) : null;
  if (screenSession && PLAYBACK_ACTIVE_STATES.has(screenSession.state)) {
    const screenSessionState = normalizePlaybackState(screenSession.state);
    if (screenSessionState !== "PREVIEW" || Boolean(matchedScreen?.previewMode)) {
      return serializePlaybackSession(screenSession);
    }
  }

  if (screenSession && PLAYBACK_TERMINAL_STATES.has(screenSession.state)) {
    return serializePlaybackSession(screenSession);
  }

  return serializePlaybackSession(getRecentTerminalPlaybackSessionEntry(accountNamespace));
}

/**
 * 读取 playback session，并保持返回结构稳定。
 */
export function getPlaybackSession(sessionId, accountNamespace = "") {
  return serializePlaybackSession(findPlaybackSessionById(sessionId, accountNamespace));
}

/**
 * 创建 preview playback session，并补齐运行时需要的默认配置。
 */
export function createPreviewPlaybackSession(payload = {}, accountNamespace = "") {
  const ns = normalizeAccountNamespace(accountNamespace);
  const scheduleId = trimText(payload.scheduleId);
  const commandId = trimText(payload.commandId);

  if (!commandId) {
    throw new Error("commandId 不能为空。");
  }
  const scheduleBundle = getTvScheduleBundle(scheduleId);

  if (!scheduleBundle?.schedule) {
    throw new Error("未找到对应的课程排课。");
  }

  const active = getActivePlaybackSessionEntry(ns);
  const nextChecksum = trimText(payload.bundleChecksum) || trimText(scheduleBundle.schedule.contentChecksum) || trimText(scheduleBundle.checksum);

  if (active) {
    const samePreview =
      trimText(active.scheduleId) === String(scheduleBundle.schedule.id)
      && safeNumber(active.courseId) === safeNumber(scheduleBundle.schedule.courseId)
      && trimText(active.bundleChecksum) === nextChecksum
      && normalizePlaybackState(active.state) === "PREVIEW";

    if (samePreview) {
      const commandResult = recordPlaybackCommand(active, "preview", commandId);

      if (!commandResult.duplicate) {
        active.version = Math.max(1, safeNumber(active.version, 1)) + 1;
        if (commandResult.command) {
          commandResult.command.version = active.version;
          commandResult.command.resultVersion = active.version;
        }
        active.updatedAtMs = Date.now();
        active.updateTime = nowIso();
      }
      persist();
      return serializePlaybackSession(active);
    }
    const error = new Error("当前已有未结束课程，请先终止当前课程。");
    error.code = "ACTIVE_PLAYBACK_SESSION";
    throw error;
  }

  const now = nowIso();
  const nowMs = Date.now();
  const session = normalizePlaybackSessionEntry({
    id: createPlaybackSessionId(),
    accountNamespace: ns,
    state: "PREVIEW",
    version: 1,
    scheduleId: String(scheduleBundle.schedule.id),
    courseId: scheduleBundle.schedule.courseId,
    courseName: scheduleBundle.schedule.courseName,
    duration: scheduleBundle.schedule.duration,
    expectedDurationMs:
      safeNumber(payload.expectedDurationMs)
      || estimateCoursePlaybackDurationMs(scheduleBundle.schedule.course?.script)
      || safeNumber(scheduleBundle.schedule.duration) * 60 * 1000,
    bundleChecksum: nextChecksum,
    scheduledStartAtMs: safeNumber(payload.scheduledStartAtMs, new Date(scheduleBundle.schedule.beginTime).getTime()),
    serverStartAtMs: 0,
    pausedAccumulatedMs: 0,
    pausedAtMs: 0,
    createdBy: trimText(payload.createdBy),
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    createTime: now,
    updateTime: now
  });

  recordPlaybackCommand(session, "preview", commandId);

  state.playbackSessions = state.playbackSessions || [];
  state.playbackSessions.push(session);
  persist();
  return serializePlaybackSession(session);
}

/**
 * 更新 playback session state，只改变调用方明确提交的字段。
 */
export function updatePlaybackSessionState(sessionId, action, payload = {}, accountNamespace = "") {
  const ns = normalizeAccountNamespace(accountNamespace);
  const session = findPlaybackSessionById(sessionId, ns);

  if (!session) {
    return null;
  }

  const normalizedAction = trimText(action).toLowerCase();
  const commandId = trimText(payload.commandId);
  const existingCommand = commandId
    ? (session.commandLog || []).find((item) => trimText(item.commandId) === commandId)
    : null;

  if (existingCommand) {
    return serializePlaybackSession(session);
  }

  if (!commandId) {
    throw new Error("commandId 不能为空。");
  }

  const nowMs = Date.now();

  if (normalizedAction === "start") {
    if (safeNumber(session.serverStartAtMs) > 0 && ["SCHEDULED", "RUNNING"].includes(session.state)) {
      const commandResult = recordPlaybackCommand(session, normalizedAction, commandId);

      if (!commandResult.duplicate) {
        session.updatedAtMs = nowMs;
        session.updateTime = nowIso();
      }
      persist();
      return serializePlaybackSession(session);
    }
    if (!["PREVIEW", "SCHEDULED"].includes(session.state)) {
      if (session.state === "RUNNING") {
        const commandResult = recordPlaybackCommand(session, normalizedAction, commandId);

        if (!commandResult.duplicate) {
          session.updatedAtMs = nowMs;
          session.updateTime = nowIso();
        }
        persist();
        return serializePlaybackSession(session);
      }
      throw new Error("当前 session 状态不允许开始课程。");
    }
    const requestedStartDelayMs = safeNumber(payload.startDelayMs, 5000);
    const startDelayMs = Math.max(4000, Math.min(30000, requestedStartDelayMs + 1000));
    session.state = "RUNNING";
    session.startDelayMs = startDelayMs;
    session.serverStartAtMs = nowMs + startDelayMs;
    session.pausedAccumulatedMs = 0;
    session.pausedAtMs = 0;
  } else if (normalizedAction === "pause") {
    if (session.state === "PAUSED") {
      const commandResult = recordPlaybackCommand(session, normalizedAction, commandId);

      if (!commandResult.duplicate) {
        session.updatedAtMs = nowMs;
        session.updateTime = nowIso();
      }
      persist();
      return serializePlaybackSession(session);
    }
    if (!["SCHEDULED", "RUNNING"].includes(session.state)) {
      throw new Error("当前 session 状态不允许暂停。");
    }
    session.state = "PAUSED";
    session.pausedAtMs =
      session.serverStartAtMs > 0 && nowMs < session.serverStartAtMs
        ? session.serverStartAtMs
        : nowMs;
  } else if (normalizedAction === "resume") {
    if (session.state === "RUNNING") {
      const commandResult = recordPlaybackCommand(session, normalizedAction, commandId);

      if (!commandResult.duplicate) {
        session.updatedAtMs = nowMs;
        session.updateTime = nowIso();
      }
      persist();
      return serializePlaybackSession(session);
    }

    if (session.state !== "PAUSED") {
      throw new Error("当前 session 状态不允许继续。");

    }

    if (session.pausedAtMs > 0) {
      session.pausedAccumulatedMs = safeNumber(session.pausedAccumulatedMs) + Math.max(0, nowMs - session.pausedAtMs);
    }
    session.state = "RUNNING";
    session.pausedAtMs = 0;
  } else if (normalizedAction === "end" || normalizedAction === "terminate") {
    if (PLAYBACK_TERMINAL_STATES.has(session.state)) {
      const commandResult = recordPlaybackCommand(session, normalizedAction, commandId);

      if (!commandResult.duplicate) {
        session.updatedAtMs = nowMs;
        session.updateTime = nowIso();
      }
      persist();
      return serializePlaybackSession(session);
    }
    if (!PLAYBACK_TERMINAL_STATES.has(session.state)) {
      session.state = normalizedAction === "end" ? "ENDED" : "TERMINATED";
      session.endTime = nowIso();

      if (normalizedAction === "end") {
        session.endedAtMs = nowMs;
      } else {
        session.terminatedAtMs = nowMs;
      }
    }
  } else {
    throw new Error("未知 playback session 操作。");
  }

  session.version = Math.max(1, safeNumber(session.version, 1)) + 1;
  session.updatedAtMs = nowMs;
  session.updateTime = nowIso();
  recordPlaybackCommand(session, normalizedAction, commandId);
  persist();
  return serializePlaybackSession(session);
}

/**
 * 封装 end expired playback sessions 的业务步骤，避免调用方依赖内部实现细节。
 */
export function endExpiredPlaybackSessions() {
  const terminalSessions = [];
  const sessions = Array.isArray(state.playbackSessions) ? state.playbackSessions : [];

  for (const session of sessions) {
    if (!session || typeof session !== "object") {
      continue;
    }
    const beforeState = normalizePlaybackState(session.state);
    const beforeVersion = safeNumber(session.version);
    const wasActive = PLAYBACK_ACTIVE_STATES.has(beforeState);

    if (!wasActive) {
      continue;
    }

    materializePlaybackSession(session);

    const afterState = normalizePlaybackState(session.state);
    if (PLAYBACK_TERMINAL_STATES.has(afterState) && (beforeState !== afterState || safeNumber(session.version) !== beforeVersion)) {
      terminalSessions.push(serializePlaybackSession(session));
    }
  }

  return terminalSessions;
}

/**
 * 绑定 tv screen，同步相关账户、场馆或屏幕状态。
 */
export function bindTvScreen(payload = {}, accountNamespace = "") {
  return upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
}

/**
 * 处理 tv screen 心跳，刷新在线状态和运行时快照。
 */
export function heartbeatTvScreen(payload = {}, accountNamespace = "") {
  const heartbeatDeviceId = trimText(payload.deviceId);
  const unboundEntry = heartbeatDeviceId
    ? state.tvScreens.find(
        (item) =>
          trimText(item.deviceId) === heartbeatDeviceId
          && !normalizeScreenAccountNamespace(item.accountNamespace)
      ) || null
    : null;

  if (unboundEntry) {
    const screen = upsertTvScreen({
      ...payload,
      accountNamespace: "",
      screenNumber: 0,
      previousAccountNamespace:
        trimText(unboundEntry.previousAccountNamespace)
        || normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace),
      previousScreenNumber:
        Number(unboundEntry.previousScreenNumber)
        || Number(payload.screenNumber)
        || 0
    });
    return {
      ...screen,
      serverNowMs: Date.now(),
      sessionOutdated: false,
      session: null
    };
  }

  const screen = upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
  const activeSession = getActivePlaybackSessionEntry(screen?.accountNamespace || payload.accountNamespace || accountNamespace);
  const reportedSessionId = trimText(payload.playbackSessionId);
  const reportedVersion = safeNumber(payload.sessionVersion, safeNumber(payload.playbackSessionVersion));
  const activeState = normalizePlaybackState(activeSession?.state);
  const reportedPlaybackState = normalizeTvPlaybackState(payload.playbackState || screen?.playbackState);
  const reportedPreviewMode =
    typeof payload.previewMode === "boolean" ? payload.previewMode : Boolean(screen?.previewMode);
  const previewStateMismatch =
    activeState === "PREVIEW"
    && (reportedPlaybackState !== "PREVIEW" || !reportedPreviewMode);
  const sessionOutdated =
    Boolean(activeSession)
    && (
      reportedSessionId !== trimText(activeSession.id)
      || reportedVersion < safeNumber(activeSession.version)
      || previewStateMismatch
    );

  return {
    ...screen,
    serverNowMs: Date.now(),
    sessionOutdated,
    session: sessionOutdated ? serializePlaybackSession(activeSession) : null
  };
}

/**
 * 解绑 tv screen，保留后续恢复和排查需要的历史信息。
 */
export function unbindTvScreen(payload = {}, accountNamespace = "") {
  const deviceId = trimText(payload.deviceId);
  const screenNumber = Number(payload.screenNumber) || 0;
  const normalizedAccountNamespace = normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace);

  if (!deviceId && screenNumber < 1) {
    return null;
  }

  const existing =
    state.tvScreens.find(
      (item) =>
        normalizeScreenAccountNamespace(item.accountNamespace) === normalizedAccountNamespace
        && (
        (deviceId && trimText(item.deviceId) === deviceId) ||
        (screenNumber > 0 && Number(item.screenNumber) === screenNumber)
        )
    ) || null;

  if (!existing) {
    return null;
  }

  const removedEntry = {
    ...existing,
    accountNamespace: "",
    screenNumber: 0,
    previousAccountNamespace: normalizedAccountNamespace || normalizeScreenAccountNamespace(existing.accountNamespace),
    previousScreenNumber: Number(existing.screenNumber) || screenNumber || 0,
    playbackState: "IDLE",
    activeScheduleId: "",
    previewMode: false,
    playbackSessionId: "",
    bundleChecksum: "",
    playbackElapsedMs: 0,
    pairToken: trimText(existing.pairToken),
    pairUpdatedAt: trimText(existing.pairUpdatedAt),
    unboundAt: nowIso(),
    lastSeenAt: nowIso()
  };

  const existingDeviceId = trimText(existing.deviceId);
  state.tvScreens = state.tvScreens.filter((item) => {
    if (existingDeviceId) {
      return trimText(item.deviceId) !== existingDeviceId;
    }
    return !(
      normalizeScreenAccountNamespace(item.accountNamespace) === normalizedAccountNamespace
      && screenNumber > 0
      && Number(item.screenNumber) === screenNumber
    );
  });
  state.tvScreens.push(removedEntry);
  persist();
  return buildTvScreenSnapshot(removedEntry);
}

/**
 * 读取 tv screens 列表，并按业务规则过滤或排序。
 */
export function listTvScreens() {
  const accountNamespace =
    arguments.length > 0 ? normalizeAccountNamespace(arguments[0]) : DEFAULT_ACCOUNT_NAMESPACE;
  const snapshots = new Map();
  const unboundDevices = [];

  for (const item of state.tvScreens || []) {
    const snapshot = buildTvScreenSnapshot(item);

    if (snapshot.deviceId) {
      const snapshotAccountNamespace = normalizeScreenAccountNamespace(snapshot.accountNamespace);

      if (!snapshotAccountNamespace) {
        const previousAccountNamespace = normalizeScreenAccountNamespace(snapshot.previousAccountNamespace);

        if (!previousAccountNamespace || previousAccountNamespace === accountNamespace) {
          unboundDevices.push(snapshot);
        }
        continue;
      }

      if (snapshotAccountNamespace !== accountNamespace) {
        continue;
      }

      if (snapshot.screenNumber >= 1 && snapshot.screenNumber <= TV_SCREEN_COUNT) {
        snapshots.set(snapshot.screenNumber, snapshot);
        continue;
      }
    }
  }
  unboundDevices.sort((left, right) => {
    const leftMs = new Date(left.lastSeenAt || left.unboundAt || 0).getTime();
    const rightMs = new Date(right.lastSeenAt || right.unboundAt || 0).getTime();
    return rightMs - leftMs;
  });

  return {
    generatedAt: nowIso(),
    screens: Array.from({ length: TV_SCREEN_COUNT }, (_, index) => {
      const screenNumber = index + 1;
      return (
        snapshots.get(screenNumber) || {
          screenNumber,
          orientation: screenNumber === 2 || screenNumber === 4 ? "HORIZONTAL" : "VERTICAL",
          deviceId: "",
          mqttClientId: "",
          appVersion: "",
          platform: "tv-android",
          boundAt: "",
          lastSeenAt: "",
          online: false,
          playbackState: "IDLE",
          activeScheduleId: "",
          previewMode: false,
          playbackSessionId: "",
          bundleChecksum: "",
          playbackElapsedMs: 0,
          updateState: "IDLE",
          updateTargetVersion: "",
          updateProgressPercent: 0,
          updateMessage: "",
          cacheBytes: 0,
          cacheFileCount: 0,
          cacheUpdatedAt: "",
          previousAccountNamespace: "",
          previousScreenNumber: 0,
          unboundAt: ""
        }
      );
    }),
    unboundDevices
  };
}

/**
 * 读取 tv devices 列表，并按业务规则过滤或排序。
 */
export function listTvDevices(filters = {}) {
  const venueId = trimText(filters.venueId);
  const onlineOnly = Boolean(filters.onlineOnly);
  const venue = venueId ? getVenueById(venueId) : null;
  const venueAccountNamespace = venue ? normalizeScreenAccountNamespace(venue.accountNamespace) : "";
  const devices = (state.tvScreens || [])
    .map((entry) => decorateTvDeviceSnapshot(buildTvScreenSnapshot(entry)))
    .filter((item) => item.deviceId)
    .filter((item) => !onlineOnly || item.online)
    .filter((item) => {
      if (!venueAccountNamespace) {
        return true;
      }
      return (
        item.accountNamespace === venueAccountNamespace
        || (!item.accountNamespace && item.previousAccountNamespace === venueAccountNamespace)
      );
    })
    .sort((left, right) => {
      if (left.online !== right.online) {
        return left.online ? -1 : 1;
      }

      if (left.accountNamespace !== right.accountNamespace) {
        return left.accountNamespace ? -1 : 1;
      }
      const leftMs = new Date(left.lastSeenAt || left.unboundAt || 0).getTime();
      const rightMs = new Date(right.lastSeenAt || right.unboundAt || 0).getTime();
      return rightMs - leftMs;
    });

  return {
    generatedAt: nowIso(),
    devices
  };
}

/** Verifies a diagnostic upload against private binding data without exposing tokens or writing state. */
export function authenticateTvDiagnosticUpload(headers) {
  return authenticateDiagnosticDevice(headers, state.tvScreens || []);
}

/**
 * 绑定 tv screen by pairing，同步相关账户、场馆或屏幕状态。
 */
export function bindTvScreenByPairing(payload = {}, accountNamespace = "") {
  const deviceId = trimText(payload.deviceId);
  const pairToken = trimText(payload.pairToken);
  const screenNumber = Number(payload.screenNumber) || 0;
  const nextAccountNamespace = normalizeScreenAccountNamespace(accountNamespace);

  if (!deviceId || screenNumber < 1 || screenNumber > TV_SCREEN_COUNT || !nextAccountNamespace) {
    return null;
  }

  const unboundCandidates = state.tvScreens.filter(
    (item) => trimText(item.deviceId) === deviceId && !normalizeScreenAccountNamespace(item.accountNamespace)
  );
  const existing =
    unboundCandidates.find((item) => pairToken && trimText(item.pairToken) === pairToken)
    || unboundCandidates[0]
    || null;

  return upsertTvScreen({
    ...(existing || {}),
    deviceId,
    pairToken: pairToken || trimText(existing?.pairToken),
    accountNamespace: nextAccountNamespace,
    screenNumber,
    boundAt: nowIso()
  });
}
