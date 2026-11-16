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

/**
 * 创建 media filename，并补齐运行时需要的默认配置。
 */
export function createMediaFilename(originalName = "asset.bin") {
  return createStoredName(originalName);
}

/**
 * 读取 media root，并保持返回结构稳定。
 */
export function getMediaRoot() {
  return mediaRoot;
}

/**
 * 读取 app package root，并保持返回结构稳定。
 */
export function getAppPackageRoot() {
  return appPackageRoot;
}

/**
 * 创建 app package filename，并补齐运行时需要的默认配置。
 */
export function createAppPackageFilename(platform = "tv", version = "", originalName = "app.apk") {
  return createAppPackageStoredName(platform, version, originalName);
}

/**
 * 封装 register uploaded app package 的业务步骤，避免调用方依赖内部实现细节。
 */
export function registerUploadedAppPackage(payload = {}) {
  const filename = trimText(payload.filename);

  if (!filename) {
    throw new Error("安装包文件名不能为空。");
  }

  const existing = (state.appPackages || []).find((item) => trimText(item.filename) === filename) || null;
  const next = normalizeAppPackageRecord(
    {
      ...payload,
      filename,
      source: trimText(payload.source) || "upload",
      updateTime: nowIso()
    },
    existing
  );
  const index = state.appPackages.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.appPackages[index] = next;
  } else {
    state.appPackages.push(next);
  }

  persist();
  return serializeAppPackage(next);
}

/**
 * 读取 app packages 列表，并按业务规则过滤或排序。
 */
export function listAppPackages(platform = "") {
  const safePlatform = trimText(platform).toLowerCase();
  return sortByNewest(
    syncAppPackageState().filter((item) => !safePlatform || item.platform === normalizeAppPlatform(safePlatform)),
    "updateTime"
  ).map(serializeAppPackage);
}

/**
 * 读取 app package by id，并保持返回结构稳定。
 */
export function getAppPackageById(packageId) {
  syncAppPackageState();
  const targetId = Number(packageId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return null;
  }
  const record = (state.appPackages || []).find((item) => item.id === targetId) || null;
  return record ? serializeAppPackage(record) : null;
}

/**
 * 查找 app package file，找不到时返回空值而不是抛错。
 */
export function findAppPackageFile(packageId) {
  const record = getAppPackageById(packageId);

  if (!record?.filename) {
    return null;
  }

  const targetFile = getAppPackageFilePath(record.filename);
  if (!fs.existsSync(targetFile)) {
    return null;
  }

  return {
    record,
    filePath: targetFile
  };
}

/**
 * 封装 rescan app packages 的业务步骤，避免调用方依赖内部实现细节。
 */
export function rescanAppPackages() {
  return listAppPackages();
}

/**
 * 读取 media record，并保持返回结构稳定。
 */
export function getMediaRecord(filename) {
  return state.media.find((item) => item.filename === filename) ?? null;
}

/**
 * 创建 uploaded media，并补齐运行时需要的默认配置。
 */
export function createUploadedMedia({
  originalName,
  mimeType,
  kind,
  filename,
  url,
  storage = "local",
  checksum = "",
  sizeBytes = 0
}) {
  const resolvedFilename = filename || createStoredName(originalName);
  const record = {
    id: nextId(state.media),
    kind,
    filename: resolvedFilename,
    originalName,
    type: mimeType || "application/octet-stream",
    storage,
    url: url || `/api/media/${resolvedFilename}`,
    checksum: trimText(checksum),
    sizeBytes: safeNumber(sizeBytes)
  };

  state.media.push(record);
  persist();
  return record;
}
