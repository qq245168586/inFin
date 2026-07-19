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
  actionTypeAllowsUser,
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
  courseScriptUsesAction,
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
 * 读取 action types 列表，并按业务规则过滤或排序。
 */
export function listActionTypes(user = null, options = {}) {
  return clone(
    state.actionTypes
      .map(normalizeActionTypeRecord)
      .filter((type) => actionTypeAllowsUser(type, user, options))
      .filter((type) => actionTypeMatchesCoursePackageScope(type, options))
  );
}

/**
 * 封装 add action type 的业务步骤，避免调用方依赖内部实现细节。
 */
export function addActionType(payload, user = null, options = {}) {
  const source = typeof payload === "string" ? { name: payload } : payload || {};
  const name = stripMediaSuffix(source.name);
  const requestedPackageIds = numberList(source.coursePackageIds);
  const packageIds = resolveWriteCoursePackageIds(user, requestedPackageIds, [], options);
  const existing = state.actionTypes
    .map(normalizeActionTypeRecord)
    .find((type) => {
      const typePackageIds = numberList(type.coursePackageIds);
      return (
        stripMediaSuffix(type.name).toLowerCase() === name.toLowerCase()
        && typePackageIds.some((id) => packageIds.includes(id))
      );
    });

  if (existing) {
    return existing;
  }

  const next = { id: nextId(state.actionTypes), name, coursePackageIds: packageIds };
  state.actionTypes.push(next);
  persist();
  return next;
}

/**
 * 读取 lesson types 列表，并按业务规则过滤或排序。
 */
export function listLessonTypes(user = null, options = {}) {
  return clone(
    state.lessonTypes
      .map(normalizeActionTypeRecord)
      .filter((type) => lessonTypeAllowsUser(type, user, options))
      .filter((type) => lessonTypeMatchesCoursePackageScope(type, options))
  );
}

/**
 * 封装 add lesson type 的业务步骤，避免调用方依赖内部实现细节。
 */
export function addLessonType(payload, user = null, options = {}) {
  const source = typeof payload === "string" ? { name: payload } : payload || {};
  const name = stripMediaSuffix(source.name);
  const requestedPackageIds = numberList(source.coursePackageIds);
  const packageIds = resolveWriteCoursePackageIds(user, requestedPackageIds, [], options);
  const existing = state.lessonTypes
    .map(normalizeActionTypeRecord)
    .find((type) => {
      const typePackageIds = numberList(type.coursePackageIds);
      return (
        stripMediaSuffix(type.name).toLowerCase() === name.toLowerCase()
        && typePackageIds.some((id) => packageIds.includes(id))
      );
    });

  if (existing) {
    return existing;
  }

  const next = { id: nextId(state.lessonTypes), name, coursePackageIds: packageIds };
  state.lessonTypes.push(next);
  persist();
  return next;
}

/**
 * 读取 actions 列表，并按业务规则过滤或排序。
 */
export function listActions(user = null, options = {}) {
  return sortByNewest(
    state.actions
      .map(normalizeActionRecord)
      .filter((action) => actionAllowsUser(action, user, options))
      .filter((action) => actionMatchesCoursePackageScope(action, options)),
    "updateTime"
  );
}

/**
 * 读取 action by id，并保持返回结构稳定。
 */
export function getActionById(actionId) {
  const action = state.actions.find((item) => item.id === Number(actionId)) ?? null;
  return action ? normalizeActionRecord(action) : null;
}

/**
 * 保存 action，并触发必要的归一化和持久化。
 */
export function saveAction(payload, user = null, options = {}) {
  const existing = payload.id ? getActionById(payload.id) : null;
  if (existing && !actionAllowsUser(existing, user, options)) {
    throw new Error("当前账号不能修改其它课程包下的动作。");
  }
  const next = normalizeActionPayload(prepareActionOwnerPayload(payload, existing, user, options), existing);
  const index = state.actions.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.actions[index] = next;
  } else {
    state.actions.push(next);
  }

  persist();
  return next;
}

/**
 * 删除 action，同时遵守课程和排课的保护规则。
 */
export function deleteAction(actionId, user = null, options = {}) {
  const numericId = Number(actionId);
  const existing = getActionById(numericId);
  if (!existing || !actionAllowsUser(existing, user, options)) {
    return { ok: false, message: "动作不存在。" };
  }
  const usedByCourse = state.courses.some(
    (course) => courseScriptUsesAction(coerceCourseScript(course), numericId)
  );

  if (usedByCourse) {
    return { ok: false, message: "动作已被课程引用，暂时不能删除。" };
  }

  state.actions = state.actions.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

/**
 * 读取 courses 列表，并按业务规则过滤或排序。
 */
export function listCourses(user = null, options = {}) {
  const allowedCourseIds = getUserVisibleCourseIdSet(user, options?.coursePackageId);
  return sortByNewest(state.courses, "updateTime")
    .filter((course) => !allowedCourseIds || allowedCourseIds.has(Number(course.id)))
    .map(serializeCourse);
}

/**
 * 读取 course summaries 列表，并按业务规则过滤或排序。
 */
export function listCourseSummaries(user = null, options = {}) {
  const allowedCourseIds = getUserVisibleCourseIdSet(user, options?.coursePackageId);
  return sortByNewest(state.courses, "updateTime")
    .filter((course) => !allowedCourseIds || allowedCourseIds.has(Number(course.id)))
    .map(serializeCourseSummary);
}

/**
 * 读取 course by id，并保持返回结构稳定。
 */
export function getCourseById(courseId) {
  const course = state.courses.find((item) => item.id === Number(courseId)) ?? null;
  return course ? serializeCourse(course) : null;
}

/**
 * 保存 course，并触发必要的归一化和持久化。
 */
export function saveCourse(payload, user = null, options = {}) {
  const existing = payload.id ? getCourseById(payload.id) : null;
  if (existing && !courseAllowsUser(existing, user, options)) {
    throw new Error("当前账号不能修改其它课程包下的课程。");
  }
  const targetCoursePackageId = resolveWriteCoursePackageId(
    user,
    payload?.coursePackageId,
    existing?.coursePackageId,
    options
  );
  const next = normalizeCoursePayload(prepareCourseOwnerPayload({ ...payload, coursePackageId: targetCoursePackageId }, existing, user), existing);
  const index = state.courses.findIndex((item) => item.id === next.id);
  const targetCoursePackage =
    targetCoursePackageId > 0
      ? state.coursePackages.find((item) => normalizeCoursePackageId(item.id, 0) === targetCoursePackageId)
      : null;

  if (targetCoursePackageId > 0 && !targetCoursePackage) {
    throw new Error("课程包不存在。");
  }

  const nextName = normalizeCourseIdentityText(next.name);
  const nextVersion = normalizeCourseIdentityText(next.version);
  const hasSameNameAndVersion = state.courses.some((course) => {
    if (Number(course.id) === Number(next.id)) return false;
    return (
      normalizeCourseIdentityText(course.name) === nextName &&
      normalizeCourseIdentityText(course.version) === nextVersion
    );
  });

  if (hasSameNameAndVersion) {
    throw new Error("课程已有相同版本。");
  }

  if (index >= 0) {
    state.courses[index] = next;
  } else {
    state.courses.push(next);
  }

  state.coursePackages = (state.coursePackages || []).map((coursePackage) => {
    const containsCourse = (coursePackage.courseIds || []).some((id) => Number(id) === Number(next.id));
    if (normalizeCoursePackageId(coursePackage.id, 0) === targetCoursePackageId) {
      return containsCourse
        ? coursePackage
        : {
            ...coursePackage,
            courseIds: [...(coursePackage.courseIds || []), Number(next.id)],
            updateTime: nowIso()
          };
    }

    if (!containsCourse) {
      return coursePackage;
    }
    return {
      ...coursePackage,
      courseIds: (coursePackage.courseIds || []).filter((id) => Number(id) !== Number(next.id)),
      updateTime: nowIso()
    };
  });

  if (targetCoursePackage) {
    const updatedTargetCoursePackage = state.coursePackages.find(
      (item) => normalizeCoursePackageId(item.id, 0) === targetCoursePackageId
    );
    const nextCourseIds = new Set((updatedTargetCoursePackage?.courseIds || []).map(Number));
    if (!nextCourseIds.has(Number(next.id))) {
      updatedTargetCoursePackage.courseIds = [...(updatedTargetCoursePackage.courseIds || []), Number(next.id)];
      updatedTargetCoursePackage.updateTime = nowIso();
    }
  }

  syncActionCourseTagsForCourse(next);
  persist();
  return next;
}

/**
 * 删除 course，同时遵守课程和排课的保护规则。
 */
export function deleteCourse(courseId, user = null, options = {}) {
  const numericId = Number(courseId);
  const existing = state.courses.find((item) => Number(item.id) === numericId) ?? null;

  if (!existing || !courseAllowsUser(existing, user, options)) {
    return { ok: false, message: "课程不存在。" };
  }

  const today = formatCalendarDate(new Date(), "Asia/Shanghai");
  const activeOrFutureSchedules = state.schedules.filter((item) => {
    if (Number(item.courseId) !== numericId) {
      return false;
    }
    const scheduleDate = item.beginTime ? formatCalendarDate(item.beginTime, "Asia/Shanghai") : "";
    return !scheduleDate || scheduleDate >= today;
  });

  if (activeOrFutureSchedules.length) {
    return { ok: false, message: "课程已排在今天或未来日期，暂时不能删除。" };
  }

  state.courses = state.courses.filter((item) => item.id !== numericId);
  state.coursePackages = (state.coursePackages || []).map((coursePackage) => ({
    ...coursePackage,
    courseIds: (coursePackage.courseIds || []).filter((id) => Number(id) !== numericId),
    updateTime: (coursePackage.courseIds || []).some((id) => Number(id) === numericId) ? nowIso() : coursePackage.updateTime
  }));
  persist();
  return { ok: true };
}

/**
 * 读取 templates 列表，并按业务规则过滤或排序。
 */
export function listTemplates(user = null, options = {}) {
  return {
    warmup: listTemplatesByKind("warmup", user, options),
    cooldown: listTemplatesByKind("cooldown", user, options),
    training: listTemplatesByKind("training", user, options),
    course: listTemplatesByKind("course", user, options)
  };
}

/**
 * 读取 template by id，并保持返回结构稳定。
 */
export function getTemplateById(templateId, user = null, options = {}) {
  const template = state.templates.find((item) => item.id === Number(templateId)) ?? null;
  if (!template || !templateAllowsUser(template, user, options)) {
    return null;
  }
  return template ? serializeTemplate(template) : null;
}

/**
 * 保存 template，并触发必要的归一化和持久化。
 */
export function saveTemplate(payload, user = null, options = {}) {
  const existing = payload.id ? getTemplateById(payload.id, user, options) : null;
  const next = normalizeTemplatePayload(payload, existing);
  const requestedPackageIds = normalizeTemplateCoursePackageIds(payload);

  if (requestedPackageIds.length) {
    assertCanSaveTemplate({ ...next, coursePackageIds: requestedPackageIds }, user, options);
  }
  next.coursePackageIds = resolveWriteCoursePackageIds(
    user,
    next.coursePackageIds,
    existing?.coursePackageIds,
    options
  );
  assertCanSaveTemplate(next, user, options);
  const index = state.templates.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.templates[index] = next;
  } else {
    state.templates.push(next);
  }

  persist();
  return serializeTemplate(next);
}

/**
 * 删除 template，同时遵守课程和排课的保护规则。
 */
export function deleteTemplate(templateId, user = null, options = {}) {
  const numericId = Number(templateId);
  const existing = state.templates.find((item) => item.id === numericId) ?? null;
  if (!existing || !templateAllowsUser(existing, user, options)) {
    return { ok: false, message: "模板不存在。" };
  }
  state.templates = state.templates.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

/**
 * 读取 course options 列表，并按业务规则过滤或排序。
 */
export function listCourseOptions(coursePackageId = "", user = null) {
  const packageCourseIds = getCoursePackageCourseIdSet(coursePackageId);
  const userCourseIds = getUserVisibleCourseIdSet(user, coursePackageId);
  return sortByNewest(state.courses, "updateTime")
    .filter((course) => !packageCourseIds || packageCourseIds.has(Number(course.id)))
    .filter((course) => !userCourseIds || userCourseIds.has(Number(course.id)))
    .map((course) => {
    const serialized = serializeCourse(course);
    return {
      id: serialized.id,
      name: serialized.name,
      version: serialized.version,
      creator: serialized.creator
    };
  });
}
