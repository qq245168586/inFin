// @ts-nocheck
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloneCourseScript,
  createTrainingPanel,
  courseScriptUsesAction,
  legacyCourseToScript,
  normalizeCoursePlan,
  summarizeCourseScript,
  validateCourseScript
} from "../../../../packages/shared/src/course-script.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyStorageRoot = path.resolve(__dirname, "../../storage");
let storageRoot = "";
let mediaRoot = "";
let appPackageRoot = "";
let backupRoot = "";
let dbFile = "";
const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 15 * 24 * 60 * 60;
const TV_SCREEN_COUNT = 5;
const TV_ONLINE_THRESHOLD_MS = 35 * 1000;
const DB_BACKUP_RETENTION = 120;
const PLAYBACK_PREVIEW_TTL_MS = 10 * 60 * 1000;
const PLAYBACK_TERMINAL_CURRENT_TTL_MS = 15 * 60 * 1000;
const PLAYBACK_ACTIVE_STATES = new Set(["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED"]);
const PLAYBACK_TERMINAL_STATES = new Set(["ENDED", "TERMINATED"]);
const PLAYBACK_WARMUP_READY_SECONDS = 15;
const PLAYBACK_TRAINING_READY_SECONDS = 15;
const PLAYBACK_COOLDOWN_READY_SECONDS = 10;
const DEFAULT_ACCOUNT_NAMESPACE = "13689547720";
const DEFAULT_COURSE_PACKAGE_NAME = "默认课程包";
const SUPERADMIN_USERNAMES = new Set(["13689547720", "zhiyou"]);
const CONSOLE_ACCOUNT_PRESETS = [
  {
    username: "13689547720",
    password: "REDACTED_CONFIGURE_LOCALLY",
    nickname: "13689547720",
    accountNamespace: "13689547720",
    environmentLabel: "13689547720",
    allowedClients: ["coach-web", "editor-web"],
    role: "superadmin"
  },
  {
    username: "zhiyou",
    password: "REDACTED_CONFIGURE_LOCALLY",
    nickname: "zhiyou",
    accountNamespace: "zhiyou",
    environmentLabel: "zhiyou",
    allowedClients: ["coach-web", "editor-web"],
    role: "superadmin"
  }
];

function isLegacyEnvironmentLabel(label = "") {
  const normalized = trimText(label);
  return normalized === "正式环境" || normalized === "测试环境" || normalized === "自定义环境";
}

const defaultState = createDefaultState();
let normalizeLoadedStateDidChange = false;
let state = null;

export function reloadLegacyStoreState() {
  configureStorageRoot();
  state = loadState();
  ensureConsoleAccountSeeds();
  syncCourseStationRules();
  syncAllActionCourseTagsFromCourses();
  return state;
}

reloadLegacyStoreState();

function configureStorageRoot() {
  storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || legacyStorageRoot);
  mediaRoot = path.join(storageRoot, "media");
  appPackageRoot = path.join(storageRoot, "app-packages");
  backupRoot = path.join(storageRoot, "backups");
  dbFile = path.join(storageRoot, "db.json");
  ensureDir(storageRoot);
  ensureDir(mediaRoot);
  ensureDir(appPackageRoot);
  ensureDir(backupRoot);
  migrateLegacyStorageIfNeeded();
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function migrateLegacyStorageIfNeeded() {
  if (storageRoot === legacyStorageRoot) {
    return;
  }

  const legacyDbFile = path.join(legacyStorageRoot, "db.json");
  const legacyMediaRoot = path.join(legacyStorageRoot, "media");
  const legacyBackupRoot = path.join(legacyStorageRoot, "backups");

  if (!fs.existsSync(dbFile) && fs.existsSync(legacyDbFile)) {
    fs.copyFileSync(legacyDbFile, dbFile);
  }

  if (!fs.existsSync(mediaRoot) || fs.readdirSync(mediaRoot).length === 0) {
    copyDirectoryRecursive(legacyMediaRoot, mediaRoot);
  }

  if (!fs.existsSync(backupRoot) || fs.readdirSync(backupRoot).length === 0) {
    copyDirectoryRecursive(legacyBackupRoot, backupRoot);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByNewest(list, field = "updateTime") {
  return [...list].sort((left, right) => {
    const leftValue = new Date(left[field] || left.createTime || 0).getTime();
    const rightValue = new Date(right[field] || right.createTime || 0).getTime();
    return rightValue - leftValue;
  });
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function nowIso() {
  return new Date().toISOString();
}

function formatBackupStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${padNumber(date.getUTCMonth() + 1)}${padNumber(date.getUTCDate())}-${padNumber(
    date.getUTCHours()
  )}${padNumber(date.getUTCMinutes())}${padNumber(date.getUTCSeconds())}-${String(date.getUTCMilliseconds()).padStart(
    3,
    "0"
  )}`;
}

function readTextIfExists(targetFile) {
  if (!fs.existsSync(targetFile)) {
    return "";
  }

  return fs.readFileSync(targetFile, "utf8");
}

function writeTextAtomic(targetFile, text) {
  ensureDir(path.dirname(targetFile));
  const tempFile = `${targetFile}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, text, "utf8");
  fs.renameSync(tempFile, targetFile);
}

function listBackupFiles() {
  if (!fs.existsSync(backupRoot)) {
    return [];
  }

  return fs
    .readdirSync(backupRoot)
    .filter((name) => /^db\.[a-z-]+\.\d{8}-\d{6}-\d{3}\.json$/i.test(name))
    .map((name) => path.join(backupRoot, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

function pruneBackupFiles() {
  const backups = listBackupFiles();
  for (const staleFile of backups.slice(DB_BACKUP_RETENTION)) {
    fs.rmSync(staleFile, { force: true });
  }
}

function createDatabaseBackup(rawText, reason = "autosave") {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) {
    return;
  }

  const backupFile = path.join(backupRoot, `db.${reason}.${formatBackupStamp()}.json`);
  writeTextAtomic(backupFile, rawText);
  pruneBackupFiles();
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function createStoredName(originalName = "asset.bin") {
  const safe = String(originalName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const hasExtension = safe.includes(".");
  const fallback = hasExtension ? safe : `${safe || "asset"}.bin`;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fallback}`;
}

export function createMediaFilename(originalName = "asset.bin") {
  return createStoredName(originalName);
}

function createAppPackageStoredName(platform = "tv", version = "", originalName = "app.apk") {
  const safePlatform = normalizeAppPlatform(platform);
  const safeVersion = sanitizeSegment(version || "build");
  const extension = path.extname(String(originalName || "")).toLowerCase() || ".apk";
  return `${safePlatform}-${safeVersion}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
}

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "package";
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeReadyDurations(overrides = {}) {
  return {
    warmupSeconds: safeNumber(overrides?.warmupSeconds, 15),
    workoutSeconds: safeNumber(overrides?.workoutSeconds, 15),
    cooldownSeconds: safeNumber(overrides?.cooldownSeconds, 10)
  };
}

function numberList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripMediaSuffix(value) {
  let next = trimText(value);
  const mediaExtensionPattern = /\.(mp4|mov|m4v|webm|avi|mkv|mpeg|mpg|wmv)$/i;
  while (mediaExtensionPattern.test(next)) {
    next = next.replace(mediaExtensionPattern, "").trim();
  }
  return next;
}

function normalizeAccountNamespace(value, fallback = DEFAULT_ACCOUNT_NAMESPACE) {

  const text = trimText(value).toLowerCase();
  return text || fallback;
}

function normalizeScreenAccountNamespace(value) {
  return trimText(value).toLowerCase();
}

function normalizeVenueAccountNamespace(value) {
  return trimText(value).toLowerCase();
}

function normalizeVenueId(value) {
  return trimText(value);
}

function normalizeCoursePackageId(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeCoursePackageRecord(entry = {}, fallbackCourseIds = []) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const now = nowIso();
  return {
    id: normalizeCoursePackageId(raw.id),
    name: trimText(raw.name) || DEFAULT_COURSE_PACKAGE_NAME,
    description: trimText(raw.description),
    courseIds: numberList(raw.courseIds ?? fallbackCourseIds),
    isDefault: Boolean(raw.isDefault),
    createTime: trimText(raw.createTime) || now,
    updateTime: trimText(raw.updateTime) || trimText(raw.createTime) || now
  };
}

function normalizeScheduleEntry(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  return {
    id: Number(raw.id) || 0,
    courseId: Number(raw.courseId) || 0,
    coursePackageId: normalizeCoursePackageId(raw.coursePackageId),
    courseName: trimText(raw.courseName),
    version: trimText(raw.version),
    beginTime: trimText(raw.beginTime),
    duration: Number(raw.duration) || 0
  };
}

function normalizeCourseTag(value) {
  return stripMediaSuffix(value).toLowerCase().replace(/\s+/g, "-");
}

function normalizeCourseTags(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,/]+/)
      : [];
  return [...new Set(source.map(normalizeCourseTag).filter(Boolean))];
}

function normalizeActionRecord(action = {}) {
  const raw = action && typeof action === "object" ? action : {};
  const ownerUsername = trimText(raw.ownerUsername || raw.author);
  return {
    ...raw,
    id: Number(raw.id) || 0,
    name: trimText(raw.name),
    description: trimText(raw.description),
    typeIds: numberList(raw.typeIds),
    media: raw.media ?? null,
    courseTags: normalizeCourseTags(raw.courseTags),
    coursePackageIds: numberList(raw.coursePackageIds),
    author: trimText(raw.author) || ownerUsername,
    ownerUsername,
    createTime: trimText(raw.createTime),
    updateTime: trimText(raw.updateTime)
  };
}

function normalizeActionTypeRecord(type = {}) {
  const raw = type && typeof type === "object" ? type : {};
  return {
    ...raw,
    id: Number(raw.id) || 0,
    name: stripMediaSuffix(raw.name),
    coursePackageIds: numberList(raw.coursePackageIds)
  };
}

function normalizeClientName(value, fallback = "editor-web") {
  const text = trimText(value).toLowerCase();
  if (text === "coach-web") {
    return "coach-web";
  }
  return fallback === "coach-web" ? "coach-web" : "editor-web";
}

function normalizeAllowedClients(value, fallback = ["coach-web", "editor-web"]) {
  const candidates = Array.isArray(value) ? value : fallback;
  const normalized = [...new Set(candidates.map((item) => normalizeClientName(item)).filter(Boolean))];
  return normalized.length ? normalized : [...fallback];
}

function userAllowsClient(user, clientName = "editor-web") {
  const allowedClients = normalizeAllowedClients(user?.allowedClients);
  return allowedClients.includes(normalizeClientName(clientName));
}

function environmentLabelForNamespace(accountNamespace = DEFAULT_ACCOUNT_NAMESPACE) {
  const normalized = normalizeAccountNamespace(accountNamespace);
  const matched = CONSOLE_ACCOUNT_PRESETS.find((item) => item.accountNamespace === normalized);
  return trimText(matched?.environmentLabel) || normalized || DEFAULT_ACCOUNT_NAMESPACE;
}

function normalizeAppPlatform(value, fallback = "tv") {
  const text = trimText(value).toLowerCase();
  if (text === "coach") {
    return "coach";
  }
  if (text === "tv") {
    return "tv";
  }
  return fallback === "coach" ? "coach" : "tv";
}

function inferAppPlatformFromFilename(filename = "") {
  const lower = String(filename || "").toLowerCase();
  if (lower.includes("coach")) {
    return "coach";
  }
  return "tv";
}

function inferAppVersionFromFilename(filename = "") {
  const baseName = path.basename(String(filename || ""), path.extname(String(filename || "")));
  const matched = baseName.match(/(?:^|[^0-9])v?(\d+(?:\.\d+){1,4}(?:[-_][a-z0-9.]+)?)/i);
  if (matched?.[1]) {
    return matched[1].replace(/_/g, "-");
  }
  return baseName || "未命名版本";
}

function buildAppPackageDownloadPath(filename = "") {
  return `/api/app-packages/files/${encodeURIComponent(filename)}`;
}

function calculateFileChecksum(targetFile) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(targetFile));
  return hash.digest("hex");
}

function md5Text(value) {
  return createHash("md5").update(String(value)).digest("hex");
}

function isMd5Digest(value) {
  return /^[a-f0-9]{32}$/i.test(trimText(value));
}

function normalizePassword(value) {
  const text = trimText(value);
  return isMd5Digest(text) ? text.toLowerCase() : md5Text(text);
}

function randomToken() {
  return randomBytes(24).toString("base64url");
}

function secondsFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isFutureTime(value) {
  return new Date(value || 0).getTime() > Date.now();
}

function startOfWeek(date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + delta);
  return current;
}

function endOfWeek(date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 7);
  return end;
}

function withTime(base, dayOffset, hour, minute) {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(hour, minute, 0, 0);
  return `${next.getFullYear()}-${padNumber(next.getMonth() + 1)}-${padNumber(next.getDate())}T${padNumber(
    next.getHours()
  )}:${padNumber(next.getMinutes())}:00+08:00`;
}

function createDefaultState() {
  const actionTypes = [
    { id: 1, name: "12ROUNDS" },
    { id: 2, name: "1HYROX" },
    { id: 3, name: "1HYROX WR" },
    { id: 4, name: "拳击" },
    { id: 5, name: "耐力" }
  ];

  const lessonTypes = [
    { id: 1, name: "12ROUNDS" },
    { id: 2, name: "HYROX" },
    { id: 3, name: "拳击" },
    { id: 4, name: "力量" }
  ];

  const createdAt = nowIso();
  const actions = [
    {
      id: 1,
      name: "Extreme Mountain Climber",
      typeIds: [2, 5],
      media: null,
      createTime: createdAt,
      updateTime: createdAt
    },
    {
      id: 2,
      name: "Push Up",
      typeIds: [2, 5],
      media: null,
      createTime: createdAt,
      updateTime: createdAt
    },
    {
      id: 3,
      name: "Ski Erg Sprint",
      typeIds: [2],
      media: null,
      createTime: createdAt,
      updateTime: createdAt
    },
    {
      id: 4,
      name: "Punch Combo",
      typeIds: [4],
      media: null,
      createTime: createdAt,
      updateTime: createdAt
    },
    {
      id: 5,
      name: "Burpee Broad Jump",
      typeIds: [2, 5],
      media: null,
      createTime: createdAt,
      updateTime: createdAt
    }
  ];

  const courses = [];
  const templates = [];
  const schedules = [];

  return {
    media: [],
    appPackages: [],
    coursePackages: [
      normalizeCoursePackageRecord({
        id: 1,
        name: DEFAULT_COURSE_PACKAGE_NAME,
        description: "新建场馆默认绑定的课程包。",
        courseIds: [],
        isDefault: true,
        createTime: createdAt,
        updateTime: createdAt
      })
    ],
    actionTypes,
    lessonTypes,
    actions,
    courses,
    templates,
    schedules,
    tvScreens: [],
    playbackSessions: [],
    venues: [],
    users: [],
    authSessions: []
  };
}

function ensureConsoleAccountSeeds() {
  let changed = false;

  state.users = (state.users || []).map((user) => {
    const normalizedAccountNamespace = normalizeAccountNamespace(user.accountNamespace || user.username);
    const rawEnvLabel = trimText(user.environmentLabel);
    const environmentLabel = isLegacyEnvironmentLabel(rawEnvLabel)
      ? environmentLabelForNamespace(normalizedAccountNamespace)
      : rawEnvLabel || environmentLabelForNamespace(normalizedAccountNamespace);
    if (
      normalizedAccountNamespace === trimText(user.accountNamespace)
      && environmentLabel === trimText(user.environmentLabel)
    ) {
      return user;
    }
    changed = true;
    return {
      ...user,
      accountNamespace: normalizedAccountNamespace,

      environmentLabel
    };
  });

  state.tvScreens = (state.tvScreens || []).map((screen) => {
    const normalizedAccountNamespace = normalizeScreenAccountNamespace(screen.accountNamespace);
    if (normalizedAccountNamespace === trimText(screen.accountNamespace)) {
      return screen;
    }
    changed = true;
    return {
      ...screen,
      accountNamespace: normalizedAccountNamespace
    };
  });

  for (const preset of CONSOLE_ACCOUNT_PRESETS) {
    const existing = state.users.find((user) => user.username === preset.username);
    if (existing) {
      const nextAccountNamespace = normalizeAccountNamespace(existing.accountNamespace || preset.accountNamespace);
      const existingEnvLabel = trimText(existing.environmentLabel);
      const nextEnvironmentLabel = isLegacyEnvironmentLabel(existingEnvLabel)
        ? preset.environmentLabel
        : existingEnvLabel || preset.environmentLabel;
      const existingNickname = trimText(existing.nickname);
      const nextNickname = isLegacyEnvironmentLabel(existingNickname) ? preset.nickname : existingNickname || preset.nickname;
      const nextPasswordDigest = existing.passwordDigest || normalizePassword(preset.password);
      const nextRole = trimText(existing.role) || preset.role || (SUPERADMIN_USERNAMES.has(preset.username) ? "superadmin" : "venue");
      if (
        nextAccountNamespace !== trimText(existing.accountNamespace)
        || nextEnvironmentLabel !== trimText(existing.environmentLabel)
        || nextNickname !== trimText(existing.nickname)
        || nextPasswordDigest !== existing.passwordDigest
        || nextRole !== trimText(existing.role)
        || JSON.stringify(normalizeAllowedClients(existing.allowedClients)) !== JSON.stringify(normalizeAllowedClients(preset.allowedClients))
      ) {
        existing.accountNamespace = nextAccountNamespace;
        existing.environmentLabel = nextEnvironmentLabel;
        existing.nickname = nextNickname;
        existing.passwordDigest = nextPasswordDigest;
        existing.role = nextRole;
        existing.allowedClients = normalizeAllowedClients(existing.allowedClients || preset.allowedClients);
        changed = true;
      }
      continue;
    }

    state.users.push({
      id: nextId(state.users),
      username: preset.username,
      nickname: preset.nickname,
      avatar: "",
      gender: "MALE",
      userType: "CONSOLE",
      passwordDigest: normalizePassword(preset.password),
      accountNamespace: preset.accountNamespace,
      environmentLabel: preset.environmentLabel,
      role: preset.role || (SUPERADMIN_USERNAMES.has(preset.username) ? "superadmin" : "venue"),
      venueId: "",
      allowedClients: normalizeAllowedClients(preset.allowedClients),
      createTime: nowIso(),
      lastLoginTime: null
    });
    changed = true;
  }

  // Venue records are now created explicitly via the "场馆管理" UI.
  // Cleanup legacy auto-seeded venues (e.g. 正式环境/测试环境) so that
  // superadmin accounts start with zero venues by default.
  state.venues = state.venues || [];
  if (state.venues.length) {
    const namespacesToCleanup = new Set(CONSOLE_ACCOUNT_PRESETS.map((preset) => normalizeAccountNamespace(preset.accountNamespace || preset.username)));
    const keep = [];
    let didRemove = false;
    for (const venue of state.venues) {
      const ns = normalizeAccountNamespace(venue.accountNamespace);
      const venueId = trimText(venue.id);
      const shouldCleanup =
        namespacesToCleanup.has(ns) &&
        (isLegacyEnvironmentLabel(venue.name) || trimText(venue.name) === ns);
      if (shouldCleanup) {
        didRemove = true;
        // Detach any legacy venue users/screens so the newly created venue can
        // re-bind them explicitly later.
        state.users = (state.users || []).map((user) =>
          trimText(user.venueId) === venueId ? { ...user, venueId: "" } : user
        );
        state.tvScreens = (state.tvScreens || []).filter(
          (screen) => normalizeScreenAccountNamespace(screen.accountNamespace) !== ns
        );
        continue;
      }
      keep.push(venue);
    }
    if (didRemove) {
      state.venues = keep;
      changed = true;
    }
  }

  if (changed) {
    persist();
  }
}

function stripSeedCourseExamples(source) {
  const signatures = new Set(["HYROX WR 001::Karl", "Boxing Circuit 002::Mina"]);
  const removableCourseIds = new Set(
    (source.courses || [])
      .filter((course) => signatures.has(`${course.name || ""}::${course.creator || ""}`))
      .map((course) => course.id)
  );

  if (!removableCourseIds.size) {
    return { state: source, changed: false };
  }

  return {
    changed: true,
    state: {
      ...source,
      courses: (source.courses || []).filter((course) => !removableCourseIds.has(course.id)),
      schedules: (source.schedules || []).filter((schedule) => !removableCourseIds.has(schedule.courseId))
    }
  };
}

function getScopedRecordPackageIds(record = {}, defaultPackageId = getDefaultCoursePackageId()) {
  const packageIds = numberList(record.coursePackageIds);
  return packageIds.length ? packageIds : [defaultPackageId];
}

function dedupeActionTypesWithinPackages(actionTypes = [], actions = [], defaultPackageId = getDefaultCoursePackageId()) {
  const canonicalTypes = [];
  const canonicalById = new Map();
  const canonicalKeyToId = new Map();
  const duplicateIdMap = new Map();
  let changed = false;

  for (const rawType of actionTypes) {
    const type = normalizeActionTypeRecord(rawType);
    const nameKey = stripMediaSuffix(type.name).toLowerCase();
    if (!type.id || !nameKey) {
      canonicalTypes.push(type);
      continue;
    }

    const packageIds = getScopedRecordPackageIds(type, defaultPackageId);
    let canonical = null;
    for (const packageId of packageIds) {
      const existingId = canonicalKeyToId.get(`${packageId}:${nameKey}`);
      if (existingId) {
        canonical = canonicalById.get(existingId) || null;
        break;
      }
    }

    if (!canonical) {
      canonical = {
        ...type,
        coursePackageIds: numberList(packageIds)
      };
      canonicalTypes.push(canonical);
      canonicalById.set(canonical.id, canonical);
    } else {
      duplicateIdMap.set(type.id, canonical.id);
      const mergedPackageIds = numberList([...canonical.coursePackageIds, ...packageIds]);
      if (JSON.stringify(mergedPackageIds) !== JSON.stringify(canonical.coursePackageIds)) {
        canonical.coursePackageIds = mergedPackageIds;
      }
      changed = true;
    }

    for (const packageId of packageIds) {
      canonicalKeyToId.set(`${packageId}:${nameKey}`, canonical.id);
    }
  }

  if (!duplicateIdMap.size) {
    return { actionTypes: canonicalTypes, actions, changed };
  }

  const remappedActions = actions.map((action) => {
    const nextTypeIds = numberList((action.typeIds || []).map((id) => duplicateIdMap.get(id) || id));
    if (JSON.stringify(nextTypeIds) === JSON.stringify(numberList(action.typeIds))) {
      return action;
    }
    changed = true;
    return {
      ...action,
      typeIds: nextTypeIds
    };
  });

  return { actionTypes: canonicalTypes, actions: remappedActions, changed };
}

function normalizeLessonTypePackages(lessonTypes = [], courses = [], defaultPackageId = getDefaultCoursePackageId()) {
  const usageByTypeId = new Map();
  for (const course of courses) {
    const packageId = normalizeCoursePackageId(course?.coursePackageId, defaultPackageId);
    for (const typeId of numberList(course?.typeIds)) {
      const ids = usageByTypeId.get(typeId) || [];
      ids.push(packageId);
      usageByTypeId.set(typeId, numberList(ids));
    }
  }

  return lessonTypes.map((rawType) => {
    const type = normalizeActionTypeRecord(rawType);
    const explicitPackageIds = numberList(type.coursePackageIds);
    const usedPackageIds = numberList(usageByTypeId.get(type.id) || []);
    const coursePackageIds = numberList([...explicitPackageIds, ...usedPackageIds]);

    return {
      ...type,
      coursePackageIds: coursePackageIds.length ? coursePackageIds : [defaultPackageId]
    };
  });
}

function dedupeLessonTypesWithinPackages(lessonTypes = [], courses = [], defaultPackageId = getDefaultCoursePackageId()) {
  const canonicalTypes = [];
  const canonicalById = new Map();
  const canonicalKeyToId = new Map();
  const duplicateIdMap = new Map();
  let changed = false;

  for (const rawType of lessonTypes) {
    const type = normalizeActionTypeRecord(rawType);
    const nameKey = stripMediaSuffix(type.name).toLowerCase();
    if (!type.id || !nameKey) {
      canonicalTypes.push(type);
      continue;
    }

    const packageIds = getScopedRecordPackageIds(type, defaultPackageId);
    let canonical = null;
    for (const packageId of packageIds) {
      const existingId = canonicalKeyToId.get(`${packageId}:${nameKey}`);
      if (existingId) {
        canonical = canonicalById.get(existingId) || null;
        break;
      }
    }

    if (!canonical) {
      canonical = {
        ...type,
        coursePackageIds: numberList(packageIds)
      };
      canonicalTypes.push(canonical);
      canonicalById.set(canonical.id, canonical);
    } else {
      duplicateIdMap.set(type.id, canonical.id);
      const mergedPackageIds = numberList([...canonical.coursePackageIds, ...packageIds]);
      if (JSON.stringify(mergedPackageIds) !== JSON.stringify(canonical.coursePackageIds)) {
        canonical.coursePackageIds = mergedPackageIds;
      }
      changed = true;
    }

    for (const packageId of packageIds) {
      canonicalKeyToId.set(`${packageId}:${nameKey}`, canonical.id);
    }
  }

  if (!duplicateIdMap.size) {
    return { lessonTypes: canonicalTypes, courses, changed };
  }

  const remappedCourses = courses.map((course) => {
    const nextTypeIds = numberList((course.typeIds || []).map((id) => duplicateIdMap.get(id) || id));
    if (JSON.stringify(nextTypeIds) === JSON.stringify(numberList(course.typeIds))) {
      return course;
    }
    changed = true;
    return {
      ...course,
      typeIds: nextTypeIds
    };
  });

  return { lessonTypes: canonicalTypes, courses: remappedCourses, changed };
}

function normalizeLoadedState(parsed) {
  const parsedCourses = Array.isArray(parsed.courses) ? parsed.courses : clone(defaultState.courses);
  const defaultCourseIds = parsedCourses.map((course) => Number(course?.id)).filter((id) => Number.isFinite(id) && id > 0);
  let coursePackages = Array.isArray(parsed.coursePackages)
    ? parsed.coursePackages.map((item) => normalizeCoursePackageRecord(item))
    : [];
  if (!coursePackages.length) {
    coursePackages = [
      normalizeCoursePackageRecord(
        {
          ...defaultState.coursePackages[0],
          courseIds: defaultCourseIds
        },
        defaultCourseIds
      )
    ];
  }
  if (!coursePackages.some((item) => item.isDefault)) {
    coursePackages[0] = { ...coursePackages[0], isDefault: true };
  }
  const defaultPackageId = normalizeCoursePackageId(coursePackages.find((item) => item.isDefault)?.id || coursePackages[0]?.id);
  const validPackageIds = new Set(coursePackages.map((item) => normalizeCoursePackageId(item.id)));
  const templates = (
    Array.isArray(parsed.templates) ? parsed.templates : clone(defaultState.templates)
  ).map((item) => normalizeLoadedTemplateCoursePackageIds(item, coursePackages, defaultPackageId));
  const normalizedActions = (Array.isArray(parsed.actions) ? parsed.actions : clone(defaultState.actions)).map(normalizeActionRecord);
  const dedupedActionTypeState = dedupeActionTypesWithinPackages(
    Array.isArray(parsed.actionTypes)
      ? parsed.actionTypes.map(normalizeActionTypeRecord)
      : clone(defaultState.actionTypes).map(normalizeActionTypeRecord),
    normalizedActions,
    defaultPackageId
  );
  if (dedupedActionTypeState.changed) {
    normalizeLoadedStateDidChange = true;
  }
  const dedupedLessonTypeState = dedupeLessonTypesWithinPackages(
    normalizeLessonTypePackages(
      Array.isArray(parsed.lessonTypes)
        ? parsed.lessonTypes
        : clone(defaultState.lessonTypes),
      parsedCourses,
      defaultPackageId
    ),
    parsedCourses,
    defaultPackageId
  );
  if (dedupedLessonTypeState.changed) {
    normalizeLoadedStateDidChange = true;
  }

  return {
    media: Array.isArray(parsed.media) ? parsed.media : [],
    appPackages: Array.isArray(parsed.appPackages) ? parsed.appPackages : clone(defaultState.appPackages),
    coursePackages,
    actionTypes: dedupedActionTypeState.actionTypes,
    lessonTypes: dedupedLessonTypeState.lessonTypes,
    actions: dedupedActionTypeState.actions,
    courses: dedupedLessonTypeState.courses,
    templates,
    schedules: Array.isArray(parsed.schedules)
      ? parsed.schedules.map((item) => {
          const next = normalizeScheduleEntry(item);
          if (!validPackageIds.has(next.coursePackageId)) {
            next.coursePackageId = defaultPackageId;
          }
          return next;
        })
      : clone(defaultState.schedules),
    tvScreens: Array.isArray(parsed.tvScreens)
      ? parsed.tvScreens.map((item) => ({
          ...item,
          accountNamespace: normalizeScreenAccountNamespace(item?.accountNamespace)
        }))
      : clone(defaultState.tvScreens),
    playbackSessions: Array.isArray(parsed.playbackSessions)
      ? parsed.playbackSessions.map(normalizePlaybackSessionEntry)
      : clone(defaultState.playbackSessions),
    venues: Array.isArray(parsed.venues)
      ? parsed.venues.map((item) => {
          const coursePackageIds = numberList(item?.coursePackageIds).filter((id) => validPackageIds.has(id));
          const boundPackageIds = coursePackageIds.length ? coursePackageIds : [defaultPackageId];
          const activeCoursePackageId = normalizeCoursePackageId(item?.activeCoursePackageId, 0);
          return {
            ...item,
            id: trimText(item?.id) || String(item?.id || ""),
            name: trimText(item?.name),
            accountNamespace: normalizeAccountNamespace(item?.accountNamespace),
            coursePackageIds: boundPackageIds,
            activeCoursePackageId: boundPackageIds.includes(activeCoursePackageId)
              ? activeCoursePackageId
              : boundPackageIds[0] || defaultPackageId,
            createTime: trimText(item?.createTime),
            updateTime: trimText(item?.updateTime)
          };
        })
      : clone(defaultState.venues),
    users: Array.isArray(parsed.users)
      ? parsed.users.map((item) => ({
          ...item,
          accountNamespace: normalizeAccountNamespace(item?.accountNamespace || item?.username),
          environmentLabel:
            trimText(item?.environmentLabel)
            || environmentLabelForNamespace(item?.accountNamespace || item?.username),
          role: trimText(item?.role) || (SUPERADMIN_USERNAMES.has(trimText(item?.username)) ? "superadmin" : "venue"),
          venueId: trimText(item?.venueId) || "",
          coursePackageIds: numberList(item?.coursePackageIds).filter((id) => validPackageIds.has(id))
        }))
      : clone(defaultState.users),
    authSessions: Array.isArray(parsed.authSessions) ? parsed.authSessions : clone(defaultState.authSessions)
  };
}

function tryLoadStateFile(targetFile) {
  if (!fs.existsSync(targetFile)) {
    return null;
  }

  const raw = fs.readFileSync(targetFile, "utf8");
  const parsed = JSON.parse(raw);
  const hadScheduleVenueId = Array.isArray(parsed?.schedules)
    ? parsed.schedules.some((schedule) => schedule && typeof schedule === "object" && "venueId" in schedule)
    : false;
  normalizeLoadedStateDidChange = false;
  const normalized = normalizeLoadedState(parsed);
  const stripped = stripSeedCourseExamples(normalized);
  const changed = stripped.changed || hadScheduleVenueId || normalizeLoadedStateDidChange;
  normalizeLoadedStateDidChange = false;
  return {
    state: stripped.state,
    changed
  };
}

function writeStateSnapshot(nextState, options = {}) {
  const { createBackup = true, reason = "autosave" } = options;
  const nextText = JSON.stringify(nextState, null, 2);
  const currentText = readTextIfExists(dbFile);

  if (createBackup && currentText.trim() && currentText !== nextText) {
    createDatabaseBackup(currentText, reason);
  }

  writeTextAtomic(dbFile, nextText);
}

function loadState() {
  try {
    const primary = tryLoadStateFile(dbFile);
    if (primary) {
      if (primary.changed) {
        writeStateSnapshot(primary.state, { createBackup: false, reason: "normalize" });
      }
      return primary.state;
    }
  } catch (error) {
    // Fallback to backups below.
  }

  for (const backupFile of listBackupFiles()) {
    try {
      const restored = tryLoadStateFile(backupFile);
      if (!restored) {
        continue;
      }
      writeStateSnapshot(restored.state, { createBackup: false, reason: "restore" });
      return restored.state;
    } catch (error) {
      // Skip broken backups and continue trying older ones.
    }
  }

  try {
    writeStateSnapshot(defaultState, { createBackup: false, reason: "bootstrap" });
    return clone(defaultState);
  } catch (error) {
    return clone(defaultState);
  }
}

function persist() {
  writeStateSnapshot(state, { createBackup: true, reason: "autosave" });

}

export function getDatabaseStatus() {
  const backups = listBackupFiles();
  const dbText = readTextIfExists(dbFile);
  const dbSizeBytes = Buffer.byteLength(dbText || "", "utf8");
  const latestBackup = backups[0] || "";

  return {
    usingExternalDataRoot: storageRoot !== legacyStorageRoot,
    backupCount: backups.length,
    latestBackupAt: latestBackup ? new Date(fs.statSync(latestBackup).mtimeMs).toISOString() : "",
    dbSizeBytes
  };
}

function publicUserInfo(user) {
  const venue = trimText(user.venueId)
    ? getVenueById(user.venueId)
    : getVenueByAccountNamespace(user.accountNamespace || user.username);
  const venueName = trimText(venue?.name);
  const role = trimText(user.role) || (SUPERADMIN_USERNAMES.has(trimText(user.username)) ? "superadmin" : "venue");
  const baseInfo = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    gender: user.gender,
    accountNamespace: normalizeAccountNamespace(user.accountNamespace || user.username),
    environmentLabel: venueName || trimText(user.environmentLabel) || environmentLabelForNamespace(user.accountNamespace || user.username),
    venueName,
    gymName: venueName,
    role,
    venueId: trimText(user.venueId) || "",
    coursePackageIds: numberList(user.coursePackageIds),
    allowedClients: normalizeAllowedClients(user.allowedClients)
  };
  if (role !== "superadmin") {
    baseInfo.password = trimText(user.passwordPlain);
  }
  return {
    ...baseInfo
  };
}

function cleanupExpiredSessions() {
  const beforeLength = state.authSessions.length;
  state.authSessions = state.authSessions.filter((item) => isFutureTime(item.refreshExpiresAt));
  if (state.authSessions.length !== beforeLength) {
    persist();
  }
}

function createAuthPayload(userId, clientName = "editor-web") {
  const normalizedClient = normalizeClientName(clientName);
  const tokenType = "Bearer";
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const session = {
    id: nextId(state.authSessions),
    userId,
    client: normalizedClient,
    tokenType,
    accessToken,
    refreshToken,
    expiresAt: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS),
    refreshExpiresAt: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
    createTime: nowIso()
  };

  state.authSessions = state.authSessions.filter(
    (item) => item.userId !== userId || normalizeClientName(item.client) !== normalizedClient
  );
  state.authSessions.push(session);
  persist();

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_in: ACCESS_TOKEN_TTL_SECONDS
  };
}

function normalizeActionPayload(payload = {}, existing = null) {
  const timestamp = nowIso();
  const ownerUsername = trimText(payload.ownerUsername ?? payload.author ?? existing?.ownerUsername ?? existing?.author);
  return {
    id: existing?.id ?? nextId(state.actions),
    name: trimText(payload.name),
    description: trimText(payload.description ?? existing?.description),
    typeIds: numberList(payload.typeIds),
    media: payload.media ?? existing?.media ?? null,
    courseTags: normalizeCourseTags(payload.courseTags ?? existing?.courseTags),
    coursePackageIds: numberList(payload.coursePackageIds ?? existing?.coursePackageIds),
    author: trimText(payload.author ?? existing?.author) || ownerUsername,
    ownerUsername,
    createTime: existing?.createTime ?? timestamp,
    updateTime: timestamp
  };
}

function normalizeTvPlaybackState(value) {
  const stateText = trimText(value).toUpperCase();
  if (["IDLE", "SYNCING", "PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(stateText)) {
    return stateText;
  }
  return "IDLE";
}

function normalizeTvUpdateState(value) {
  const stateText = trimText(value).toUpperCase();
  if (["IDLE", "DOWNLOADING", "DOWNLOADED", "INSTALLING", "ERROR"].includes(stateText)) {
    return stateText;
  }
  return "IDLE";
}

function normalizePlaybackState(value, fallback = "PREVIEW") {
  const stateText = trimText(value).toUpperCase();
  if (["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(stateText)) {
    return stateText;
  }
  return fallback;
}

function createPlaybackSessionId() {
  return `ps_${Date.now().toString(36)}_${randomToken().slice(0, 10)}`;
}

function safeTimeMs(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  const parsed = new Date(trimText(value)).getTime();
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizePlaybackCommand(command = {}) {
  return {
    commandId: trimText(command.commandId),
    action: trimText(command.action),
    state: normalizePlaybackState(command.state, "PREVIEW"),
    version: safeNumber(command.version),
    resultVersion: safeNumber(command.resultVersion, safeNumber(command.version)),
    createdAt: trimText(command.createdAt) || nowIso()
  };
}

function normalizePlaybackSessionEntry(entry = {}) {
  const serverStartAtMs = safeNumber(entry.serverStartAtMs);
  const state = normalizePlaybackState(entry.state, serverStartAtMs > 0 ? "RUNNING" : "TERMINATED");
  const createdAtMs = safeTimeMs(entry.createdAtMs || entry.createTime);
  const updatedAtMs = safeTimeMs(entry.updatedAtMs || entry.updateTime, createdAtMs);
  const endedAtMs = safeNumber(entry.endedAtMs, entry.endTime ? safeTimeMs(entry.endTime, 0) : 0);
  const terminatedAtMs = safeNumber(entry.terminatedAtMs);
  return {
    id: trimText(entry.id) || createPlaybackSessionId(),
    accountNamespace: normalizeAccountNamespace(entry.accountNamespace),
    scheduleId: trimText(entry.scheduleId),
    courseId: safeNumber(entry.courseId),
    duration: safeNumber(entry.duration),
    expectedDurationMs: safeNumber(entry.expectedDurationMs),
    bundleChecksum: trimText(entry.bundleChecksum),
    state,
    version: Math.max(1, safeNumber(entry.version, 1)),
    courseName: trimText(entry.courseName),
    scheduledStartAtMs: safeNumber(entry.scheduledStartAtMs),
    serverStartAtMs,
    pausedAccumulatedMs: safeNumber(entry.pausedAccumulatedMs),
    pausedAtMs: safeNumber(entry.pausedAtMs),
    endedAtMs,
    terminatedAtMs,
    createdBy: trimText(entry.createdBy),
    createdAtMs,
    updatedAtMs,
    startDelayMs: safeNumber(entry.startDelayMs),
    createTime: trimText(entry.createTime) || nowIso(),
    updateTime: trimText(entry.updateTime) || nowIso(),
    endTime: trimText(entry.endTime),
    lastCommandId: trimText(entry.lastCommandId),
    metadata: entry.metadata && typeof entry.metadata === "object" ? clone(entry.metadata) : {},
    commandLog: Array.isArray(entry.commandLog) ? entry.commandLog.map(normalizePlaybackCommand).filter((item) => item.commandId) : []
  };
}

function materializePlaybackSession(session) {
  if (!session) {
    return null;
  }
  const serverNowMs = Date.now();
  if (session.state === "PREVIEW") {
    const previewTouchedAtMs = safeNumber(session.updatedAtMs, safeNumber(session.createdAtMs));
    if (previewTouchedAtMs > 0 && serverNowMs - previewTouchedAtMs > PLAYBACK_PREVIEW_TTL_MS) {
      session.state = "TERMINATED";
      session.terminatedAtMs = serverNowMs;
      session.endTime = nowIso();
      session.version = Math.max(1, safeNumber(session.version, 1)) + 1;
      session.updatedAtMs = serverNowMs;
      session.updateTime = nowIso();
      session.metadata = {
        ...(session.metadata && typeof session.metadata === "object" ? session.metadata : {}),
        expiredReason: "preview_timeout",
        previewTtlMs: PLAYBACK_PREVIEW_TTL_MS
      };
      persist();
    }
  }
  if (session.state === "SCHEDULED" && session.serverStartAtMs > 0 && serverNowMs >= session.serverStartAtMs) {
    session.state = "RUNNING";
    session.version = Math.max(1, safeNumber(session.version, 1)) + 1;
    session.updatedAtMs = serverNowMs;
    session.updateTime = nowIso();
    persist();
  }
  const durationMs = getPlaybackSessionDurationMs(session);
  if (session.state === "RUNNING" && durationMs > 0 && calculatePlaybackElapsedMs(session, serverNowMs) >= durationMs) {
    session.state = "ENDED";
    session.endedAtMs = serverNowMs;
    session.endTime = nowIso();
    session.version = Math.max(1, safeNumber(session.version, 1)) + 1;
    session.updatedAtMs = serverNowMs;
    session.updateTime = nowIso();
    persist();
  }
  return session;
}

function getPlaybackSessionDurationMs(session) {
  const explicitDurationMs = safeNumber(session?.expectedDurationMs);
  if (explicitDurationMs > 0) {
    return explicitDurationMs;
  }
  return safeNumber(session?.duration) * 60 * 1000;
}

function calculatePlaybackElapsedMs(session, serverNowMs = Date.now()) {
  if (!session || !safeNumber(session.serverStartAtMs)) {
    return 0;
  }

  const serverStartAtMs = safeNumber(session.serverStartAtMs);
  const pausedAccumulatedMs = safeNumber(session.pausedAccumulatedMs);
  const stateText = normalizePlaybackState(session.state);
  if (stateText === "PAUSED") {
    return Math.max(0, safeNumber(session.pausedAtMs, serverStartAtMs) - serverStartAtMs - pausedAccumulatedMs);
  }
  if (stateText === "ENDED") {
    return Math.max(0, safeNumber(session.endedAtMs, serverNowMs) - serverStartAtMs - pausedAccumulatedMs);
  }
  if (stateText === "TERMINATED") {
    return Math.max(0, safeNumber(session.terminatedAtMs, serverNowMs) - serverStartAtMs - pausedAccumulatedMs);
  }
  return Math.max(0, serverNowMs - serverStartAtMs - pausedAccumulatedMs);
}

function serializePlaybackSession(session) {
  const current = materializePlaybackSession(session);
  if (!current) {
    return null;
  }
  const serverNowMs = Date.now();
  return {
    id: current.id,
    accountNamespace: normalizeAccountNamespace(current.accountNamespace),
    state: normalizePlaybackState(current.state),
    version: Math.max(1, safeNumber(current.version, 1)),
    scheduleId: trimText(current.scheduleId),
    courseId: safeNumber(current.courseId),
    duration: safeNumber(current.duration),
    expectedDurationMs: getPlaybackSessionDurationMs(current),
    expectedEndAtMs: safeNumber(current.serverStartAtMs)
      ? safeNumber(current.serverStartAtMs) + getPlaybackSessionDurationMs(current) + safeNumber(current.pausedAccumulatedMs)
      : 0,
    courseName: trimText(current.courseName),
    bundleChecksum: trimText(current.bundleChecksum),
    scheduledStartAtMs: safeNumber(current.scheduledStartAtMs),
    serverStartAtMs: safeNumber(current.serverStartAtMs),
    pausedAccumulatedMs: safeNumber(current.pausedAccumulatedMs),

    pausedAtMs: safeNumber(current.pausedAtMs),
    endedAtMs: safeNumber(current.endedAtMs),
    terminatedAtMs: safeNumber(current.terminatedAtMs),
    createdBy: trimText(current.createdBy),
    createdAtMs: safeNumber(current.createdAtMs),
    updatedAtMs: safeNumber(current.updatedAtMs),
    elapsedMs: calculatePlaybackElapsedMs(current, serverNowMs),
    serverNowMs,
    startDelayMs: safeNumber(current.startDelayMs),
    metadata: current.metadata && typeof current.metadata === "object" ? clone(current.metadata) : {},
    createTime: trimText(current.createTime),
    updateTime: trimText(current.updateTime),
    endTime: trimText(current.endTime),
    lastCommandId: trimText(current.lastCommandId),
    lastCommand: current.commandLog?.length ? current.commandLog[current.commandLog.length - 1] : null
  };
}

function findPlaybackSessionById(sessionId, accountNamespace = "") {
  const id = trimText(sessionId);
  const ns = normalizeAccountNamespace(accountNamespace);
  const session = (state.playbackSessions || []).find((item) => trimText(item.id) === id && normalizeAccountNamespace(item.accountNamespace) === ns);
  return materializePlaybackSession(session || null);
}

function getActivePlaybackSessionEntry(accountNamespace = "") {
  const ns = normalizeAccountNamespace(accountNamespace);
  const sessions = (state.playbackSessions || [])
    .filter((item) => normalizeAccountNamespace(item.accountNamespace) === ns)
    .map(materializePlaybackSession)
    .filter((item) => item && PLAYBACK_ACTIVE_STATES.has(item.state))
    .sort((left, right) => new Date(right.updateTime || right.createTime || 0).getTime() - new Date(left.updateTime || left.createTime || 0).getTime());
  return sessions[0] || null;
}

function getRecentTerminalPlaybackSessionEntry(accountNamespace = "") {
  const ns = normalizeAccountNamespace(accountNamespace);
  const nowMs = Date.now();
  const sessions = (state.playbackSessions || [])
    .filter((item) => normalizeAccountNamespace(item.accountNamespace) === ns)
    .map(materializePlaybackSession)
    .filter((item) => {
      if (!item || !PLAYBACK_TERMINAL_STATES.has(item.state)) {
        return false;
      }
      const updatedAtMs =
        safeNumber(item.updatedAtMs)
        || new Date(item.updateTime || item.endTime || item.createTime || 0).getTime();
      return updatedAtMs > 0 && nowMs - updatedAtMs <= PLAYBACK_TERMINAL_CURRENT_TTL_MS;
    })
    .sort((left, right) => {
      const leftUpdatedAtMs = safeNumber(left.updatedAtMs) || new Date(left.updateTime || left.endTime || left.createTime || 0).getTime();
      const rightUpdatedAtMs = safeNumber(right.updatedAtMs) || new Date(right.updateTime || right.endTime || right.createTime || 0).getTime();
      return rightUpdatedAtMs - leftUpdatedAtMs;
    });
  return sessions[0] || null;
}

function getCurrentPlaybackSessionEntry(accountNamespace = "") {
  return getActivePlaybackSessionEntry(accountNamespace) || getRecentTerminalPlaybackSessionEntry(accountNamespace);
}

function recordPlaybackCommand(session, action, commandId) {
  const id = trimText(commandId);
  if (!id) {
    throw new Error("commandId 不能为空。");
  }
  const existing = (session.commandLog || []).find((item) => trimText(item.commandId) === id);
  if (existing) {
    return { duplicate: true, command: existing };
  }
  session.commandLog = Array.isArray(session.commandLog) ? session.commandLog : [];
  const command = {
    commandId: id,
    action,
    state: session.state,
    version: session.version,
    resultVersion: session.version,
    createdAt: nowIso()
  };
  session.commandLog.push(command);
  session.commandLog = session.commandLog.slice(-30);
  session.lastCommandId = id;
  return { duplicate: false, command };
}

function buildTvScreenSnapshot(entry = null) {
  const lastSeenAt = trimText(entry?.lastSeenAt);
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  const online = lastSeenMs > 0 && Date.now() - lastSeenMs <= TV_ONLINE_THRESHOLD_MS;
  const screenNumber = Number(entry?.screenNumber) || 0;
  const accountNamespace = normalizeScreenAccountNamespace(entry?.accountNamespace);
  const previousScreenNumber = Number(entry?.previousScreenNumber) || 0;

  return {
    accountNamespace,
    screenNumber,
    orientation: screenNumber === 2 || screenNumber === 4 ? "HORIZONTAL" : "VERTICAL",
    previousAccountNamespace: normalizeScreenAccountNamespace(entry?.previousAccountNamespace),
    previousScreenNumber,
    deviceId: trimText(entry?.deviceId),
    mqttClientId: trimText(entry?.mqttClientId),
    appVersion: trimText(entry?.appVersion),
    platform: trimText(entry?.platform) || "tv-android",
    boundAt: trimText(entry?.boundAt),
    unboundAt: trimText(entry?.unboundAt),
    lastSeenAt,
    online,
    playbackState: normalizeTvPlaybackState(entry?.playbackState),
    activeScheduleId: trimText(entry?.activeScheduleId),
    previewMode: Boolean(entry?.previewMode),
    playbackSessionId: trimText(entry?.playbackSessionId),
    bundleChecksum: trimText(entry?.bundleChecksum),
    playbackElapsedMs: safeNumber(entry?.playbackElapsedMs),
    updateState: normalizeTvUpdateState(entry?.updateState),
    updateTargetVersion: trimText(entry?.updateTargetVersion),
    updateProgressPercent: safeNumber(entry?.updateProgressPercent),
    updateMessage: trimText(entry?.updateMessage),
    cacheBytes: safeNumber(entry?.cacheBytes),
    cacheFileCount: safeNumber(entry?.cacheFileCount),
    cacheUpdatedAt: trimText(entry?.cacheUpdatedAt)
  };
}

function normalizeTvScreenPayload(payload = {}, existing = null, fallbackAccountNamespace = "") {
  const now = nowIso();
  const nextPairToken = trimText(payload.pairToken) || trimText(existing?.pairToken);
  const requestedScreenNumber = Number(payload.screenNumber) || Number(existing?.screenNumber) || 0;
  const payloadAccountNamespace = trimText(payload.accountNamespace).toLowerCase();
  const existingAccountNamespace = normalizeScreenAccountNamespace(existing?.accountNamespace);
  const fallbackNamespace = normalizeScreenAccountNamespace(fallbackAccountNamespace);
  const nextAccountNamespace = payloadAccountNamespace || existingAccountNamespace || fallbackNamespace;
  const nextScreenNumber = nextAccountNamespace ? requestedScreenNumber : 0;
  const previousAccountNamespace =
    trimText(payload.previousAccountNamespace).toLowerCase()
    || trimText(existing?.previousAccountNamespace).toLowerCase()
    || (!nextAccountNamespace ? existingAccountNamespace : "");
  const previousScreenNumber = safeNumber(
    payload.previousScreenNumber,
    safeNumber(existing?.previousScreenNumber, !nextAccountNamespace ? Number(existing?.screenNumber) || 0 : 0)
  );
  const hasActiveScheduleId = Object.prototype.hasOwnProperty.call(payload, "activeScheduleId");
  const hasPlaybackSessionId = Object.prototype.hasOwnProperty.call(payload, "playbackSessionId");
  const hasBundleChecksum = Object.prototype.hasOwnProperty.call(payload, "bundleChecksum");
  return {
    accountNamespace: nextAccountNamespace,
    screenNumber: nextScreenNumber,
    previousAccountNamespace,
    previousScreenNumber,
    deviceId: trimText(payload.deviceId) || trimText(existing?.deviceId),
    mqttClientId: trimText(payload.mqttClientId) || trimText(existing?.mqttClientId),
    appVersion: trimText(payload.appVersion) || trimText(existing?.appVersion),
    platform: trimText(payload.platform) || trimText(existing?.platform) || "tv-android",
    boundAt: nextAccountNamespace ? trimText(payload.boundAt) || trimText(existing?.boundAt) || now : "",
    unboundAt: nextAccountNamespace ? "" : trimText(payload.unboundAt) || trimText(existing?.unboundAt),
    lastSeenAt: now,
    playbackState: normalizeTvPlaybackState(payload.playbackState || existing?.playbackState),
    activeScheduleId: hasActiveScheduleId
      ? trimText(payload.activeScheduleId)
      : trimText(existing?.activeScheduleId),
    previewMode:
      typeof payload.previewMode === "boolean" ? payload.previewMode : Boolean(existing?.previewMode),
    playbackSessionId: hasPlaybackSessionId
      ? trimText(payload.playbackSessionId)
      : trimText(existing?.playbackSessionId),
    bundleChecksum: hasBundleChecksum
      ? trimText(payload.bundleChecksum)
      : trimText(existing?.bundleChecksum),
    playbackElapsedMs: safeNumber(payload.playbackElapsedMs, safeNumber(existing?.playbackElapsedMs)),
    updateState: normalizeTvUpdateState(payload.updateState || existing?.updateState),
    updateTargetVersion: trimText(payload.updateTargetVersion) || trimText(existing?.updateTargetVersion),
    updateProgressPercent: safeNumber(payload.updateProgressPercent, safeNumber(existing?.updateProgressPercent)),
    updateMessage: trimText(payload.updateMessage) || trimText(existing?.updateMessage),
    cacheBytes: safeNumber(payload.cacheBytes, safeNumber(existing?.cacheBytes)),
    cacheFileCount: safeNumber(payload.cacheFileCount, safeNumber(existing?.cacheFileCount)),
    cacheUpdatedAt: trimText(payload.cacheUpdatedAt) || trimText(existing?.cacheUpdatedAt) || now,
    pairToken: nextPairToken,
    pairUpdatedAt: trimText(payload.pairToken) ? now : trimText(existing?.pairUpdatedAt) || now
  };
}

function getAppPackageFilePath(filename = "") {
  return path.join(appPackageRoot, path.basename(String(filename || "")));
}

function normalizeAppPackageRecord(payload = {}, existing = null) {
  const timestamp = nowIso();
  const filename = trimText(payload.filename) || trimText(existing?.filename);
  const originalName = trimText(payload.originalName) || trimText(existing?.originalName) || filename;
  const platform = normalizeAppPlatform(payload.platform || existing?.platform || inferAppPlatformFromFilename(filename));
  const version =
    trimText(payload.version) || trimText(existing?.version) || inferAppVersionFromFilename(originalName || filename);
  const label =
    trimText(payload.label) ||
    trimText(existing?.label) ||
    `${platform === "coach" ? "COACH" : "TV"} ${version}`;

  return {
    id: existing?.id ?? nextId(state.appPackages),
    platform,
    version,
    label,
    filename,
    originalName,
    checksum: trimText(payload.checksum) || trimText(existing?.checksum),
    sizeBytes: safeNumber(payload.sizeBytes, safeNumber(existing?.sizeBytes)),
    notes: trimText(payload.notes) || trimText(existing?.notes),
    source: trimText(payload.source) || trimText(existing?.source) || "scan",
    createTime: trimText(existing?.createTime) || trimText(payload.createTime) || timestamp,
    updateTime: trimText(payload.updateTime) || timestamp
  };
}

function serializeAppPackage(record) {
  return clone({
    ...record,
    downloadPath: buildAppPackageDownloadPath(record.filename)
  });
}

function syncAppPackageState() {
  ensureDir(appPackageRoot);
  const diskFiles = fs
    .readdirSync(appPackageRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".apk"))
    .map((entry) => entry.name);
  const existingByFilename = new Map(
    (state.appPackages || []).map((item) => [trimText(item.filename), item]).filter(([filename]) => filename)
  );

  const nextPackages = diskFiles.map((filename) => {
    const targetFile = getAppPackageFilePath(filename);
    const stats = fs.statSync(targetFile);
    const existing = existingByFilename.get(filename) || null;
    const sizeBytes = safeNumber(stats.size);
    const checksum =
      existing && trimText(existing.checksum) && safeNumber(existing.sizeBytes) === sizeBytes
        ? trimText(existing.checksum)
        : calculateFileChecksum(targetFile);

    return normalizeAppPackageRecord(
      {
        ...(existing || {}),
        filename,
        originalName: trimText(existing?.originalName) || filename,
        platform: existing?.platform || inferAppPlatformFromFilename(filename),
        version: trimText(existing?.version) || inferAppVersionFromFilename(filename),
        checksum,
        sizeBytes,
        source: trimText(existing?.source) || "scan",
        createTime:
          trimText(existing?.createTime) || new Date(stats.birthtimeMs || stats.mtimeMs || Date.now()).toISOString(),
        updateTime: new Date(stats.mtimeMs || Date.now()).toISOString()
      },
      existing
    );
  });

  nextPackages.sort((left, right) => new Date(right.updateTime).getTime() - new Date(left.updateTime).getTime());

  const currentSerialized = JSON.stringify((state.appPackages || []).map(serializeAppPackage));
  const nextSerialized = JSON.stringify(nextPackages.map(serializeAppPackage));
  if (currentSerialized !== nextSerialized) {
    state.appPackages = nextPackages;
    persist();
  }

  return nextPackages;
}

function upsertTvScreen(payload = {}) {
  const normalized = normalizeTvScreenPayload(payload);
  if (!normalized.deviceId || normalized.screenNumber < 0 || normalized.screenNumber > TV_SCREEN_COUNT) {
    return null;
  }

  const existingByDevice = state.tvScreens.find((item) => trimText(item.deviceId) === normalized.deviceId) || null;
  const existingByScreen =
    normalized.screenNumber >= 1 && normalized.accountNamespace
      ? state.tvScreens.find(
          (item) =>
            normalizeScreenAccountNamespace(item.accountNamespace) === normalized.accountNamespace
            && Number(item.screenNumber) === normalized.screenNumber
        ) || null
      : null;
  const base =

    existingByDevice
    || (
      existingByScreen && trimText(existingByScreen.deviceId) === normalized.deviceId
        ? existingByScreen
        : null
    );
  const nextEntry = normalizeTvScreenPayload(payload, base, normalized.accountNamespace);

  if (!nextEntry.accountNamespace) {
    state.tvScreens = state.tvScreens.filter((item) => trimText(item.deviceId) !== nextEntry.deviceId);
    state.tvScreens.push(nextEntry);
    persist();
    return buildTvScreenSnapshot(nextEntry);
  }

  state.tvScreens = state.tvScreens.filter(
    (item) =>
      trimText(item.deviceId) !== nextEntry.deviceId &&
      (
        nextEntry.screenNumber < 1
        || !nextEntry.accountNamespace
        || normalizeScreenAccountNamespace(item.accountNamespace) !== nextEntry.accountNamespace
        || Number(item.screenNumber) !== nextEntry.screenNumber
      )
  );
  state.tvScreens.push(nextEntry);
  state.tvScreens.sort((left, right) => {
    const accountCompare = normalizeScreenAccountNamespace(left.accountNamespace).localeCompare(
      normalizeScreenAccountNamespace(right.accountNamespace)
    );
    if (accountCompare !== 0) {
      return accountCompare;
    }
    return Number(left.screenNumber) - Number(right.screenNumber);
  });
  persist();
  return buildTvScreenSnapshot(nextEntry);
}

function templateUid(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

function resolveActionName(actionId, fallbackName = "") {
  const text = trimText(fallbackName);
  if (text) {
    return text;
  }
  return state.actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

function normalizeWaterfallTemplateSection(kind, section = {}) {
  const title = kind === "cooldown" ? "冷身" : "热身";
  const items = Array.isArray(section.items) && section.items.length ? section.items : [{}];

  return {
    id: section.id || templateUid("template-section"),
    title,
    layout: "WATERFALL",
    items: items.map((item) => ({
      id: item.id || templateUid("template-waterfall"),
      actionId: String(item.actionId || ""),
      actionName: resolveActionName(item.actionId, item.actionName),
      seconds: Math.max(Number(item.seconds) || 0, 0),
      cue: ""
    }))
  };
}

function normalizeTemplateVideoGroup(videoGroup = {}) {
  const screenCount = Number(videoGroup.screenCount) === 1 ? 1 : 3;
  const rawScreens = Array.isArray(videoGroup.screens) ? videoGroup.screens : [];
  const normalizeRowLayouts = (rowLayouts) => {
    if (screenCount === 1) return [];
    const source = Array.isArray(rowLayouts) ? rowLayouts : [];
    if (!source.length) return [1, 1, 1];
    const rows = source.map((columns) => (Number(columns) === 2 ? 2 : 1));
    return rows.length === 3 && rows.every((columns) => columns === 2) ? [2, 2, 2, 2, 2] : rows;
  };
  const fitCardsForRows = (cards, rowLayouts) => {
    if (screenCount === 1) return cards.length ? cards : [{}];
    const capacity = rowLayouts.reduce((total, columns) => total + columns, 0);
    const nextCards = cards.slice(0, capacity);
    while (nextCards.length < capacity) {
      nextCards.push({});
    }
    return nextCards;
  };

  return {
    id: videoGroup.id || templateUid("template-group"),
    name: trimText(videoGroup.name) || (screenCount === 1 ? "单屏瀑布组" : "三屏视频组"),
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) => {
      const screenIndex = index + 1;
      const rawScreen = rawScreens.find((item) => Number(item.screenIndex) === screenIndex) || {};
      const rawCards = Array.isArray(rawScreen.videoCards) && rawScreen.videoCards.length ? rawScreen.videoCards : [{}];
      const rowLayouts = normalizeRowLayouts(rawScreen.rowLayouts);
      const videoCards = fitCardsForRows(rawCards, rowLayouts);

      return {
        id: rawScreen.id || templateUid("template-group-screen"),
        screenIndex,
        stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
        layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
        rowLayouts,
        videoCards: videoCards.map((card) => ({
          id: card.id || templateUid("template-video-card"),
          actionId: String(card.actionId || ""),
          actionName: resolveActionName(card.actionId, card.actionName),
          stationNumber: screenCount === 1 ? "" : trimText(card.stationNumber),
          target: trimText(card.target)
        }))
      };
    })
  };
}

function validateTemplatePayload(template) {
  const issues = [];

  if (!trimText(template.name)) {
    issues.push("模板名称不能为空。");
  }

  if (template.kind === "course") {
    if (!numberList(template.coursePackageIds).length) {
      issues.push("整节课程模板至少需要选择一个课程包。");
    }
    if (!trimText(template.courseName)) {
      issues.push("整节课程模板必须包含默认课程名称。");
    }
    if (!template.script || typeof template.script !== "object") {
      issues.push("整节课程模板必须包含课程脚本。");
    }
    return issues;
  }

  if (template.kind === "warmup" || template.kind === "cooldown") {
    const section = template.section;
    if (!section?.items?.length) {
      issues.push("模板至少需要一个动作。");
      return issues;
    }

    section.items.forEach((item, index) => {
      if (!item.actionId) {
        issues.push(`模板第 ${index + 1} 个动作还没有选择动作。`);
      }
      if (Number(item.seconds) <= 0) {
        issues.push(`模板第 ${index + 1} 个动作时长必须大于 0。`);
      }
    });

    return issues;
  }

  const videoGroup = template.videoGroup;
  if (!videoGroup) {
    issues.push("正式组模板不能为空。");
    return issues;
  }

  let videoGroupActiveCardCount = 0;
  videoGroup.screens.forEach((screen) => {
    const activeCards = screen.videoCards.filter(
      (card) => card.actionId || card.actionName || trimText(card.stationNumber)
    );
    videoGroupActiveCardCount += activeCards.length;
    if (videoGroup.screenCount === 1 && !activeCards.length) {
      issues.push(`屏幕 ${screen.screenIndex} 至少需要一个动作卡片。`);
    }
    if (videoGroup.screenCount !== 1) {
      const stationCodes = activeCards.map((card) => trimText(card.stationNumber));
      if (stationCodes.some((code) => !code)) {
        issues.push(`屏幕 ${screen.screenIndex} 的站点标签不能为空。`);
      }
      if (new Set(stationCodes).size !== stationCodes.length) {
        issues.push(`屏幕 ${screen.screenIndex} 的站点标签不能重复。`);
      }
    }
  });
  if (videoGroup.screenCount !== 1 && videoGroupActiveCardCount <= 0) {
    issues.push("三屏模板至少需要一个屏幕有动作卡片。");
  }

  return issues;
}

function clonePlainObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : clone(fallback);
}

function normalizeCourseTemplatePackageIds(payload = {}, existing = null) {
  const source =
    payload.coursePackageIds !== undefined
      ? payload.coursePackageIds
      : payload.coursePackageId !== undefined
        ? [payload.coursePackageId]
        : existing?.coursePackageIds !== undefined
          ? existing.coursePackageIds
          : existing?.coursePackageId !== undefined
            ? [existing.coursePackageId]
            : [];
  return numberList(source);
}

function normalizeTemplateCoursePackageIds(payload = {}, existing = null) {
  return normalizeCourseTemplatePackageIds(payload, existing);
}

function normalizeCoursePackageLookupText(value = "") {
  return trimText(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function compactCoursePackageLookupText(value = "") {
  return normalizeCoursePackageLookupText(value).replace(/\s+/g, "");
}

function findCoursePackageIdByNameCandidates(candidates = [], coursePackages = null) {
  const packages = Array.isArray(coursePackages) ? coursePackages : state.coursePackages || [];
  const normalizedCandidates = candidates.map(normalizeCoursePackageLookupText).filter(Boolean);
  const compactCandidates = candidates.map(compactCoursePackageLookupText).filter(Boolean);

  for (const coursePackage of packages) {
    const id = normalizeCoursePackageId(coursePackage?.id, 0);
    const name = normalizeCoursePackageLookupText(coursePackage?.name);
    const compactName = compactCoursePackageLookupText(coursePackage?.name);
    if (!id || !name) {
      continue;
    }
    if (normalizedCandidates.includes(name) || compactCandidates.includes(compactName)) {
      return id;
    }
  }

  for (const coursePackage of packages) {
    const id = normalizeCoursePackageId(coursePackage?.id, 0);
    const name = normalizeCoursePackageLookupText(coursePackage?.name);
    const compactName = compactCoursePackageLookupText(coursePackage?.name);
    if (!id || !name) {
      continue;
    }
    if (
      normalizedCandidates.some((candidate) => name.includes(candidate))
      || compactCandidates.some((candidate) => compactName.includes(candidate))
    ) {
      return id;
    }
  }

  return 0;
}

function getDefaultOrHybridCoursePackageId(coursePackages = null, fallbackId = 0) {
  return (
    findCoursePackageIdByNameCandidates(["Hybrid", "default", DEFAULT_COURSE_PACKAGE_NAME], coursePackages)
    || normalizeCoursePackageId(fallbackId, 0)
    || getDefaultCoursePackageId()
  );
}

function getTwelveRoundCoursePackageId(coursePackages = null, fallbackId = 0) {
  return (
    findCoursePackageIdByNameCandidates(["12round", "12 round"], coursePackages)
    || getDefaultOrHybridCoursePackageId(coursePackages, fallbackId)
  );
}

function getTemplateFallbackCoursePackageIds(template = {}, coursePackages = null, fallbackId = 0) {
  const normalizedName = normalizeCoursePackageLookupText(template.name);
  const packageId =
    template.kind === "warmup" && (normalizedName.includes("boxing") || normalizedName.includes("box warmup"))
      ? getTwelveRoundCoursePackageId(coursePackages, fallbackId)
      : getDefaultOrHybridCoursePackageId(coursePackages, fallbackId);
  return packageId ? [packageId] : [];
}

function normalizeLoadedTemplateCoursePackageIds(template = {}, coursePackages = null, fallbackId = 0) {
  const raw = template && typeof template === "object" ? template : {};
  const explicitIds = normalizeTemplateCoursePackageIds(raw);
  const validIds = new Set((Array.isArray(coursePackages) ? coursePackages : state.coursePackages || [])
    .map((item) => normalizeCoursePackageId(item.id, 0))
    .filter(Boolean));
  const coursePackageIds = explicitIds.filter((id) => validIds.has(id));

  return {
    ...raw,
    coursePackageIds: coursePackageIds.length
      ? coursePackageIds
      : getTemplateFallbackCoursePackageIds(raw, coursePackages, fallbackId)
  };
}

function normalizeTemplateSourceCourseId(value, fallback = null) {
  const source = value !== undefined ? value : fallback;
  const numeric = Number(source);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeCourseTemplateName(payload = {}, existing = null) {
  const source =
    payload.courseName
    ?? existing?.courseName
    ?? payload.script?.metadata?.name
    ?? existing?.script?.metadata?.name
    ?? payload.name
    ?? existing?.name;
  return trimText(source);
}

function normalizeCourseTemplatePayload(payload = {}, existing = null, base = {}) {
  const script = cloneCourseScript(payload.script ?? existing?.script ?? {});
  const typeIds = numberList(payload.typeIds ?? existing?.typeIds);
  const description = trimText(payload.description ?? script.metadata?.description ?? existing?.description);
  const topic = trimText(payload.topic ?? script.metadata?.topic ?? existing?.topic)
    || deriveCourseTopicFromTypeIds(typeIds);
  const rotationType = normalizeCourseRotationType(
    payload.rotationType ?? script.metadata?.rotationType ?? existing?.rotationType
  );
  const courseName = normalizeCourseTemplateName(payload, existing);
  script.metadata = {
    ...script.metadata,
    name: courseName || script.metadata?.name || trimText(payload.name) || existing?.name || "新课程",
    description,
    topic,
    rotationType
  };

  return {
    ...(existing?.kind === "course" ? existing : {}),
    ...base,
    description: script.metadata.description,
    topic: script.metadata.topic,
    rotationType: script.metadata.rotationType,
    courseName,
    coursePackageIds: normalizeCourseTemplatePackageIds(payload, existing),
    typeIds,
    logoMedia: payload.logoMedia !== undefined ? clone(payload.logoMedia) : existing?.logoMedia ?? null,
    script,
    summary: clonePlainObject(payload.summary ?? existing?.summary),
    sourceCourseId: normalizeTemplateSourceCourseId(payload.sourceCourseId, existing?.sourceCourseId)
  };
}

function normalizeTemplatePayload(payload = {}, existing = null) {
  const kind = ["warmup", "cooldown", "training", "course"].includes(payload.kind) ? payload.kind : existing?.kind;
  if (!kind) {
    throw new Error("模板类型无效。");
  }

  const timestamp = nowIso();
  const base = {
    id: existing?.id ?? nextId(state.templates),
    kind,
    name: trimText(payload.name),
    coursePackageIds: normalizeTemplateCoursePackageIds(payload, existing),
    createTime: existing?.createTime ?? timestamp,
    updateTime: timestamp
  };

  const next =
    kind === "course"
      ? normalizeCourseTemplatePayload(payload, existing, base)
      : kind === "training"
      ? {
          ...base,
          videoGroup: normalizeTemplateVideoGroup(payload.videoGroup ?? existing?.videoGroup ?? {})
        }
      : {
          ...base,
          section: normalizeWaterfallTemplateSection(kind, payload.section ?? existing?.section ?? {})
        };

  const issues = validateTemplatePayload(next);
  if (issues.length) {
    throw new Error(issues.join("\n"));
  }

  return next;
}

function getCourseTemplatePackageIds(template = {}) {
  const packageIds = numberList(
    template.coursePackageIds !== undefined
      ? template.coursePackageIds
      : template.coursePackageId !== undefined
        ? [template.coursePackageId]
        : []
  );
  return packageIds.length ? packageIds : getTemplateFallbackCoursePackageIds(template);
}

function templateAllowsUser(template = {}, user = null) {
  if (!user) {
    return false;
  }

  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  if (!visiblePackageIds) {
    return true;
  }

  const templatePackageIds = getCourseTemplatePackageIds(template);
  return templatePackageIds.some((id) => visiblePackageIds.has(id));
}

function assertCanSaveTemplate(template = {}, user = null) {
  if (!user) {
    throw new Error("登录后才能保存模板。");
  }

  const templatePackageIds = getCourseTemplatePackageIds(template);
  const existingPackageIds = new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id, 0)));
  const missingPackageIds = templatePackageIds.filter((id) => !existingPackageIds.has(id));
  if (missingPackageIds.length) {
    throw new Error("课程包不存在。");
  }

  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  if (visiblePackageIds && templatePackageIds.some((id) => !visiblePackageIds.has(id))) {
    throw new Error("当前账号不能保存其它课程包下的模板。");
  }
}

function serializeTemplate(template) {
  const next = clone(template);
  const packageIds = getCourseTemplatePackageIds(next);
  next.coursePackageIds = packageIds;
  next.coursePackageId = packageIds[0] || null;
  if (next.kind === "course") {
    next.courseName = normalizeCourseTemplateName(next, next) || next.name || "";
    const typeIds = numberList(next.typeIds);
    next.description = trimText(next.script?.metadata?.description ?? next.description);
    next.topic = trimText(next.script?.metadata?.topic ?? next.topic) || deriveCourseTopicFromTypeIds(typeIds);
    next.rotationType = normalizeCourseRotationType(next.script?.metadata?.rotationType ?? next.rotationType);
    next.script = cloneCourseScript(next.script || {});
    next.script.metadata = {
      ...next.script.metadata,
      name: next.courseName,
      description: next.description,
      topic: next.topic,
      rotationType: next.rotationType
    };
  }
  return next;
}

function listTemplatesByKind(kind, user = null) {
  return sortByNewest(
    state.templates.filter((item) => item.kind === kind && templateAllowsUser(item, user)),
    "updateTime"
  ).map(serializeTemplate);
}

function defaultHydrateSecondsFromCourse(course) {
  const rawValue = course?.script?.metadata?.defaultHydrateSeconds ?? course?.metadata?.defaultHydrateSeconds;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function pickTextField(source = {}, field) {
  if (Object.prototype.hasOwnProperty.call(source, field)) {
    return trimText(source[field]);
  }
  if (Object.prototype.hasOwnProperty.call(source?.metadata || {}, field)) {
    return trimText(source.metadata[field]);
  }
  if (Object.prototype.hasOwnProperty.call(source?.script?.metadata || {}, field)) {
    return trimText(source.script.metadata[field]);
  }
  return null;
}

function normalizeCourseRotationType(value) {
  const text = trimText(value).toUpperCase();
  return ["REGION", "LANE", "SNAKE"].includes(text) ? text : "REGION";
}

function courseStationRuleFields() {
  return ["set", "work", "rest", "switch", "port", "leader"];
}

function courseStationRuleAliases(field) {
  const aliases = {
    set: ["set", "Set"],
    work: ["work", "Work"],
    rest: ["rest", "Rest"],
    switch: ["switch", "Switch"],
    port: ["port", "Port"],
    leader: ["leader", "Leader"]
  };
  return aliases[field] || [field];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickCourseStationRuleValue(source = {}, field) {
  const aliases = courseStationRuleAliases(field);
  const containers = [
    source,
    source?.stationRules,
    source?.siteRules,
    source?.metadata,
    source?.metadata?.stationRules,
    source?.metadata?.siteRules,
    source?.script?.metadata,
    source?.script?.metadata?.stationRules,
    source?.script?.metadata?.siteRules
  ];

  for (const container of containers) {
    if (!isPlainObject(container)) {
      continue;
    }
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(container, alias)) {
        return trimText(container[alias]);
      }
    }
  }

  return null;
}

function collectCourseStationRules(source = {}) {
  return courseStationRuleFields().reduce((rules, field) => {
    const value = pickCourseStationRuleValue(source, field);
    if (value !== null) {
      rules[field] = value;
    }
    return rules;
  }, {});
}

function hasCourseStationRuleValues(rules = {}) {
  return courseStationRuleFields().some((field) => Boolean(trimText(rules[field])));
}

function addUniqueCourseSeconds(values, value) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0 && !values.includes(seconds)) {
    values.push(seconds);
  }
}

function formatCourseSecondsList(values = []) {
  return values.length ? values.map((seconds) => `${seconds}s`).join("/") : "";
}

function deriveCourseSwitchRule(rotationType) {
  const normalized = normalizeCourseRotationType(rotationType);
  if (normalized === "LANE") {
    return "range";
  }
  if (normalized === "SNAKE") {
    return "follow the leader";
  }
  return "pod";
}

function resolveCourseRuleScript(source) {
  if (source?.training?.pods && source?.training?.videoGroups) {
    return source;
  }
  if (source?.script?.training?.pods && source?.script?.training?.videoGroups) {
    return source.script;
  }
  return null;
}

function deriveCourseStationRules(source = {}) {
  const script = resolveCourseRuleScript(source);
  if (!script) {
    return normalizeCourseStationRules();
  }

  const videoGroups = Array.isArray(script.training?.videoGroups) ? script.training.videoGroups : [];
  const groupById = new Map(videoGroups.map((group) => [group?.id, group]));
  const pods = Array.isArray(script.training?.pods) ? script.training.pods : [];
  const threeScreenPods = pods.filter((pod) => Number(groupById.get(pod?.videoGroupId)?.screenCount) === 3);
  const workSeconds = [];
  const restSeconds = [];
  const setCount = threeScreenPods.reduce((total, pod) => {
    const screens = Array.isArray(pod?.screens) ? pod.screens : [];
    const firstScreen = screens.find((screen) => Number(screen?.screenIndex) === 1) || screens[0] || null;
    for (const screen of screens) {
      addUniqueCourseSeconds(restSeconds, screen?.stationRestSeconds);
      for (const setConfig of Array.isArray(screen?.setConfigs) ? screen.setConfigs : []) {
        addUniqueCourseSeconds(workSeconds, setConfig?.workSeconds);
        addUniqueCourseSeconds(restSeconds, setConfig?.restSeconds);
      }
    }
    return total + Math.max(Number(firstScreen?.loopCount) || 0, 0);
  }, 0);

  return {
    set: setCount > 0 ? String(setCount) : "",
    work: formatCourseSecondsList(workSeconds),
    rest: formatCourseSecondsList(restSeconds),
    switch: deriveCourseSwitchRule(script.metadata?.rotationType || source?.rotationType),
    port: "",
    leader: ""
  };
}

function normalizeCourseStationRules(...sources) {
  const rules = courseStationRuleFields().reduce((current, field) => {
    current[field] = "";
    return current;
  }, {});
  const switchRule = deriveCourseSwitchRuleFromSources(sources);
  for (const source of sources) {
    Object.assign(rules, collectCourseStationRules(source));
  }
  if (hasCourseStationRuleValues(rules)) {
    return {
      ...rules,
      switch: switchRule
    };
  }

  for (const source of sources) {
    const derived = deriveCourseStationRules(source);
    if (hasCourseStationRuleValues(derived)) {
      return {
        ...rules,
        ...derived,
        switch: switchRule
      };
    }
  }
  return {
    ...rules,
    switch: switchRule
  };
}

function deriveCourseSwitchRuleFromSources(sources = []) {
  for (const source of sources) {
    const script = resolveCourseRuleScript(source);
    const rotationType =
      script?.metadata?.rotationType
      ?? source?.rotationType
      ?? source?.metadata?.rotationType
      ?? source?.script?.metadata?.rotationType;
    if (rotationType) {
      return deriveCourseSwitchRule(rotationType);
    }
  }
  return deriveCourseSwitchRule();
}

function normalizeCourseTopLevelMetadata(source = {}, stationRules = normalizeCourseStationRules(source)) {
  return {
    ...(isPlainObject(source?.metadata) ? clone(source.metadata) : {}),
    stationRules
  };
}

function deriveCourseTopicFromTypeIds(typeIds = []) {
  const firstTypeId = numberList(typeIds)[0];
  if (!firstTypeId || !Array.isArray(state.lessonTypes)) {
    return "";
  }
  return trimText(state.lessonTypes.find((item) => Number(item.id) === firstTypeId)?.name);
}

function deriveCourseMetadataFields(source = {}, script = {}) {
  const description = pickTextField(source, "description");
  const topic = pickTextField(source, "topic");
  const rotationType = pickTextField(source, "rotationType");
  const typeIds = source.typeIds ?? script?.typeIds ?? [];

  return {
    description: description ?? "",
    topic: topic ?? deriveCourseTopicFromTypeIds(typeIds),
    rotationType: normalizeCourseRotationType(rotationType ?? script?.metadata?.rotationType)
  };
}

function deriveTrainingPanel(source = {}, script) {
  const incoming = source?.script?.metadata?.trainingPanel || source?.metadata?.trainingPanel || {};
  const podCount = Array.isArray(script?.training?.pods) ? script.training.pods.length : 0;
  const breakCount = Array.isArray(script?.training?.pods)
    ? script.training.pods.filter((pod) => pod?.ending === "HYDRATE").length
    : 0;

  return createTrainingPanel({
    setCount: podCount || Number(incoming.setCount) || Number(source?.totalTime) || 1,
    breakCount,
    workSeconds: Number(incoming.workSeconds) || Number(source?.trainingTime) || 40,
    restSeconds:
      Number.isFinite(Number(incoming.restSeconds)) && Number(incoming.restSeconds) >= 0
        ? Number(incoming.restSeconds)
        : Math.max(Number(source?.restTime) || 20, 0)
  });
}

function coerceCourseScript(source = {}) {
  const script = source?.script
    ? cloneCourseScript(source.script)
    : legacyCourseToScript(source, { actionLookup: state.actions });
  const metadataFields = deriveCourseMetadataFields(source, script);
  script.metadata = {
    ...script.metadata,
    rotationType: metadataFields.rotationType
  };
  const stationRules = normalizeCourseStationRules(source, script);

  script.metadata = {
    ...script.metadata,
    name: trimText(source.name) || script.metadata?.name || "新课程",
    version: trimText(source.version) || script.metadata?.version || "v1.0.0",
    creator: trimText(source.creator) || script.metadata?.creator || "",
    description: metadataFields.description,
    topic: metadataFields.topic,
    rotationType: metadataFields.rotationType,
    defaultHydrateSeconds: defaultHydrateSecondsFromCourse(source),
    readyDurations: normalizeReadyDurations(source?.script?.metadata?.readyDurations || script.metadata?.readyDurations),
    trainingPanel: deriveTrainingPanel(source, script),
    stationRules
  };
  script.plan = normalizeCoursePlan(source?.script?.plan || source?.plan || script.plan);

  return script;
}

function syncCourseStationRules() {
  if (!Array.isArray(state.courses) || !state.courses.length) {
    return;
  }

  let changed = false;
  state.courses = state.courses.map((course) => {
    const script = coerceCourseScript(course);
    const stationRules = normalizeCourseStationRules(course, script);
    const metadata = normalizeCourseTopLevelMetadata(course, stationRules);
    const nextScript = {
      ...script,
      metadata: {
        ...script.metadata,
        stationRules
      }
    };
    const next = {
      ...course,
      metadata,
      stationRules,
      script: nextScript
    };
    if (
      JSON.stringify(course.stationRules || null) !== JSON.stringify(stationRules)
      || JSON.stringify(course.metadata?.stationRules || null) !== JSON.stringify(stationRules)
      || JSON.stringify(course.script?.metadata?.stationRules || null) !== JSON.stringify(stationRules)
    ) {
      changed = true;
    }
    return next;
  });

  if (changed) {
    persist();
  }
}

function courseSummaryFromScript(script) {
  const summary = summarizeCourseScript(script);
  const videoCards = (script.training?.videoGroups || []).reduce(
    (total, group) =>
      total +
      (group.screens || []).reduce((screenTotal, screen) => screenTotal + (screen.videoCards || []).length, 0),
    0
  );

  return {
    ...summary,
    warmupActionCount: script.sections?.warmup?.items?.length || 0,
    cooldownActionCount: script.sections?.cooldown?.items?.length || 0,
    trainingCardCount: videoCards
  };
}

function hasWaterfallPlaybackItems(section) {
  return Array.isArray(section?.items) && section.items.length > 0;
}

function hasTrainingPlaybackPods(script) {
  return Array.isArray(script?.training?.pods) && script.training.pods.length > 0;
}

function estimateCoursePlaybackDurationMs(script) {
  if (!script || typeof script !== "object") {
    return 0;
  }

  const summary = summarizeCourseScript(script);
  const readyDurations = normalizeReadyDurations(script.metadata?.readyDurations);
  const readySeconds =
    (hasWaterfallPlaybackItems(script.sections?.warmup) ? readyDurations.warmupSeconds : 0)
    + (hasTrainingPlaybackPods(script) ? readyDurations.workoutSeconds : 0)
    + (hasWaterfallPlaybackItems(script.sections?.cooldown) ? readyDurations.cooldownSeconds : 0);
  const totalSeconds = safeNumber(summary.totalSeconds) + readySeconds;
  return totalSeconds > 0 ? totalSeconds * 1000 : 0;
}

function normalizeCoursePayload(payload = {}, existing = null) {
  const timestamp = nowIso();
  const source = {
    ...(existing || {}),
    ...payload
  };
  const stationRules = normalizeCourseStationRules(existing || {}, payload || {});
  const metadata = normalizeCourseTopLevelMetadata(source, stationRules);
  const script = coerceCourseScript({
    ...source,
    metadata,
    stationRules
  });
  const issues = validateCourseScript(script);

  if (issues.length) {
    throw new Error(issues.join("\n"));
  }
  const ownerUsername = trimText(payload.ownerUsername ?? payload.author ?? existing?.ownerUsername ?? existing?.author);

  return {
    id: existing?.id ?? nextId(state.courses),
    name: trimText(payload.name) || script.metadata.name,
    creator: trimText(payload.creator) || script.metadata.creator,
    author: trimText(payload.author ?? existing?.author) || ownerUsername,
    ownerUsername,
    version: trimText(payload.version) || script.metadata.version,
    description: script.metadata.description,
    topic: script.metadata.topic,
    rotationType: script.metadata.rotationType,
    typeIds: numberList(payload.typeIds ?? existing?.typeIds),
    coursePackageId: normalizeCoursePackageId(payload.coursePackageId ?? existing?.coursePackageId, 0),
    logoMedia: payload.logoMedia ?? existing?.logoMedia ?? null,
    metadata,
    stationRules,
    script,
    summary: courseSummaryFromScript(script),
    updateTime: timestamp
  };
}

function serializeCourse(course) {
  const script = coerceCourseScript(course);
  const stationRules = normalizeCourseStationRules(course, script);
  const metadata = normalizeCourseTopLevelMetadata(course, stationRules);
  script.metadata = {
    ...script.metadata,
    stationRules
  };
  return {
    ...course,
    name: trimText(course.name) || script.metadata.name,
    creator: trimText(course.creator) || script.metadata.creator,
    author: trimText(course.author || course.ownerUsername),
    ownerUsername: trimText(course.ownerUsername || course.author),
    version: trimText(course.version) || script.metadata.version,
    description: script.metadata.description,
    topic: script.metadata.topic,
    rotationType: script.metadata.rotationType,
    typeIds: numberList(course.typeIds),
    logoMedia: course.logoMedia ?? null,
    metadata,
    stationRules,
    script,
    summary: course.summary || courseSummaryFromScript(script)
  };
}

function serializeCourseSummary(course) {
  const serialized = serializeCourse(course);
  return {
    id: serialized.id,
    name: serialized.name,
    creator: serialized.creator,
    author: serialized.author,
    ownerUsername: serialized.ownerUsername,
    version: serialized.version,
    description: serialized.description,
    topic: serialized.topic,
    rotationType: serialized.rotationType,
    stationRules: serialized.stationRules,
    typeIds: serialized.typeIds,
    logoMedia: serialized.logoMedia,
    summary: serialized.summary,
    updateTime: serialized.updateTime,
    coursePackageId: normalizeCoursePackageId(serialized.coursePackageId, 0)
  };
}

function attachCourseBasics(schedule) {
  const course = state.courses.find((item) => item.id === schedule.courseId);
  const serialized = course ? serializeCourse(course) : null;
  const { venueId: _venueId, ...rest } = schedule || {};
  const courseDeleted = Boolean(rest.courseId) && !serialized;
  return {
    ...rest,
    date: rest.date || (rest.beginTime ? formatCalendarDate(rest.beginTime) : ""),
    courseDeleted,
    coursePackageId: normalizeCoursePackageId(rest.coursePackageId),
    courseName: serialized?.name || (courseDeleted ? "课程已删除" : trimText(rest.courseName)),
    version: rest.version || serialized?.version || "",
    description: serialized?.description || "",
    topic: serialized?.topic || "",
    rotationType: serialized?.rotationType || "REGION",
    stationRules: serialized?.stationRules || normalizeCourseStationRules()
  };
}

function hashValue(value) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function normalizeCalendarDate(dateText, timeZone = "Asia/Shanghai") {
  if (typeof dateText === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateText.trim())) {
    return dateText.trim();
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function calendarDateStartIso(dateText) {
  const normalized = trimText(dateText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }
  return new Date(`${normalized}T00:00:00.000+08:00`).toISOString();
}

function normalizeScheduleBeginTimePayload(payload = {}) {
  const dateText = trimText(payload.date);
  if (dateText) {
    return calendarDateStartIso(dateText);
  }

  const beginTime = trimText(payload.beginTime);
  if (/^\d{4}-\d{2}-\d{2}$/.test(beginTime)) {
    return calendarDateStartIso(beginTime);
  }
  return beginTime;
}

function formatCalendarDate(dateValue, timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));
}

function addCalendarDays(dateText, days) {
  const base = new Date(`${dateText}T12:00:00.000+08:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatCalendarDate(base, "Asia/Shanghai");
}

function getCalendarWeekRange(weekOffset = 0, timeZone = "Asia/Shanghai") {
  const today = formatCalendarDate(new Date(), timeZone);
  const anchor = new Date(`${today}T12:00:00.000+08:00`);
  const day = anchor.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  anchor.setUTCDate(anchor.getUTCDate() + delta + weekOffset * 7);
  const start = formatCalendarDate(anchor, timeZone);
  return { start, end: addCalendarDays(start, 7) };
}

function inCalendarDateRange(dateValue, startDate, endDate, timeZone = "Asia/Shanghai") {
  const dateKey = formatCalendarDate(dateValue, timeZone);
  return dateKey >= startDate && dateKey < endDate;
}

function listSchedulesByDate(dateText, timeZone = "Asia/Shanghai") {
  const targetDate = normalizeCalendarDate(dateText, timeZone);

  return state.schedules
    .map(attachCourseBasics)
    .filter((item) => formatCalendarDate(item.beginTime, timeZone) === targetDate)
    .sort((left, right) => new Date(left.beginTime).getTime() - new Date(right.beginTime).getTime());
}

function buildActionMediaMap() {
  return new Map(state.actions.map((action) => [String(action.id), action?.media || null]));
}

function resolveMediaUrl(actionId, fallbackUrl = "") {
  const fallback = trimText(fallbackUrl);
  if (fallback) {
    return fallback;
  }

  return trimText(buildActionMediaMap().get(String(actionId))?.url);
}

function resolveScriptMediaUrls(script) {
  const actionMediaMap = buildActionMediaMap();
  const next = cloneCourseScript(script);
  const resolveUrl = (actionId, fallbackUrl = "") => trimText(actionMediaMap.get(String(actionId))?.url) || trimText(fallbackUrl);

  if (Array.isArray(next?.sections?.warmup?.items)) {
    next.sections.warmup.items = next.sections.warmup.items.map((item) => ({
      ...item,
      mediaUrl: resolveUrl(item?.actionId, item?.mediaUrl)
    }));
  }

  if (Array.isArray(next?.sections?.cooldown?.items)) {
    next.sections.cooldown.items = next.sections.cooldown.items.map((item) => ({
      ...item,
      mediaUrl: resolveUrl(item?.actionId, item?.mediaUrl)
    }));
  }

  if (Array.isArray(next?.training?.videoGroups)) {
    next.training.videoGroups = next.training.videoGroups.map((group) => ({
      ...group,
      screens: Array.isArray(group?.screens)
        ? group.screens.map((screen) => ({
            ...screen,
            videoCards: Array.isArray(screen?.videoCards)
              ? screen.videoCards.map((card) => ({
                  ...card,
                  mediaUrl: resolveUrl(card?.actionId, card?.mediaUrl)
                }))
              : []
          }))
        : []
    }));
  }

  return next;
}

function collectScriptResources(script) {
  const resources = [];
  const seen = new Set();
  const actionMediaMap = buildActionMediaMap();
  const mediaByUrl = new Map(
    state.media
      .filter((item) => trimText(item?.url))
      .map((item) => [trimText(item.url), item])
  );

  const pushResource = (url, actionId = "", actionName = "") => {
    const trimmedUrl = trimText(url);
    if (!trimmedUrl || seen.has(trimmedUrl)) {
      return;
    }
    seen.add(trimmedUrl);

    const safeUrl = trimmedUrl.split("?")[0];
    const filename = path.basename(safeUrl) || "video.mp4";
    const extension = path.extname(filename) || ".mp4";
    const actionMedia = actionMediaMap.get(String(actionId || "")) || null;
    const mediaRecord = actionMedia?.url === trimmedUrl ? actionMedia : mediaByUrl.get(trimmedUrl) || null;
    const checksum = trimText(mediaRecord?.checksum);
    const key = checksum || hashValue({ url: trimmedUrl, actionId: String(actionId || "") });

    resources.push({
      key,
      url: trimmedUrl,
      filename,
      extension,
      actionId: String(actionId || ""),
      actionName: trimText(actionName),
      kind: "video",
      checksum,
      sizeBytes: safeNumber(mediaRecord?.sizeBytes)
    });
  };

  for (const item of script?.sections?.warmup?.items || []) {
    pushResource(item?.mediaUrl, item?.actionId, item?.actionName);
  }

  for (const item of script?.sections?.cooldown?.items || []) {
    pushResource(item?.mediaUrl, item?.actionId, item?.actionName);
  }

  for (const group of script?.training?.videoGroups || []) {
    for (const screen of group?.screens || []) {
      for (const card of screen?.videoCards || []) {
        pushResource(card?.mediaUrl, card?.actionId, card?.actionName);
      }
    }
  }

  return resources;
}

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

function inRange(dateValue, from, to) {
  const target = new Date(dateValue).getTime();
  return target >= from.getTime() && target < to.getTime();
}

export function getMediaRoot() {
  return mediaRoot;
}

export function getAppPackageRoot() {
  return appPackageRoot;
}

export function createAppPackageFilename(platform = "tv", version = "", originalName = "app.apk") {
  return createAppPackageStoredName(platform, version, originalName);
}

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

export function listAppPackages(platform = "") {
  const safePlatform = trimText(platform).toLowerCase();
  return sortByNewest(
    syncAppPackageState().filter((item) => !safePlatform || item.platform === normalizeAppPlatform(safePlatform)),
    "updateTime"
  ).map(serializeAppPackage);
}

export function getAppPackageById(packageId) {
  syncAppPackageState();
  const targetId = Number(packageId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return null;
  }
  const record = (state.appPackages || []).find((item) => item.id === targetId) || null;
  return record ? serializeAppPackage(record) : null;
}

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

export function rescanAppPackages() {
  return listAppPackages();
}

export function getMediaRecord(filename) {
  return state.media.find((item) => item.filename === filename) ?? null;
}

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

export function listActionTypes(user = null, options = {}) {
  return clone(
    state.actionTypes
      .map(normalizeActionTypeRecord)
      .filter((type) => actionTypeAllowsUser(type, user))
      .filter((type) => actionTypeMatchesCoursePackageScope(type, options))
  );
}

export function listUsers() {
  return clone(state.users).map(publicUserInfo);
}

export function getUserByUsername(username) {
  return state.users.find((item) => item.username === trimText(username)) ?? null;
}

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

export function isSuperAdminUser(user) {

  return Boolean(user) && (trimText(user.role) === "superadmin" || SUPERADMIN_USERNAMES.has(trimText(user.username)));
}

export function listVenues() {
  return clone(state.venues || []).sort((left, right) => {
    const leftTime = new Date(left.updateTime || left.createTime || 0).getTime();
    const rightTime = new Date(right.updateTime || right.createTime || 0).getTime();
    return rightTime - leftTime;
  });
}

export function getVenueById(venueId) {
  const id = trimText(venueId);
  return (state.venues || []).find((item) => trimText(item.id) === id) ?? null;
}

export function getVenueByAccountNamespace(accountNamespace) {
  const ns = normalizeAccountNamespace(accountNamespace);
  return (state.venues || []).find((item) => normalizeAccountNamespace(item.accountNamespace) === ns) ?? null;
}

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

export function listVenueUsers(venueId) {
  const id = trimText(venueId);
  return clone(state.users || [])
    .filter((user) => trimText(user.venueId) === id)
    .map(publicUserInfo)
    .sort((left, right) => left.username.localeCompare(right.username));
}

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

export function listAdminConsoleUsers(query = "") {
  const q = trimText(query);
  const users = clone(state.users || [])
    .filter((user) => trimText(user.userType) === "CONSOLE")
    .map(publicUserInfo);
  return users
    .filter((user) => (q ? String(user.username || "").includes(q) : true))
    .sort((left, right) => String(left.username).localeCompare(String(right.username)));
}

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

export function getUserByAccessToken(accessToken) {
  cleanupExpiredSessions();
  const session = state.authSessions.find((item) => item.accessToken === trimText(accessToken));
  if (!session || !isFutureTime(session.expiresAt)) {
    return null;
  }

  const user = state.users.find((item) => item.id === session.userId);
  return user ? publicUserInfo(user) : null;
}

function actionTypeAllowsUser(type = {}, user = null) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  if (!visiblePackageIds) {
    return true;
  }

  const packageIds = numberList(type.coursePackageIds);
  if (!packageIds.length) {
    return visiblePackageIds.has(getDefaultCoursePackageId());
  }
  return packageIds.some((id) => visiblePackageIds.has(id));
}

function scopedRecordBelongsToCoursePackage(record = {}, coursePackageId = 0) {
  const scopedPackageId = normalizeCoursePackageId(coursePackageId, 0);
  if (scopedPackageId <= 0) {
    return true;
  }

  const packageIds = numberList(record.coursePackageIds);
  if (!packageIds.length) {
    return scopedPackageId === getDefaultCoursePackageId();
  }
  return packageIds.includes(scopedPackageId);
}

function actionTypeMatchesCoursePackageScope(type = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(type, options?.coursePackageId);
}

function lessonTypeAllowsUser(type = {}, user = null) {
  return actionTypeAllowsUser(type, user);
}

function lessonTypeMatchesCoursePackageScope(type = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(type, options?.coursePackageId);
}

function actionMatchesCoursePackageScope(action = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(action, options?.coursePackageId);
}

export function addActionType(payload, user = null) {
  const source = typeof payload === "string" ? { name: payload } : payload || {};
  const name = stripMediaSuffix(source.name);
  const requestedPackageIds = numberList(source.coursePackageIds);
  const packageIds = resolveWriteCoursePackageIds(user, requestedPackageIds, []);
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

export function listLessonTypes(user = null, options = {}) {
  return clone(
    state.lessonTypes
      .map(normalizeActionTypeRecord)
      .filter((type) => lessonTypeAllowsUser(type, user))
      .filter((type) => lessonTypeMatchesCoursePackageScope(type, options))
  );
}

export function addLessonType(payload, user = null) {
  const source = typeof payload === "string" ? { name: payload } : payload || {};
  const name = stripMediaSuffix(source.name);
  const requestedPackageIds = numberList(source.coursePackageIds);
  const packageIds = resolveWriteCoursePackageIds(user, requestedPackageIds, []);
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

function courseTypeTagsFromTypeIds(typeIds = []) {
  const ids = new Set(numberList(typeIds));
  return normalizeCourseTags(
    (state.lessonTypes || [])
      .filter((type) => ids.has(Number(type.id)))
      .map((type) => type.name)
  );
}

function collectActionIdsFromCourseScript(script = {}) {
  const ids = new Set();
  const add = (value) => {
    const id = trimText(String(value ?? ""));
    if (id) {
      ids.add(id);
    }
  };

  for (const item of script?.sections?.warmup?.items || []) {
    add(item?.actionId);
  }
  for (const item of script?.sections?.cooldown?.items || []) {
    add(item?.actionId);
  }
  for (const group of script?.training?.videoGroups || []) {
    for (const screen of group?.screens || []) {
      for (const card of screen?.videoCards || []) {
        add(card?.actionId);
      }
    }
  }

  return ids;
}

function syncActionCourseTagsForCourse(course = {}) {
  const tags = courseTypeTagsFromTypeIds(course.typeIds);
  if (!tags.length) {
    return false;
  }

  const actionIds = collectActionIdsFromCourseScript(coerceCourseScript(course));
  if (!actionIds.size) {
    return false;
  }

  let changed = false;
  state.actions = state.actions.map((action) => {
    const normalized = normalizeActionRecord(action);
    if (!actionIds.has(String(normalized.id))) {
      return normalized;
    }

    const nextTags = normalizeCourseTags([...normalized.courseTags, ...tags]);
    if (JSON.stringify(nextTags) === JSON.stringify(normalized.courseTags)) {
      return normalized;
    }

    changed = true;
    return {
      ...normalized,
      courseTags: nextTags
    };
  });

  return changed;
}

function syncAllActionCourseTagsFromCourses() {
  const changed = (state.courses || []).reduce((didChange, course) => syncActionCourseTagsForCourse(course) || didChange, false);
  if (changed) {
    persist();
  }
}

export function listActions(user = null, options = {}) {
  return sortByNewest(
    state.actions
      .map(normalizeActionRecord)
      .filter((action) => actionAllowsUser(action, user))
      .filter((action) => actionMatchesCoursePackageScope(action, options)),
    "updateTime"
  );
}

export function getActionById(actionId) {
  const action = state.actions.find((item) => item.id === Number(actionId)) ?? null;
  return action ? normalizeActionRecord(action) : null;
}

export function saveAction(payload, user = null) {
  const existing = payload.id ? getActionById(payload.id) : null;
  if (existing && !actionAllowsUser(existing, user)) {
    throw new Error("当前账号不能修改其它课程包下的动作。");
  }
  const next = normalizeActionPayload(prepareActionOwnerPayload(payload, existing, user), existing);
  const index = state.actions.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.actions[index] = next;
  } else {
    state.actions.push(next);
  }

  persist();
  return next;
}

export function deleteAction(actionId, user = null) {
  const numericId = Number(actionId);
  const existing = getActionById(numericId);
  if (!existing || !actionAllowsUser(existing, user)) {
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

export function listCourses(user = null) {
  const allowedCourseIds = getUserVisibleCourseIdSet(user);
  return sortByNewest(state.courses, "updateTime")
    .filter((course) => !allowedCourseIds || allowedCourseIds.has(Number(course.id)))
    .map(serializeCourse);
}

export function listCourseSummaries(user = null) {
  const allowedCourseIds = getUserVisibleCourseIdSet(user);
  return sortByNewest(state.courses, "updateTime")
    .filter((course) => !allowedCourseIds || allowedCourseIds.has(Number(course.id)))
    .map(serializeCourseSummary);
}

export function getCourseById(courseId) {
  const course = state.courses.find((item) => item.id === Number(courseId)) ?? null;
  return course ? serializeCourse(course) : null;
}

function normalizeCourseIdentityText(value) {
  return trimText(value).toLocaleLowerCase();
}

export function saveCourse(payload, user = null) {
  const existing = payload.id ? getCourseById(payload.id) : null;
  if (existing && !courseAllowsUser(existing, user)) {
    throw new Error("当前账号不能修改其它课程包下的课程。");
  }
  const targetCoursePackageId = resolveWriteCoursePackageId(user, payload?.coursePackageId, existing?.coursePackageId);
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

export function deleteCourse(courseId, user = null) {
  const numericId = Number(courseId);
  const existing = state.courses.find((item) => Number(item.id) === numericId) ?? null;

  if (!existing || !courseAllowsUser(existing, user)) {
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

export function listTemplates(user = null) {
  return {
    warmup: listTemplatesByKind("warmup", user),
    cooldown: listTemplatesByKind("cooldown", user),
    training: listTemplatesByKind("training", user),
    course: listTemplatesByKind("course", user)
  };
}

export function getTemplateById(templateId, user = null) {
  const template = state.templates.find((item) => item.id === Number(templateId)) ?? null;
  if (!template || !templateAllowsUser(template, user)) {
    return null;
  }
  return template ? serializeTemplate(template) : null;
}

export function saveTemplate(payload, user = null) {
  const existing = payload.id ? getTemplateById(payload.id, user) : null;
  const next = normalizeTemplatePayload(payload, existing);
  const requestedPackageIds = normalizeTemplateCoursePackageIds(payload);
  if (requestedPackageIds.length) {
    assertCanSaveTemplate({ ...next, coursePackageIds: requestedPackageIds }, user);
  }
  next.coursePackageIds = resolveWriteCoursePackageIds(user, next.coursePackageIds, existing?.coursePackageIds);
  assertCanSaveTemplate(next, user);
  const index = state.templates.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.templates[index] = next;
  } else {
    state.templates.push(next);
  }

  persist();
  return serializeTemplate(next);
}

export function deleteTemplate(templateId, user = null) {
  const numericId = Number(templateId);
  const existing = state.templates.find((item) => item.id === numericId) ?? null;
  if (!existing || !templateAllowsUser(existing, user)) {
    return { ok: false, message: "模板不存在。" };
  }
  state.templates = state.templates.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

export function listCourseOptions(coursePackageId = "", user = null) {
  const packageCourseIds = getCoursePackageCourseIdSet(coursePackageId);
  const userCourseIds = getUserVisibleCourseIdSet(user);
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

function findTvScreenForRequest(payload = {}, accountNamespace = "") {
  const requestedNamespace = normalizeScreenAccountNamespace(accountNamespace || payload.accountNamespace);
  const requestedDeviceId = trimText(payload.deviceId).toUpperCase();
  const requestedScreenNumber = Number(payload.screenNumber) || 0;
  return (
    (state.tvScreens || []).find((item) => {
      const itemNamespace = normalizeScreenAccountNamespace(item.accountNamespace);
      const itemDeviceId = trimText(item.deviceId).toUpperCase();
      const itemScreenNumber = Number(item.screenNumber) || 0;
      const namespaceMatches = !requestedNamespace || itemNamespace === requestedNamespace;
      const sameDevice = requestedDeviceId && itemDeviceId === requestedDeviceId && namespaceMatches;
      const sameScopedScreen =
        requestedNamespace
        && requestedScreenNumber >= 1
        && itemNamespace === requestedNamespace
        && itemScreenNumber === requestedScreenNumber;
      return sameDevice || sameScopedScreen;
    }) || null
  );
}

function resolveTvRequestAccountNamespace(accountNamespace = "", payload = {}) {
  const requestedNamespace = normalizeScreenAccountNamespace(accountNamespace);
  const matchedScreen = findTvScreenForRequest(payload, requestedNamespace);
  const boundNamespace = normalizeScreenAccountNamespace(matchedScreen?.accountNamespace);
  return boundNamespace || requestedNamespace;
}

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

export function getCurrentPlaybackSession(accountNamespace = "") {
  return serializePlaybackSession(getCurrentPlaybackSessionEntry(accountNamespace));
}

export function getActivePlaybackSession(accountNamespace = "") {
  return serializePlaybackSession(getActivePlaybackSessionEntry(accountNamespace));
}

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
    const activeState = normalizePlaybackState(active.state);
    if (
      activeState !== "PREVIEW"
      || (
        screenSessionId
        && trimText(active.id) === screenSessionId
        && Boolean(matchedScreen?.previewMode)
      )
    ) {
      return serializePlaybackSession(active);
    }
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

export function getPlaybackSession(sessionId, accountNamespace = "") {
  return serializePlaybackSession(findPlaybackSessionById(sessionId, accountNamespace));
}

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

export function bindTvScreen(payload = {}, accountNamespace = "") {
  return upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
}

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
  const sessionOutdated =
    Boolean(activeSession)
    && (
      reportedSessionId !== trimText(activeSession.id)
      || reportedVersion < safeNumber(activeSession.version)
    );

  return {
    ...screen,
    serverNowMs: Date.now(),
    sessionOutdated,
    session: sessionOutdated ? serializePlaybackSession(activeSession) : null
  };
}

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

function decorateTvDeviceSnapshot(snapshot) {
  const venue = snapshot.accountNamespace ? getVenueByAccountNamespace(snapshot.accountNamespace) : null;
  const previousVenue = snapshot.previousAccountNamespace
    ? getVenueByAccountNamespace(snapshot.previousAccountNamespace)
    : null;

  return {
    ...snapshot,
    venueId: trimText(venue?.id),
    venueName: trimText(venue?.name),
    previousVenueId: trimText(previousVenue?.id),
    previousVenueName: trimText(previousVenue?.name),
    bindingState: snapshot.accountNamespace ? "BOUND" : "UNBOUND"
  };
}

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

export function deleteSchedule(scheduleId) {
  const numericId = Number(scheduleId);
  state.schedules = state.schedules.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

function scheduleHasExistingCourse(schedule) {
  const courseId = Number(schedule?.courseId);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return false;
  }
  return state.courses.some((course) => Number(course.id) === courseId);
}

function scheduleCalendarDate(schedule) {
  return schedule?.beginTime ? formatCalendarDate(schedule.beginTime, "Asia/Shanghai") : trimText(schedule?.date);
}

function listSchedulesInWeek(coursePackageId, weekStart, weekEnd) {
  return state.schedules
    .filter((item) => scheduleMatchesCoursePackage(item, coursePackageId))
    .filter((item) => inCalendarDateRange(item.beginTime, weekStart, weekEnd));
}

function listCopyableSchedulesInWeek(coursePackageId, weekStart, weekEnd) {
  return listSchedulesInWeek(coursePackageId, weekStart, weekEnd).filter(scheduleHasExistingCourse);
}

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

function parseScheduleWeekStart(value, fieldLabel) {
  const text = trimText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${fieldLabel}必须是 YYYY-MM-DD 格式。`);
  }

  const anchor = new Date(`${text}T12:00:00.000+08:00`);
  if (Number.isNaN(anchor.getTime()) || formatCalendarDate(anchor, "Asia/Shanghai") !== text) {
    throw new Error(`${fieldLabel}无效。`);
  }

  const day = anchor.getUTCDay();
  if (day !== 1) {
    throw new Error(`${fieldLabel}必须是周一。`);
  }

  return text;
}

function calendarDateDiffDays(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00.000+08:00`);
  const to = new Date(`${toDate}T00:00:00.000+08:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function targetWeekConflictError() {
  const error = new Error("目标周已有排课。");
  error.statusCode = 409;
  return error;
}

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

function getDefaultCoursePackageId() {
  const packages = Array.isArray(state.coursePackages) ? state.coursePackages : [];
  return normalizeCoursePackageId(packages.find((item) => item.isDefault)?.id || packages[0]?.id || 1);
}

function getCoursePackageByIdInternal(coursePackageId) {
  const id = normalizeCoursePackageId(coursePackageId, 0);
  if (!id) {
    return null;
  }
  return (state.coursePackages || []).find((item) => normalizeCoursePackageId(item.id) === id) || null;
}

function serializeCoursePackage(item) {
  const record = normalizeCoursePackageRecord(item);
  return {
    ...record,
    courseCount: record.courseIds.length
  };
}

function getCoursePackageCourseIdSet(coursePackageId = "") {
  const id = normalizeCoursePackageId(coursePackageId, 0);
  if (!id) {
    return null;
  }
  const record = getCoursePackageByIdInternal(id);
  if (!record) {
    return new Set();
  }
  const courseIds = new Set(numberList(record.courseIds));
  for (const course of state.courses || []) {
    if (normalizeCoursePackageId(course.coursePackageId, 0) === id) {
      courseIds.add(Number(course.id));
    }
  }
  return courseIds;
}

function coursePackageAllowsCourse(coursePackageId, courseId) {
  const allowedCourseIds = getCoursePackageCourseIdSet(coursePackageId);
  if (!allowedCourseIds) {
    return true;
  }
  return allowedCourseIds.has(Number(courseId));
}

function getUserVisibleCoursePackageIdSet(user = null) {
  if (!user || isSuperAdminUser(user)) {
    return null;
  }
  return new Set(normalizeUserPackageIds(user.coursePackageIds));
}

function getUserVisibleCourseIdSet(user = null) {
  const packageIds = getUserVisibleCoursePackageIdSet(user);
  if (!packageIds) {
    return null;
  }
  const courseIds = new Set();
  for (const packageId of packageIds) {
    const pkg = getCoursePackageByIdInternal(packageId);
    for (const courseId of numberList(pkg?.courseIds)) {
      courseIds.add(courseId);
    }
  }
  return courseIds;
}

function userIdentityText(user = null) {
  return trimText(user?.username || user?.nickname || user?.accountNamespace);
}

function validCoursePackageIdSet() {
  return new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id, 0)).filter(Boolean));
}

function sanitizeCoursePackageIds(value) {
  const validIds = validCoursePackageIdSet();
  return [...new Set(numberList(value).filter((id) => validIds.has(id)))];
}

function resolveWriteCoursePackageIds(user = null, requestedIds = [], existingIds = []) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  const requested = sanitizeCoursePackageIds(requestedIds);
  const existing = sanitizeCoursePackageIds(existingIds);

  if (!visiblePackageIds) {
    if (requested.length) return requested;
    if (existing.length) return existing;
    return [getDefaultCoursePackageId()];
  }

  const visible = [...visiblePackageIds].filter(Boolean);
  if (!visible.length) {
    throw new Error("当前账号没有绑定课程包。");
  }

  if (visible.length === 1) {
    return [visible[0]];
  }

  const candidates = requested.length ? requested : existing;
  if (!candidates.length) {
    throw new Error("请选择课程包。");
  }
  if (candidates.some((id) => !visiblePackageIds.has(id))) {
    throw new Error("当前账号不能保存其它课程包的数据。");
  }
  return candidates;
}

function resolveWriteCoursePackageId(user = null, requestedId = 0, existingId = 0) {
  return resolveWriteCoursePackageIds(user, [requestedId].filter(Boolean), [existingId].filter(Boolean))[0] || 0;
}

function prepareActionOwnerPayload(payload = {}, existing = null, user = null) {
  const ownerUsername = userIdentityText(user) || trimText(existing?.ownerUsername || existing?.author);
  const coursePackageIds = resolveWriteCoursePackageIds(user, payload.coursePackageIds, existing?.coursePackageIds);
  return {
    ...payload,
    coursePackageIds,
    ownerUsername,
    author: ownerUsername || trimText(payload.author || existing?.author)
  };
}

function prepareCourseOwnerPayload(payload = {}, existing = null, user = null) {
  const ownerUsername = userIdentityText(user) || trimText(existing?.ownerUsername || existing?.author);
  const creator = trimText(payload.creator) || trimText(existing?.creator) || ownerUsername;
  return {
    ...payload,
    creator,
    ownerUsername,
    author: ownerUsername || trimText(payload.author || existing?.author)
  };
}

function actionAllowsUser(action = {}, user = null) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  if (!visiblePackageIds) {
    return true;
  }

  const actionPackageIds = numberList(action.coursePackageIds);
  if (!actionPackageIds.length) {
    return visiblePackageIds.has(getDefaultCoursePackageId());
  }
  return actionPackageIds.some((id) => visiblePackageIds.has(id));
}

function courseAllowsUser(course = {}, user = null) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  if (!visiblePackageIds) {
    return true;
  }
  const coursePackageId = normalizeCoursePackageId(course.coursePackageId, 0);
  if (coursePackageId > 0) {
    return visiblePackageIds.has(coursePackageId);
  }
  return [...visiblePackageIds].some((packageId) => Boolean(getCoursePackageCourseIdSet(packageId)?.has(Number(course.id))));
}

function normalizeVenuePackageIds(value) {
  const ids = numberList(value);
  const validIds = new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id)));
  const filtered = ids.filter((id) => validIds.has(id));
  return filtered.length ? [...new Set(filtered)] : [getDefaultCoursePackageId()];
}

function resolveVenueActiveCoursePackageId(venue) {
  const boundIds = normalizeVenuePackageIds(venue?.coursePackageIds);
  const activeId = normalizeCoursePackageId(venue?.activeCoursePackageId, 0);
  return boundIds.includes(activeId) ? activeId : boundIds[0];
}

function normalizeUserPackageIds(value) {
  const ids = numberList(value);
  const validIds = new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id)));
  return [...new Set(ids.filter((id) => validIds.has(id)))];
}

function getActiveCoursePackageIdForNamespace(accountNamespace = "") {
  const ns = normalizeScreenAccountNamespace(accountNamespace);
  if (!ns) {
    return 0;
  }
  const venue = getVenueByAccountNamespace(ns);
  if (!venue) {
    return 0;
  }
  return resolveVenueActiveCoursePackageId(venue);
}

function inferCoursePackageIdForCourse(courseId) {
  const normalizedCourseId = Number(courseId);
  if (!Number.isFinite(normalizedCourseId) || normalizedCourseId <= 0) {
    return 0;
  }
  const matchedIds = (state.coursePackages || [])
    .filter((item) => getCoursePackageCourseIdSet(item.id)?.has(normalizedCourseId))
    .map((item) => normalizeCoursePackageId(item.id, 0))
    .filter(Boolean);
  if (matchedIds.length === 1) {
    return matchedIds[0];
  }
  const defaultId = getDefaultCoursePackageId();
  if (defaultId && matchedIds.includes(defaultId)) {
    return defaultId;
  }
  return matchedIds[0] || 0;
}

function scheduleMatchesCoursePackage(schedule, coursePackageId) {
  const activeId = normalizeCoursePackageId(coursePackageId, 0);
  if (!activeId) {
    return false;
  }
  const schedulePackageId = normalizeCoursePackageId(schedule?.coursePackageId, 0);
  if (schedulePackageId === activeId) {
    return true;
  }
  if (schedulePackageId > 0) {
    return false;
  }
  const courseId = Number(schedule?.courseId);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return false;
  }
  return Boolean(getCoursePackageCourseIdSet(activeId)?.has(courseId));
}

function isVenuePlaybackActive(venue) {
  const ns = normalizeAccountNamespace(venue?.accountNamespace);
  if (!ns) {
    return false;
  }
  return Boolean(getActivePlaybackSessionEntry(ns));
}

export function listCoursePackages() {
  return sortByNewest(state.coursePackages || [], "updateTime").map(serializeCoursePackage);
}

function listCoursePackagesForUser(user = null) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  return listCoursePackages().filter((item) => !visiblePackageIds || visiblePackageIds.has(Number(item.id)));
}

export function getCoursePackageById(coursePackageId) {
  const record = getCoursePackageByIdInternal(coursePackageId);
  return record ? serializeCoursePackage(record) : null;
}

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
