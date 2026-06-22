// @ts-nocheck
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
 * 读取 schedules by scope 列表，并按业务规则过滤或排序。
 */
export function listSchedulesByScope(scope = "CURRENTWEEK", options = {}) {
  const currentWeek = getCalendarWeekRange(0);
  const lastWeek = getCalendarWeekRange(-1);

  let list = state.schedules.map(attachCourseBasics);
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(options?.user || null);

  if (visiblePackageIds) {
    list = list.filter((item) => visiblePackageIds.has(normalizeCoursePackageId(item.coursePackageId)));
  }
  const coursePackageId = normalizeCoursePackageId(options?.coursePackageId || 0, 0);

  if (coursePackageId > 0) {
    list = list.filter((item) => normalizeCoursePackageId(item.coursePackageId) === coursePackageId);
  }

  if (scope === "CURRENTWEEK") {
    list = list.filter((item) => inCalendarDateRange(item.beginTime, currentWeek.start, currentWeek.end));
  } else if (scope === "LASTWEEK") {
    list = list.filter((item) => inCalendarDateRange(item.beginTime, lastWeek.start, lastWeek.end));
  }

  return list.sort((left, right) => {
    const leftTime = new Date(left.beginTime).getTime();
    const rightTime = new Date(right.beginTime).getTime();
    return scope === "HISTORY" ? rightTime - leftTime : leftTime - rightTime;
  });
}

/**
 * 保存 schedule，并触发必要的归一化和持久化。
 */
export function saveSchedule(payload, user = null) {
  const courseId = Number(payload.courseId);
  const course = getCourseById(courseId);

  if (!course) {
    return null;
  }

  const existing = payload.id ? state.schedules.find((item) => item.id === Number(payload.id)) ?? null : null;
  const requestedCoursePackageId = normalizeCoursePackageId(payload.coursePackageId || existing?.coursePackageId, 0);
  const coursePackageId = resolveWriteCoursePackageId(user, requestedCoursePackageId || inferCoursePackageIdForCourse(courseId), existing?.coursePackageId);

  if (!coursePackageAllowsCourse(coursePackageId, courseId)) {
    throw new Error("该课程不属于当前课程包，不能排课。");
  }

  const beginTime = normalizeScheduleBeginTimePayload(payload);

  if (!beginTime) {
    throw new Error("排课日期无效。");
  }

  const next = {
    id: payload.id ? Number(payload.id) : nextId(state.schedules),
    courseId,
    coursePackageId,
    courseName: course.name,
    version: trimText(payload.version) || course.version,
    beginTime,
    duration: Number(payload.duration) || 0

  };

  const index = state.schedules.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.schedules[index] = next;
  } else {
    state.schedules.push(next);
  }

  persist();
  return attachCourseBasics(next);
}

/**
 * 删除 schedule，同时遵守课程和排课的保护规则。
 */
export function deleteSchedule(scheduleId) {
  const numericId = Number(scheduleId);
  state.schedules = state.schedules.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

/**
 * 裁剪 future deleted course schedules，只移除业务允许丢弃的历史数据。
 */
export function pruneFutureDeletedCourseSchedules(options = {}) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(trimText(options?.today))
    ? trimText(options.today)
    : formatCalendarDate(new Date(), "Asia/Shanghai");
  const removed = [];

  state.schedules = state.schedules.filter((item) => {
    if (scheduleHasExistingCourse(item)) {
      return true;
    }
    const scheduleDate = scheduleCalendarDate(item);
    const shouldRemove = !scheduleDate || scheduleDate >= today;

    if (shouldRemove) {
      removed.push(attachCourseBasics(item));
      return false;
    }
    return true;
  });

  if (removed.length) {
    persist();
  }

  return {
    ok: true,
    removedCount: removed.length,
    removed
  };
}

/**
 * 复制 week schedules，并过滤不应该进入目标范围的数据。
 */
export function copyWeekSchedules(payload = {}, user = null, options = {}) {
  const requestedCoursePackageId = normalizeCoursePackageId(payload?.coursePackageId, 0);

  if (!requestedCoursePackageId && !options?.allowImplicitCoursePackage) {
    throw new Error("请选择课程包。");
  }

  const targetCoursePackageId = resolveWriteCoursePackageId(user, requestedCoursePackageId, 0);

  if (!targetCoursePackageId) {
    throw new Error("请选择课程包。");
  }

  const sourceWeekStart = parseScheduleWeekStart(payload?.sourceWeekStart, "来源周");
  const targetWeekStart = parseScheduleWeekStart(payload?.targetWeekStart, "目标周");
  const sourceWeekEnd = addCalendarDays(sourceWeekStart, 7);
  const targetWeekEnd = addCalendarDays(targetWeekStart, 7);
  const currentWeekStart = getCalendarWeekRange(0).start;
  const allowCurrentTargetWeek = Boolean(options?.allowCurrentTargetWeek);

  if (sourceWeekStart > currentWeekStart) {
    throw new Error("来源周必须是过去周或本周。");
  }
  if (targetWeekStart < currentWeekStart || (!allowCurrentTargetWeek && targetWeekStart <= currentWeekStart)) {
    throw new Error("目标周必须是未来周。");
  }

  const sourceSchedulesInWeek = listSchedulesInWeek(targetCoursePackageId, sourceWeekStart, sourceWeekEnd);
  const sourceSchedules = listCopyableSchedulesInWeek(targetCoursePackageId, sourceWeekStart, sourceWeekEnd);

  if (!sourceSchedulesInWeek.length) {
    throw new Error("来源周没有排课。");
  }

  if (!sourceSchedules.length) {
    throw new Error("来源周没有可复制课程。");
  }

  const targetSchedules = listSchedulesInWeek(targetCoursePackageId, targetWeekStart, targetWeekEnd);

  if (targetSchedules.length && !payload?.replaceExisting) {
    throw targetWeekConflictError();
  }

  if (payload?.replaceExisting) {
    state.schedules = state.schedules.filter((item) => {
      if (!scheduleMatchesCoursePackage(item, targetCoursePackageId)) {
        return true;
      }
      return !inCalendarDateRange(item.beginTime, targetWeekStart, targetWeekEnd);
    });
  }

  const dayShift = calendarDateDiffDays(sourceWeekStart, targetWeekStart);
  let nextScheduleId = nextId(state.schedules);

  const copied = sourceSchedules.map((item) => {
    const nextDate = new Date(item.beginTime);
    nextDate.setUTCDate(nextDate.getUTCDate() + dayShift);
    const source = attachCourseBasics(item);

    return {
      id: nextScheduleId++,
      courseId: Number(item.courseId) || 0,
      coursePackageId: targetCoursePackageId,
      courseName: source.courseName,
      version: source.version,
      beginTime: nextDate.toISOString(),
      duration: Number(item.duration) || 0
    };
  });

  state.schedules.push(...copied);
  persist();
  return copied.map(attachCourseBasics);
}

/**
 * 复制 last week schedules，并过滤不应该进入目标范围的数据。
 */
export function copyLastWeekSchedules(coursePackageId = "", user = null) {
  const currentWeek = getCalendarWeekRange(0);
  return copyWeekSchedules(
    {
      coursePackageId,
      sourceWeekStart: addCalendarDays(currentWeek.start, -7),
      targetWeekStart: currentWeek.start,
      replaceExisting: true
    },
    user,
    {
      allowCurrentTargetWeek: true,
      allowImplicitCoursePackage: true
    }
  );
}
