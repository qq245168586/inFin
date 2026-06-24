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
  getVenueByAccountNamespace,
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
  isSuperAdminUser,
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
import {
  listActionTypes,
  listLessonTypes,
  listActions,
  listCourses,
  listCourseSummaries,
  listTemplates
} from "./content-store.js";
import { listSchedulesByScope } from "./schedule-store.js";

/**
 * 读取 meta payload，并保持返回结构稳定。
 */
export function getMetaPayload(user = null, options = {}) {
  const includeFullCourses = options?.includeFullCourses === true;
  const coursePackageId = normalizeCoursePackageId(options?.coursePackageId || 0, 0);
  const scopeOptions = coursePackageId > 0 ? { coursePackageId } : {};

  return {
    actionTypes: listActionTypes(user, scopeOptions),
    lessonTypes: listLessonTypes(user, scopeOptions),
    coursePackages: listCoursePackagesForUser(user),
    actions: listActions(user, scopeOptions),
    courses: includeFullCourses ? listCourses(user) : listCourseSummaries(user),
    coursesMode: includeFullCourses ? "full" : "summary",
    templates: listTemplates(user),
    schedules: {
      currentWeek: listSchedulesByScope("CURRENTWEEK", { user, ...scopeOptions }),
      lastWeek: listSchedulesByScope("LASTWEEK", { user, ...scopeOptions }),
      history: listSchedulesByScope("HISTORY", { user, ...scopeOptions })
    }
  };
}

/**
 * 读取 users 列表，并按业务规则过滤或排序。
 */
export function listUsers() {
  return clone(state.users).map(publicUserInfo);
}

/**
 * 读取 user by username，并保持返回结构稳定。
 */
export function getUserByUsername(username) {
  return state.users.find((item) => item.username === trimText(username)) ?? null;
}

/**
 * 创建 console user，并补齐运行时需要的默认配置。
 */
export function createConsoleUser(payload = {}) {
  const username = trimText(payload.username);
  const password = trimText(payload.password);

  if (!username) {
    throw new Error("手机号不能为空。");
  }

  if (!password) {
    throw new Error("密码不能为空。");
  }

  if (getUserByUsername(username)) {
    throw new Error("该手机号已存在。");
  }

  const nextUser = {
    id: nextId(state.users),
    username,
    nickname: trimText(payload.nickname) || username,
    avatar: trimText(payload.avatar),
    gender: trimText(payload.gender) || "MALE",
    userType: "CONSOLE",
    passwordDigest: normalizePassword(password),
    passwordPlain: trimText(payload.role) === "superadmin" || SUPERADMIN_USERNAMES.has(username) ? "" : password,
    accountNamespace: normalizeAccountNamespace(payload.accountNamespace || username),
    environmentLabel:
      trimText(payload.environmentLabel)
      || environmentLabelForNamespace(payload.accountNamespace || username),
    role: trimText(payload.role) || (SUPERADMIN_USERNAMES.has(username) ? "superadmin" : "venue"),
    venueId: trimText(payload.venueId) || "",
    coursePackageIds: numberList(payload.coursePackageIds),
    allowedClients:
      payload.allowedClients
      ? normalizeAllowedClients(payload.allowedClients)
      : SUPERADMIN_USERNAMES.has(username) || trimText(payload.role) === "superadmin"
        ? ["coach-web", "editor-web"]
        : ["coach-web"],
    createTime: nowIso(),
    lastLoginTime: null
  };

  state.users.push(nextUser);
  persist();
  return publicUserInfo(nextUser);
}

/**
 * 封装 upsert console user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function upsertConsoleUser(payload = {}) {
  const username = trimText(payload.username);

  if (!username) {
    throw new Error("手机号不能为空。");
  }

  const existing = getUserByUsername(username);

  if (!existing) {
    return createConsoleUser(payload);
  }

  existing.nickname = trimText(payload.nickname) || existing.nickname || username;
  existing.avatar = trimText(payload.avatar) || existing.avatar || "";
  existing.gender = trimText(payload.gender) || existing.gender || "MALE";
  existing.userType = "CONSOLE";
  existing.accountNamespace = normalizeAccountNamespace(payload.accountNamespace || existing.accountNamespace || username);
  existing.environmentLabel =
    trimText(payload.environmentLabel)
    || trimText(existing.environmentLabel)
    || environmentLabelForNamespace(existing.accountNamespace || username);
  existing.role = trimText(payload.role) || trimText(existing.role) || (SUPERADMIN_USERNAMES.has(username) ? "superadmin" : "venue");
  existing.venueId = trimText(payload.venueId) || trimText(existing.venueId) || "";
  existing.allowedClients = normalizeAllowedClients(payload.allowedClients || existing.allowedClients);

  if (payload.password) {
    existing.passwordDigest = normalizePassword(payload.password);
    if (!isSuperAdminUser(existing)) {
      existing.passwordPlain = trimText(payload.password);
    }
  }
  persist();
  return publicUserInfo(existing);
}

/**
 * 读取 venues 列表，并按业务规则过滤或排序。
 */
export function listVenues() {
  return clone(state.venues || []).sort((left, right) => {
    const leftTime = new Date(left.updateTime || left.createTime || 0).getTime();
    const rightTime = new Date(right.updateTime || right.createTime || 0).getTime();
    return rightTime - leftTime;
  });
}

/**
 * 创建 venue，并补齐运行时需要的默认配置。
 */
export function createVenue(payload = {}) {
  const name = trimText(payload.name);
  let accountNamespace = normalizeVenueAccountNamespace(payload.accountNamespace || payload.namespace || payload.ns || "");

  if (!name) {
    throw new Error("场馆名称不能为空。");
  }

  if (!accountNamespace) {
    // Deterministic namespace: stable for same venue name, with collision suffix.
    const base = `venue-${md5Text(name).slice(0, 8)}`;
    accountNamespace = base;
    let suffix = 2;
    while (getVenueByAccountNamespace(accountNamespace)) {
      accountNamespace = `${base}-${suffix}`;
      suffix += 1;
    }
  }
  if (getVenueByAccountNamespace(accountNamespace)) {
    throw new Error("场馆命名空间已存在。");
  }

  const now = nowIso();
  const defaultPackageId = getDefaultCoursePackageId();
  const next = {
    id: String(nextId(state.venues || [])),
    name,
    accountNamespace,
    coursePackageIds: [defaultPackageId],
    activeCoursePackageId: defaultPackageId,
    themeConfig: payload.themeConfig && typeof payload.themeConfig === "object" ? payload.themeConfig : {},
    createTime: now,
    updateTime: now
  };
  state.venues = state.venues || [];
  state.venues.push(next);
  persist();
  return next;
}

/**
 * 更新 venue，只改变调用方明确提交的字段。
 */
export function updateVenue(venueId, payload = {}) {
  const existing = getVenueById(venueId);

  if (!existing) {
    return null;
  }
  const nextName = trimText(payload.name) || existing.name;
  const nextNs = payload.accountNamespace ? normalizeAccountNamespace(payload.accountNamespace) : existing.accountNamespace;
  if (nextNs !== normalizeAccountNamespace(existing.accountNamespace)) {
    if (getVenueByAccountNamespace(nextNs)) {
      throw new Error("场馆命名空间已存在。");
    }
  }
  existing.name = nextName;
  existing.accountNamespace = nextNs;

  if (payload.themeConfig && typeof payload.themeConfig === "object") {
    existing.themeConfig = payload.themeConfig;
  }

  if (payload.coursePackageIds) {
    existing.coursePackageIds = normalizeVenuePackageIds(payload.coursePackageIds);
    if (!existing.coursePackageIds.includes(normalizeCoursePackageId(existing.activeCoursePackageId))) {
      existing.activeCoursePackageId = existing.coursePackageIds[0] || getDefaultCoursePackageId();
    }
  }
  existing.updateTime = nowIso();
  persist();
  return existing;
}

/**
 * 删除 venue，同时遵守课程和排课的保护规则。
 */
export function deleteVenue(venueId) {
  const id = trimText(venueId);
  const existing = getVenueById(id);

  if (!existing) {
    return { ok: false, message: "场馆不存在。" };
  }

  // Deleting a venue should be operationally simple: detach accounts/devices
  // so the operator can recreate from scratch.
  const venueNs = normalizeAccountNamespace(existing.accountNamespace);
  const venueIdValue = trimText(existing.id);
  state.users = (state.users || []).map((user) => {
    if (trimText(user.venueId) !== venueIdValue) return user;
    if (isSuperAdminUser(user)) return { ...user, venueId: "" };
    return {
      ...user,
      venueId: "",
      accountNamespace: "",
      environmentLabel: ""
    };
  });

  state.tvScreens = (state.tvScreens || []).filter(
    (screen) => normalizeScreenAccountNamespace(screen.accountNamespace) !== venueNs
  );

  // Scheduling is global (not per-venue). Keep schedules even if a venue is removed.
  state.venues = (state.venues || []).filter((item) => trimText(item.id) !== id);
  persist();
  return { ok: true };
}

/**
 * 读取 venue users 列表，并按业务规则过滤或排序。
 */
export function listVenueUsers(venueId) {
  const id = trimText(venueId);
  return clone(state.users || [])
    .filter((user) => trimText(user.venueId) === id)
    .map(publicUserInfo)
    .sort((left, right) => left.username.localeCompare(right.username));
}

/**
 * 创建 venue user，并补齐运行时需要的默认配置。
 */
export function createVenueUser(venueId, payload = {}) {
  const venue = getVenueById(venueId);

  if (!venue) {
    throw new Error("场馆不存在。");
  }
  const username = trimText(payload.username);
  const password = trimText(payload.password);

  if (!username) {
    throw new Error("账号不能为空。");
  }

  if (!password) {
    throw new Error("密码不能为空。");
  }
  return createConsoleUser({
    username,
    password,
    nickname: trimText(payload.nickname) || username,
    accountNamespace: normalizeAccountNamespace(venue.accountNamespace),
    environmentLabel: trimText(payload.environmentLabel) || trimText(venue.name),
    role: "venue",
    venueId: trimText(venue.id),
    allowedClients: ["coach-web"]
  });
}

/**
 * 更新 user，只改变调用方明确提交的字段。
 */
export function updateUser(userId, payload = {}) {
  const id = Number(userId);
  const existing = (state.users || []).find((user) => Number(user.id) === id) ?? null;

  if (!existing) {
    return null;
  }

  if (payload.password) {
    existing.passwordDigest = normalizePassword(payload.password);
    if (!isSuperAdminUser(existing)) {
      existing.passwordPlain = trimText(payload.password);
    }
  }

  if (payload.nickname != null) {
    existing.nickname = trimText(payload.nickname) || existing.nickname || existing.username;
  }

  if (payload.allowedClients) {
    existing.allowedClients = normalizeAllowedClients(payload.allowedClients);
  }

  if (payload.venueId != null) {
    existing.venueId = trimText(payload.venueId);
  }

  if (payload.role != null) {
    existing.role = trimText(payload.role);
  }
  persist();
  return publicUserInfo(existing);
}

/**
 * 读取 admin console users 列表，并按业务规则过滤或排序。
 */
export function listAdminConsoleUsers(query = "") {
  const q = trimText(query);
  const users = clone(state.users || [])
    .filter((user) => trimText(user.userType) === "CONSOLE")
    .map(publicUserInfo);
  return users
    .filter((user) => (q ? String(user.username || "").includes(q) : true))
    .sort((left, right) => String(left.username).localeCompare(String(right.username)));
}

/**
 * 绑定 user to venue，同步相关账户、场馆或屏幕状态。
 */
export function bindUserToVenue(userId, venueId) {
  const id = Number(userId);
  const venue = getVenueById(venueId);

  if (!venue) {
    throw new Error("场馆不存在。");
  }
  const existing = (state.users || []).find((user) => Number(user.id) === id) ?? null;

  if (!existing) {
    throw new Error("账号不存在。");
  }
  if (isSuperAdminUser(existing)) {
    throw new Error("管理员账号不能绑定为场馆账号。");
  }
  const currentVenueId = trimText(existing.venueId);
  if (currentVenueId && currentVenueId !== trimText(venue.id)) {
    throw new Error("该账号已绑定其他场馆，请先解绑。");
  }
  existing.role = "venue";
  existing.venueId = trimText(venue.id);
  existing.accountNamespace = normalizeAccountNamespace(venue.accountNamespace, "");
  existing.environmentLabel = trimText(venue.name) || trimText(existing.environmentLabel) || "";
  existing.allowedClients = ["coach-web"];
  persist();
  return publicUserInfo(existing);
}

/**
 * 解绑 user from venue，保留后续恢复和排查需要的历史信息。
 */
export function unbindUserFromVenue(userId) {
  const id = Number(userId);
  const existing = (state.users || []).find((user) => Number(user.id) === id) ?? null;

  if (!existing) {
    throw new Error("账号不存在。");
  }
  if (isSuperAdminUser(existing)) {
    throw new Error("管理员账号无需解绑。");
  }
  existing.venueId = "";
  existing.accountNamespace = "";
  existing.environmentLabel = "";
  existing.allowedClients = ["coach-web"];
  existing.coursePackageIds = [];
  persist();
  return publicUserInfo(existing);
}

/**
 * 封装 login console user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function loginConsoleUser(username, password, clientName = "editor-web") {
  cleanupExpiredSessions();
  const normalizedUsername = trimText(username);
  const normalizedPassword = trimText(password);

  if (!normalizedUsername || !normalizedPassword) {
    return null;
  }

  const user = getUserByUsername(normalizedUsername);

  if (!user) {
    return null;
  }

  if (user.passwordDigest !== normalizePassword(normalizedPassword)) {
    return null;
  }

  if (!userAllowsClient(user, clientName)) {
    return { error: "CLIENT_NOT_ALLOWED" };
  }

  // Venue accounts must be bound to a venue before login, otherwise they'd
  // accidentally fall back to the default namespace.
  if (trimText(user.role) === "venue" && !trimText(user.venueId)) {
    return { error: "VENUE_NOT_BOUND" };
  }

  user.lastLoginTime = nowIso();
  const tokenPayload = createAuthPayload(user.id, clientName);
  persist();

  return {
    user: publicUserInfo(user),
    token: tokenPayload
  };
}

/**
 * 封装 refresh console user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function refreshConsoleUser(refreshToken, clientName = "editor-web") {
  cleanupExpiredSessions();
  const session = state.authSessions.find((item) => item.refreshToken === trimText(refreshToken));
  if (!session || !isFutureTime(session.refreshExpiresAt)) {
    return null;
  }

  const user = state.users.find((item) => item.id === session.userId);
  if (!user || !userAllowsClient(user, clientName)) {
    return { error: "CLIENT_NOT_ALLOWED" };
  }

  if (normalizeClientName(session.client || clientName) !== normalizeClientName(clientName)) {
    return { error: "CLIENT_NOT_ALLOWED" };
  }

  return createAuthPayload(session.userId, clientName);
}

/**
 * 读取 user by access token，并保持返回结构稳定。
 */
export function getUserByAccessToken(accessToken) {
  cleanupExpiredSessions();
  const session = state.authSessions.find((item) => item.accessToken === trimText(accessToken));
  if (!session || !isFutureTime(session.expiresAt)) {
    return null;
  }

  const user = state.users.find((item) => item.id === session.userId);
  return user ? publicUserInfo(user) : null;
}

/**
 * 读取 course packages 列表，并按业务规则过滤或排序。
 */
export function listCoursePackages() {
  return sortByNewest(state.coursePackages || [], "updateTime").map(serializeCoursePackage);
}

/**
 * 读取 course package by id，并保持返回结构稳定。
 */
export function getCoursePackageById(coursePackageId) {
  const record = getCoursePackageByIdInternal(coursePackageId);
  return record ? serializeCoursePackage(record) : null;
}

/**
 * 保存 course package，并触发必要的归一化和持久化。
 */
export function saveCoursePackage(payload = {}) {
  const existing = payload.id ? getCoursePackageByIdInternal(payload.id) : null;
  const { courseIds: _ignoredCourseIds, ...safePayload } = payload || {};
  const now = nowIso();
  const next = normalizeCoursePackageRecord({
    ...(existing || {}),
    ...safePayload,
    courseIds: existing?.courseIds || [],
    id: existing?.id || nextId(state.coursePackages || []),
    updateTime: now,
    createTime: existing?.createTime || now
  });

  if (!next.name) {
    throw new Error("课程包名称不能为空。");
  }

  state.coursePackages = state.coursePackages || [];
  const index = state.coursePackages.findIndex((item) => normalizeCoursePackageId(item.id) === next.id);

  if (index >= 0) {
    state.coursePackages[index] = next;
  } else {
    state.coursePackages.push(next);
  }
  persist();
  return serializeCoursePackage(next);
}

/**
 * 删除 course package，同时遵守课程和排课的保护规则。
 */
export function deleteCoursePackage(coursePackageId) {
  const existing = getCoursePackageByIdInternal(coursePackageId);

  if (!existing) {
    return { ok: false, message: "课程包不存在。" };
  }

  if (existing.isDefault) {
    return { ok: false, message: "默认课程包不能删除。" };
  }
  const id = normalizeCoursePackageId(existing.id);
  if ((state.venues || []).some((venue) => numberList(venue.coursePackageIds).includes(id))) {
    return { ok: false, message: "课程包已绑定场馆，不能删除。" };
  }
  if ((state.schedules || []).some((schedule) => normalizeCoursePackageId(schedule.coursePackageId) === id)) {
    return { ok: false, message: "课程包已有排课，不能删除。" };
  }
  state.coursePackages = (state.coursePackages || []).filter((item) => normalizeCoursePackageId(item.id) !== id);
  persist();
  return { ok: true };
}

/**
 * 读取 venue course packages 列表，并按业务规则过滤或排序。
 */
export function listVenueCoursePackages(venueId) {
  const venue = getVenueById(venueId);

  if (!venue) {
    return null;
  }
  const boundIds = normalizeVenuePackageIds(venue.coursePackageIds);
  const activeCoursePackageId = resolveVenueActiveCoursePackageId(venue);
  const packages = boundIds
    .map((id) => getCoursePackageByIdInternal(id))
    .filter(Boolean)
    .map(serializeCoursePackage);
  return {
    venueId: trimText(venue.id),
    venueName: trimText(venue.name),
    accountNamespace: normalizeAccountNamespace(venue.accountNamespace),
    venue: {
      id: trimText(venue.id),
      name: trimText(venue.name),
      accountNamespace: normalizeAccountNamespace(venue.accountNamespace),
      activeCoursePackageId
    },
    activeCoursePackageId,
    running: isVenuePlaybackActive(venue),
    items: packages,
    packages
  };
}

/**
 * 绑定 course package to venue，同步相关账户、场馆或屏幕状态。
 */
export function bindCoursePackageToVenue(venueId, coursePackageId) {
  const venue = getVenueById(venueId);
  const pkg = getCoursePackageByIdInternal(coursePackageId);

  if (!venue) {
    throw new Error("场馆不存在。");
  }

  if (!pkg) {
    throw new Error("课程包不存在。");
  }
  if (isVenuePlaybackActive(venue)) {
    throw new Error("场馆正在上课，不能调整课程包。");
  }
  const ids = normalizeVenuePackageIds(venue.coursePackageIds);
  const pkgId = normalizeCoursePackageId(pkg.id);
  if (!ids.includes(pkgId)) {
    ids.push(pkgId);
  }
  venue.coursePackageIds = ids;
  const activeId = normalizeCoursePackageId(venue.activeCoursePackageId, 0);
  venue.activeCoursePackageId = ids.includes(activeId) ? activeId : ids[0];
  venue.updateTime = nowIso();
  persist();
  return listVenueCoursePackages(venue.id);
}

/**
 * 解绑 course package from venue，保留后续恢复和排查需要的历史信息。
 */
export function unbindCoursePackageFromVenue(venueId, coursePackageId) {
  const venue = getVenueById(venueId);

  if (!venue) {
    throw new Error("场馆不存在。");
  }
  if (isVenuePlaybackActive(venue)) {
    throw new Error("场馆正在上课，不能调整课程包。");
  }
  const pkgId = normalizeCoursePackageId(coursePackageId);
  const ids = normalizeVenuePackageIds(venue.coursePackageIds).filter((id) => id !== pkgId);

  if (!ids.length) {
    throw new Error("场馆至少需要绑定一个课程包。");
  }
  if (normalizeCoursePackageId(venue.activeCoursePackageId) === pkgId) {
    venue.activeCoursePackageId = ids[0];
  } else if (!ids.includes(normalizeCoursePackageId(venue.activeCoursePackageId, 0))) {
    venue.activeCoursePackageId = ids[0];
  }
  venue.coursePackageIds = ids;
  venue.updateTime = nowIso();
  persist();
  return listVenueCoursePackages(venue.id);
}

/**
 * 封装 set venue active course package 的业务步骤，避免调用方依赖内部实现细节。
 */
export function setVenueActiveCoursePackage(venueId, coursePackageId) {
  const venue = getVenueById(venueId);

  if (!venue) {
    throw new Error("场馆不存在。");
  }
  if (isVenuePlaybackActive(venue)) {
    throw new Error("场馆正在上课，不能切换课程包。");
  }
  const pkgId = normalizeCoursePackageId(coursePackageId);
  const ids = normalizeVenuePackageIds(venue.coursePackageIds);
  if (!ids.includes(pkgId)) {
    throw new Error("该课程包未绑定到当前场馆。");
  }
  venue.activeCoursePackageId = pkgId;
  venue.updateTime = nowIso();
  persist();
  return listVenueCoursePackages(venue.id);
}

/**
 * 封装 set user course packages 的业务步骤，避免调用方依赖内部实现细节。
 */
export function setUserCoursePackages(userId, coursePackageIds = []) {
  const id = Number(userId);
  const existing = (state.users || []).find((user) => Number(user.id) === id) || null;

  if (!existing) {
    throw new Error("账号不存在。");
  }
  existing.coursePackageIds = isSuperAdminUser(existing) ? [] : normalizeUserPackageIds(coursePackageIds);
  persist();
  return publicUserInfo(existing);
}
