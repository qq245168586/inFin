// @ts-nocheck
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloneCourseScript,
  createTrainingPanel,
  courseScriptUsesAction,
  legacyCourseToScript as convertCourseToScript,
  normalizeCoursePlan,
  summarizeCourseScript,
  validateCourseScript
} from "../../../../../packages/shared/src/course-script.js";

export { fs, path };

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const defaultStorageRoot = path.resolve(__dirname, "../../../storage");
export let storageRoot = "";
export let mediaRoot = "";
export let appPackageRoot = "";
export let backupRoot = "";
export let dbFile = "";
export const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 15 * 24 * 60 * 60;
export const TV_SCREEN_COUNT = 5;
export const TV_ONLINE_THRESHOLD_MS = 35 * 1000;
export const DB_BACKUP_RETENTION = 120;
export const PLAYBACK_PREVIEW_TTL_MS = 10 * 60 * 1000;
export const PLAYBACK_TERMINAL_CURRENT_TTL_MS = 15 * 60 * 1000;
export const PLAYBACK_ACTIVE_STATES = new Set(["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED"]);
export const PLAYBACK_TERMINAL_STATES = new Set(["ENDED", "TERMINATED"]);
export const PLAYBACK_WARMUP_READY_SECONDS = 15;
export const PLAYBACK_TRAINING_READY_SECONDS = 15;
export const PLAYBACK_COOLDOWN_READY_SECONDS = 10;
export const DEFAULT_ACCOUNT_NAMESPACE = "13689547720";
export const DEFAULT_COURSE_PACKAGE_NAME = "默认课程包";
export const SUPERADMIN_USERNAMES = new Set(["13689547720", "zhiyou"]);
export const CONSOLE_ACCOUNT_PRESETS = [
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

/**
 * 判断是否满足 is seed environment label 条件，供调用方做分支处理。
 */
export function isSeedEnvironmentLabel(label = "") {
  const normalized = trimText(label);
  return normalized === "正式环境" || normalized === "测试环境" || normalized === "自定义环境";
}

export const defaultState = createDefaultState();
export let normalizeLoadedStateDidChange = false;
export let state = null;

/**
 * 封装 reload JSON file store state 的业务步骤，避免调用方依赖内部实现细节。
 */
export function reloadStoreState() {
  configureStorageRoot();
  state = loadState();
  ensureConsoleAccountSeeds();
  syncCourseStationRules();
  syncAllActionCourseTagsFromCourses();
  return state;
}

reloadStoreState();

/**
 * 封装 配置 storage root 的业务步骤，避免调用方依赖内部实现细节。
 */
export function configureStorageRoot() {
  storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || defaultStorageRoot);
  mediaRoot = path.join(storageRoot, "media");
  appPackageRoot = path.join(storageRoot, "app-packages");
  backupRoot = path.join(storageRoot, "backups");
  dbFile = path.join(storageRoot, "db.json");
  ensureDir(storageRoot);
  ensureDir(mediaRoot);
  ensureDir(appPackageRoot);
  ensureDir(backupRoot);
  migrateDefaultStorageIfNeeded();
}

/**
 * 确保 dir 存在，缺失时自动补齐基础结构。
 */
export function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

/**
 * 复制 directory recursive，并过滤不应该进入目标范围的数据。
 */
export function copyDirectoryRecursive(source, target) {
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

/**
 * 封装 migrate default storage if needed 的业务步骤，避免调用方依赖内部实现细节。
 */
export function migrateDefaultStorageIfNeeded() {
  if (storageRoot === defaultStorageRoot) {
    return;
  }

  const defaultDbFile = path.join(defaultStorageRoot, "db.json");
  const defaultMediaRoot = path.join(defaultStorageRoot, "media");
  const defaultBackupRoot = path.join(defaultStorageRoot, "backups");

  if (!fs.existsSync(dbFile) && fs.existsSync(defaultDbFile)) {
    fs.copyFileSync(defaultDbFile, dbFile);
  }

  if (!fs.existsSync(mediaRoot) || fs.readdirSync(mediaRoot).length === 0) {
    copyDirectoryRecursive(defaultMediaRoot, mediaRoot);
  }

  if (!fs.existsSync(backupRoot) || fs.readdirSync(backupRoot).length === 0) {
    copyDirectoryRecursive(defaultBackupRoot, backupRoot);
  }
}

/**
 * 封装 clone 的业务步骤，避免调用方依赖内部实现细节。
 */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 封装 sort by newest 的业务步骤，避免调用方依赖内部实现细节。
 */
export function sortByNewest(list, field = "updateTime") {
  return [...list].sort((left, right) => {
    const leftValue = new Date(left[field] || left.createTime || 0).getTime();
    const rightValue = new Date(right[field] || right.createTime || 0).getTime();
    return rightValue - leftValue;
  });
}

/**
 * 封装 next id 的业务步骤，避免调用方依赖内部实现细节。
 */
export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

/**
 * 封装 now iso 的业务步骤，避免调用方依赖内部实现细节。
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * 封装 format backup stamp 的业务步骤，避免调用方依赖内部实现细节。
 */
export function formatBackupStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${padNumber(date.getUTCMonth() + 1)}${padNumber(date.getUTCDate())}-${padNumber(
    date.getUTCHours()
  )}${padNumber(date.getUTCMinutes())}${padNumber(date.getUTCSeconds())}-${String(date.getUTCMilliseconds()).padStart(
    3,
    "0"
  )}`;
}

/**
 * 读取 text if exists，把底层数据转成调用方可直接使用的结构。
 */
export function readTextIfExists(targetFile) {
  if (!fs.existsSync(targetFile)) {
    return "";
  }

  return fs.readFileSync(targetFile, "utf8");
}

/**
 * 写入 text atomic，使用原子写保护数据文件完整性。
 */
export function writeTextAtomic(targetFile, text) {
  ensureDir(path.dirname(targetFile));
  const tempFile = `${targetFile}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, text, "utf8");
  fs.renameSync(tempFile, targetFile);
}

/**
 * 读取 backup files 列表，并按业务规则过滤或排序。
 */
export function listBackupFiles() {
  if (!fs.existsSync(backupRoot)) {
    return [];
  }

  return fs
    .readdirSync(backupRoot)
    .filter((name) => /^db\.[a-z-]+\.\d{8}-\d{6}-\d{3}\.json$/i.test(name))
    .map((name) => path.join(backupRoot, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

/**
 * 裁剪 backup files，只移除业务允许丢弃的历史数据。
 */
export function pruneBackupFiles() {
  const backups = listBackupFiles();
  for (const staleFile of backups.slice(DB_BACKUP_RETENTION)) {
    fs.rmSync(staleFile, { force: true });
  }
}

/**
 * 创建 database backup，并补齐运行时需要的默认配置。
 */
export function createDatabaseBackup(rawText, reason = "autosave") {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (!text) {
    return;
  }

  const backupFile = path.join(backupRoot, `db.${reason}.${formatBackupStamp()}.json`);
  writeTextAtomic(backupFile, rawText);
  pruneBackupFiles();
}

/**
 * 封装 pad number 的业务步骤，避免调用方依赖内部实现细节。
 */
export function padNumber(value) {
  return String(value).padStart(2, "0");
}

/**
 * 创建 stored name，并补齐运行时需要的默认配置。
 */
export function createStoredName(originalName = "asset.bin") {
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

/**
 * 创建 app package stored name，并补齐运行时需要的默认配置。
 */
export function createAppPackageStoredName(platform = "tv", version = "", originalName = "app.apk") {
  const safePlatform = normalizeAppPlatform(platform);
  const safeVersion = sanitizeSegment(version || "build");
  const extension = path.extname(String(originalName || "")).toLowerCase() || ".apk";
  return `${safePlatform}-${safeVersion}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
}

/**
 * 封装 sanitize segment 的业务步骤，避免调用方依赖内部实现细节。
 */
export function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "package";
}

/**
 * 封装 safe number 的业务步骤，避免调用方依赖内部实现细节。
 */
export function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

/**
 * 规范化 ready durations，避免后续业务处理不同格式的输入。
 */
export function normalizeReadyDurations(overrides = {}) {
  return {
    warmupSeconds: safeNumber(overrides?.warmupSeconds, 15),
    workoutSeconds: safeNumber(overrides?.workoutSeconds, 15),
    cooldownSeconds: safeNumber(overrides?.cooldownSeconds, 10)
  };
}

/**
 * 封装 number list 的业务步骤，避免调用方依赖内部实现细节。
 */
export function numberList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
}

/**
 * 修剪 text 文本，统一空值和边界字符处理。
 */
export function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 移除 media suffix，用于兼容旧数据或旧文件名。
 */
export function stripMediaSuffix(value) {
  let next = trimText(value);
  const mediaExtensionPattern = /\.(mp4|mov|m4v|webm|avi|mkv|mpeg|mpg|wmv)$/i;
  while (mediaExtensionPattern.test(next)) {
    next = next.replace(mediaExtensionPattern, "").trim();
  }
  return next;
}

/**
 * 规范化 account namespace，避免后续业务处理不同格式的输入。
 */
export function normalizeAccountNamespace(value, fallback = DEFAULT_ACCOUNT_NAMESPACE) {

  const text = trimText(value).toLowerCase();
  return text || fallback;
}

/**
 * 规范化 screen account namespace，避免后续业务处理不同格式的输入。
 */
export function normalizeScreenAccountNamespace(value) {
  return trimText(value).toLowerCase();
}

/**
 * 规范化 venue account namespace，避免后续业务处理不同格式的输入。
 */
export function normalizeVenueAccountNamespace(value) {
  return trimText(value).toLowerCase();
}

/**
 * 规范化 venue id，避免后续业务处理不同格式的输入。
 */
export function normalizeVenueId(value) {
  return trimText(value);
}

/**
 * 规范化 course package id，避免后续业务处理不同格式的输入。
 */
export function normalizeCoursePackageId(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

/**
 * 规范化 course package record，避免后续业务处理不同格式的输入。
 */
export function normalizeCoursePackageRecord(entry = {}, fallbackCourseIds = []) {
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

/**
 * 规范化 schedule entry，避免后续业务处理不同格式的输入。
 */
export function normalizeScheduleEntry(entry) {
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

/**
 * 规范化 course tag，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTag(value) {
  return stripMediaSuffix(value).toLowerCase().replace(/\s+/g, "-");
}

/**
 * 规范化 course tags，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTags(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,/]+/)
      : [];
  return [...new Set(source.map(normalizeCourseTag).filter(Boolean))];
}

/**
 * 规范化 action record，避免后续业务处理不同格式的输入。
 */
export function normalizeActionRecord(action = {}) {
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

/**
 * 规范化 action type record，避免后续业务处理不同格式的输入。
 */
export function normalizeActionTypeRecord(type = {}) {
  const raw = type && typeof type === "object" ? type : {};
  return {
    ...raw,
    id: Number(raw.id) || 0,
    name: stripMediaSuffix(raw.name),
    coursePackageIds: numberList(raw.coursePackageIds)
  };
}

/**
 * 规范化 client name，避免后续业务处理不同格式的输入。
 */
export function normalizeClientName(value, fallback = "editor-web") {
  const text = trimText(value).toLowerCase();

  if (text === "coach-web") {
    return "coach-web";
  }
  return fallback === "coach-web" ? "coach-web" : "editor-web";
}

/**
 * 规范化 allowed clients，避免后续业务处理不同格式的输入。
 */
export function normalizeAllowedClients(value, fallback = ["coach-web", "editor-web"]) {
  const candidates = Array.isArray(value) ? value : fallback;
  const normalized = [...new Set(candidates.map((item) => normalizeClientName(item)).filter(Boolean))];
  return normalized.length ? normalized : [...fallback];
}

/**
 * 封装 user allows client 的业务步骤，避免调用方依赖内部实现细节。
 */
export function userAllowsClient(user, clientName = "editor-web") {
  const allowedClients = normalizeAllowedClients(user?.allowedClients);
  return allowedClients.includes(normalizeClientName(clientName));
}

/**
 * 封装 environment label for namespace 的业务步骤，避免调用方依赖内部实现细节。
 */
export function environmentLabelForNamespace(accountNamespace = DEFAULT_ACCOUNT_NAMESPACE) {
  const normalized = normalizeAccountNamespace(accountNamespace);
  const matched = CONSOLE_ACCOUNT_PRESETS.find((item) => item.accountNamespace === normalized);
  return trimText(matched?.environmentLabel) || normalized || DEFAULT_ACCOUNT_NAMESPACE;
}

/**
 * 规范化 app platform，避免后续业务处理不同格式的输入。
 */
export function normalizeAppPlatform(value, fallback = "tv") {
  const text = trimText(value).toLowerCase();

  if (text === "coach") {
    return "coach";
  }

  if (text === "tv") {
    return "tv";
  }
  return fallback === "coach" ? "coach" : "tv";
}

/**
 * 推断 app platform from filename，从文件名或上下文补齐缺失信息。
 */
export function inferAppPlatformFromFilename(filename = "") {
  const lower = String(filename || "").toLowerCase();
  if (lower.includes("coach")) {
    return "coach";
  }
  return "tv";
}

/**
 * 推断 app version from filename，从文件名或上下文补齐缺失信息。
 */
export function inferAppVersionFromFilename(filename = "") {
  const baseName = path.basename(String(filename || ""), path.extname(String(filename || "")));
  const matched = baseName.match(/(?:^|[^0-9])v?(\d+(?:\.\d+){1,4}(?:[-_][a-z0-9.]+)?)/i);

  if (matched?.[1]) {
    return matched[1].replace(/_/g, "-");
  }
  return baseName || "未命名版本";
}

/**
 * 组装 app package download path，把分散的输入合成稳定输出。
 */
export function buildAppPackageDownloadPath(filename = "") {
  return `/api/app-packages/files/${encodeURIComponent(filename)}`;
}

/**
 * 计算 file checksum，集中封装时间或进度规则。
 */
export function calculateFileChecksum(targetFile) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(targetFile));
  return hash.digest("hex");
}

/**
 * 封装 md5 text 的业务步骤，避免调用方依赖内部实现细节。
 */
export function md5Text(value) {
  return createHash("md5").update(String(value)).digest("hex");
}

/**
 * 判断是否满足 is md5 digest 条件，供调用方做分支处理。
 */
export function isMd5Digest(value) {
  return /^[a-f0-9]{32}$/i.test(trimText(value));
}

/**
 * 规范化 password，避免后续业务处理不同格式的输入。
 */
export function normalizePassword(value) {
  const text = trimText(value);
  return isMd5Digest(text) ? text.toLowerCase() : md5Text(text);
}

/**
 * 封装 random token 的业务步骤，避免调用方依赖内部实现细节。
 */
export function randomToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * 封装 seconds from now 的业务步骤，避免调用方依赖内部实现细节。
 */
export function secondsFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * 判断是否满足 is future time 条件，供调用方做分支处理。
 */
export function isFutureTime(value) {
  return new Date(value || 0).getTime() > Date.now();
}

/**
 * 启动 of week，避免重复注册后台任务或监听器。
 */
export function startOfWeek(date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + delta);
  return current;
}

/**
 * 封装 end of week 的业务步骤，避免调用方依赖内部实现细节。
 */
export function endOfWeek(date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 7);
  return end;
}

/**
 * 封装 with time 的业务步骤，避免调用方依赖内部实现细节。
 */
export function withTime(base, dayOffset, hour, minute) {
  const next = new Date(base);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(hour, minute, 0, 0);
  return `${next.getFullYear()}-${padNumber(next.getMonth() + 1)}-${padNumber(next.getDate())}T${padNumber(
    next.getHours()
  )}:${padNumber(next.getMinutes())}:00+08:00`;
}

/**
 * 创建 default state，并补齐运行时需要的默认配置。
 */
export function createDefaultState() {
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

/**
 * 确保 console account seeds 存在，缺失时自动补齐基础结构。
 */
export function ensureConsoleAccountSeeds() {
  let changed = false;

  state.users = (state.users || []).map((user) => {
    const normalizedAccountNamespace = normalizeAccountNamespace(user.accountNamespace || user.username);
    const rawEnvLabel = trimText(user.environmentLabel);
    const environmentLabel = isSeedEnvironmentLabel(rawEnvLabel)
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
      const nextEnvironmentLabel = isSeedEnvironmentLabel(existingEnvLabel)
        ? preset.environmentLabel
        : existingEnvLabel || preset.environmentLabel;
      const existingNickname = trimText(existing.nickname);
      const nextNickname = isSeedEnvironmentLabel(existingNickname) ? preset.nickname : existingNickname || preset.nickname;
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
  // Cleanup seeded venues (e.g. 正式环境/测试环境) so that
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
        (isSeedEnvironmentLabel(venue.name) || trimText(venue.name) === ns);

      if (shouldCleanup) {
        didRemove = true;
        // Detach any seeded venue users/screens so the newly created venue can
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

/**
 * 移除 seed course examples，用于兼容旧数据或旧文件名。
 */
export function stripSeedCourseExamples(source) {
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

/**
 * 读取 scoped record package ids，并保持返回结构稳定。
 */
export function getScopedRecordPackageIds(record = {}, defaultPackageId = getDefaultCoursePackageId()) {
  const packageIds = numberList(record.coursePackageIds);
  return packageIds.length ? packageIds : [defaultPackageId];
}

/**
 * 封装 dedupe action types within packages 的业务步骤，避免调用方依赖内部实现细节。
 */
export function dedupeActionTypesWithinPackages(actionTypes = [], actions = [], defaultPackageId = getDefaultCoursePackageId()) {
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

/**
 * 规范化 lesson type packages，避免后续业务处理不同格式的输入。
 */
export function normalizeLessonTypePackages(lessonTypes = [], courses = [], defaultPackageId = getDefaultCoursePackageId()) {
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

/**
 * 封装 dedupe lesson types within packages 的业务步骤，避免调用方依赖内部实现细节。
 */
export function dedupeLessonTypesWithinPackages(lessonTypes = [], courses = [], defaultPackageId = getDefaultCoursePackageId()) {
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

/**
 * 规范化 loaded state，避免后续业务处理不同格式的输入。
 */
export function normalizeLoadedState(parsed) {
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

/**
 * 封装 try load state file 的业务步骤，避免调用方依赖内部实现细节。
 */
export function tryLoadStateFile(targetFile) {
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

/**
 * 写入 state snapshot，使用原子写保护数据文件完整性。
 */
export function writeStateSnapshot(nextState, options = {}) {
  const { createBackup = true, reason = "autosave" } = options;
  const nextText = JSON.stringify(nextState, null, 2);
  const currentText = readTextIfExists(dbFile);

  if (createBackup && currentText.trim() && currentText !== nextText) {
    createDatabaseBackup(currentText, reason);
  }

  writeTextAtomic(dbFile, nextText);
}

/**
 * 封装 load state 的业务步骤，避免调用方依赖内部实现细节。
 */
export function loadState() {
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

/**
 * 封装 persist 的业务步骤，避免调用方依赖内部实现细节。
 */
export function persist() {
  writeStateSnapshot(state, { createBackup: true, reason: "autosave" });

}

/**
 * 读取 database status，并保持返回结构稳定。
 */
export function getDatabaseStatus() {
  const backups = listBackupFiles();
  const dbText = readTextIfExists(dbFile);
  const dbSizeBytes = Buffer.byteLength(dbText || "", "utf8");
  const latestBackup = backups[0] || "";

  return {
    usingExternalDataRoot: storageRoot !== defaultStorageRoot,
    backupCount: backups.length,
    latestBackupAt: latestBackup ? new Date(fs.statSync(latestBackup).mtimeMs).toISOString() : "",
    dbSizeBytes
  };
}

/**
 * 读取 venue by id，并保持返回结构稳定。
 */
export function getVenueById(venueId) {
  const id = trimText(venueId);
  return (state.venues || []).find((item) => trimText(item.id) === id) ?? null;
}

/**
 * 读取 venue by account namespace，并保持返回结构稳定。
 */
export function getVenueByAccountNamespace(accountNamespace) {
  const ns = normalizeAccountNamespace(accountNamespace);
  return (state.venues || []).find((item) => normalizeAccountNamespace(item.accountNamespace) === ns) ?? null;
}

/**
 * 封装 public user info 的业务步骤，避免调用方依赖内部实现细节。
 */
export function publicUserInfo(user) {
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

/**
 * 清理 expired sessions，避免过期运行时状态影响新流程。
 */
export function cleanupExpiredSessions() {
  const beforeLength = state.authSessions.length;
  state.authSessions = state.authSessions.filter((item) => isFutureTime(item.refreshExpiresAt));

  if (state.authSessions.length !== beforeLength) {
    persist();
  }
}

/**
 * 创建 auth payload，并补齐运行时需要的默认配置。
 */
export function createAuthPayload(userId, clientName = "editor-web") {
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

/**
 * 规范化 action payload，避免后续业务处理不同格式的输入。
 */
export function normalizeActionPayload(payload = {}, existing = null) {
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

/**
 * 规范化 tv playback state，避免后续业务处理不同格式的输入。
 */
export function normalizeTvPlaybackState(value) {
  const stateText = trimText(value).toUpperCase();
  if (["IDLE", "SYNCING", "PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(stateText)) {
    return stateText;
  }
  return "IDLE";
}

/**
 * 规范化 tv update state，避免后续业务处理不同格式的输入。
 */
export function normalizeTvUpdateState(value) {
  const stateText = trimText(value).toUpperCase();
  if (["IDLE", "DOWNLOADING", "DOWNLOADED", "INSTALLING", "ERROR"].includes(stateText)) {
    return stateText;
  }
  return "IDLE";
}

/**
 * 规范化 playback state，避免后续业务处理不同格式的输入。
 */
export function normalizePlaybackState(value, fallback = "PREVIEW") {
  const stateText = trimText(value).toUpperCase();
  if (["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "TERMINATED"].includes(stateText)) {
    return stateText;
  }
  return fallback;
}

/**
 * 创建 playback session id，并补齐运行时需要的默认配置。
 */
export function createPlaybackSessionId() {
  return `ps_${Date.now().toString(36)}_${randomToken().slice(0, 10)}`;
}

/**
 * 封装 safe time ms 的业务步骤，避免调用方依赖内部实现细节。
 */
export function safeTimeMs(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  const parsed = new Date(trimText(value)).getTime();
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * 规范化 playback command，避免后续业务处理不同格式的输入。
 */
export function normalizePlaybackCommand(command = {}) {
  return {
    commandId: trimText(command.commandId),
    action: trimText(command.action),
    state: normalizePlaybackState(command.state, "PREVIEW"),
    version: safeNumber(command.version),
    resultVersion: safeNumber(command.resultVersion, safeNumber(command.version)),
    createdAt: trimText(command.createdAt) || nowIso()
  };
}

/**
 * 规范化 playback session entry，避免后续业务处理不同格式的输入。
 */
export function normalizePlaybackSessionEntry(entry = {}) {
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

/**
 * 实体化 playback session，把持久化记录补成运行时可用对象。
 */
export function materializePlaybackSession(session) {
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

/**
 * 读取 playback session duration ms，并保持返回结构稳定。
 */
export function getPlaybackSessionDurationMs(session) {
  const explicitDurationMs = safeNumber(session?.expectedDurationMs);

  if (explicitDurationMs > 0) {
    return explicitDurationMs;
  }
  return safeNumber(session?.duration) * 60 * 1000;
}

/**
 * 计算 playback elapsed ms，集中封装时间或进度规则。
 */
export function calculatePlaybackElapsedMs(session, serverNowMs = Date.now()) {
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

/**
 * 序列化 playback session，控制对外暴露字段。
 */
export function serializePlaybackSession(session) {
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

/**
 * 查找 playback session by id，找不到时返回空值而不是抛错。
 */
export function findPlaybackSessionById(sessionId, accountNamespace = "") {
  const id = trimText(sessionId);
  const ns = normalizeAccountNamespace(accountNamespace);
  const session = (state.playbackSessions || []).find((item) => trimText(item.id) === id && normalizeAccountNamespace(item.accountNamespace) === ns);
  return materializePlaybackSession(session || null);
}

/**
 * 读取 active playback session entry，并保持返回结构稳定。
 */
export function getActivePlaybackSessionEntry(accountNamespace = "") {
  const ns = normalizeAccountNamespace(accountNamespace);
  const sessions = (state.playbackSessions || [])
    .filter((item) => normalizeAccountNamespace(item.accountNamespace) === ns)
    .map(materializePlaybackSession)
    .filter((item) => item && PLAYBACK_ACTIVE_STATES.has(item.state))
    .sort((left, right) => new Date(right.updateTime || right.createTime || 0).getTime() - new Date(left.updateTime || left.createTime || 0).getTime());
  return sessions[0] || null;
}

/**
 * 读取 recent terminal playback session entry，并保持返回结构稳定。
 */
export function getRecentTerminalPlaybackSessionEntry(accountNamespace = "") {
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

/**
 * 读取 current playback session entry，并保持返回结构稳定。
 */
export function getCurrentPlaybackSessionEntry(accountNamespace = "") {
  return getActivePlaybackSessionEntry(accountNamespace) || getRecentTerminalPlaybackSessionEntry(accountNamespace);
}

/**
 * 记录 playback command，用于后续运维追踪和问题排查。
 */
export function recordPlaybackCommand(session, action, commandId) {
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

/**
 * 组装 tv screen snapshot，把分散的输入合成稳定输出。
 */
export function buildTvScreenSnapshot(entry = null) {
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

/**
 * 规范化 tv screen payload，避免后续业务处理不同格式的输入。
 */
export function normalizeTvScreenPayload(payload = {}, existing = null, fallbackAccountNamespace = "") {
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

/**
 * 读取 app package file path，并保持返回结构稳定。
 */
export function getAppPackageFilePath(filename = "") {
  return path.join(appPackageRoot, path.basename(String(filename || "")));
}

/**
 * 规范化 app package record，避免后续业务处理不同格式的输入。
 */
export function normalizeAppPackageRecord(payload = {}, existing = null) {
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

/**
 * 序列化 app package，控制对外暴露字段。
 */
export function serializeAppPackage(record) {
  return clone({
    ...record,
    downloadPath: buildAppPackageDownloadPath(record.filename)
  });
}

/**
 * 同步 app package state，让历史数据符合当前业务模型。
 */
export function syncAppPackageState() {
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

/**
 * 封装 upsert tv screen 的业务步骤，避免调用方依赖内部实现细节。
 */
export function upsertTvScreen(payload = {}) {
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

/**
 * 封装 template uid 的业务步骤，避免调用方依赖内部实现细节。
 */
export function templateUid(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

/**
 * 解析 action name，合并请求参数、上下文和默认值。
 */
export function resolveActionName(actionId, fallbackName = "") {
  const text = trimText(fallbackName);

  if (text) {
    return text;
  }
  return state.actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

/**
 * 规范化 waterfall template section，避免后续业务处理不同格式的输入。
 */
export function normalizeWaterfallTemplateSection(kind, section = {}) {
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

/**
 * 规范化 template video group，避免后续业务处理不同格式的输入。
 */
export function normalizeTemplateVideoGroup(videoGroup = {}) {
  const screenCount = Number(videoGroup.screenCount) === 1 ? 1 : 3;
  const rawScreens = Array.isArray(videoGroup.screens) ? videoGroup.screens : [];
  const normalizeRowLayouts = (rowLayouts) => {
    if (screenCount === 1) return [];
    const source = Array.isArray(rowLayouts) ? rowLayouts : [];
    if (!source.length) return [1, 1, 1];
    const rows = source.map((columns) => (Number(columns) === 2 ? 2 : 1));
    return rows.slice(0, 5);
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

/**
 * 校验 template payload，返回前端可理解的错误信息。
 */
export function validateTemplatePayload(template) {
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

/**
 * 封装 clone plain object 的业务步骤，避免调用方依赖内部实现细节。
 */
export function clonePlainObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : clone(fallback);
}

/**
 * 规范化 course template package ids，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTemplatePackageIds(payload = {}, existing = null) {
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

/**
 * 规范化 template course package ids，避免后续业务处理不同格式的输入。
 */
export function normalizeTemplateCoursePackageIds(payload = {}, existing = null) {
  return normalizeCourseTemplatePackageIds(payload, existing);
}

/**
 * 规范化 course package lookup text，避免后续业务处理不同格式的输入。
 */
export function normalizeCoursePackageLookupText(value = "") {
  return trimText(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/**
 * 封装 compact course package lookup text 的业务步骤，避免调用方依赖内部实现细节。
 */
export function compactCoursePackageLookupText(value = "") {
  return normalizeCoursePackageLookupText(value).replace(/\s+/g, "");
}

/**
 * 查找 course package id by name candidates，找不到时返回空值而不是抛错。
 */
export function findCoursePackageIdByNameCandidates(candidates = [], coursePackages = null) {
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

/**
 * 读取 default or hybrid course package id，并保持返回结构稳定。
 */
export function getDefaultOrHybridCoursePackageId(coursePackages = null, fallbackId = 0) {
  return (
    findCoursePackageIdByNameCandidates(["Hybrid", "default", DEFAULT_COURSE_PACKAGE_NAME], coursePackages)
    || normalizeCoursePackageId(fallbackId, 0)
    || getDefaultCoursePackageId()
  );
}

/**
 * 读取 twelve round course package id，并保持返回结构稳定。
 */
export function getTwelveRoundCoursePackageId(coursePackages = null, fallbackId = 0) {
  return (
    findCoursePackageIdByNameCandidates(["12round", "12 round"], coursePackages)
    || getDefaultOrHybridCoursePackageId(coursePackages, fallbackId)
  );
}

/**
 * 读取 template fallback course package ids，并保持返回结构稳定。
 */
export function getTemplateFallbackCoursePackageIds(template = {}, coursePackages = null, fallbackId = 0) {
  const normalizedName = normalizeCoursePackageLookupText(template.name);
  const packageId =
    template.kind === "warmup" && (normalizedName.includes("boxing") || normalizedName.includes("box warmup"))
      ? getTwelveRoundCoursePackageId(coursePackages, fallbackId)
      : getDefaultOrHybridCoursePackageId(coursePackages, fallbackId);
  return packageId ? [packageId] : [];
}

/**
 * 规范化 loaded template course package ids，避免后续业务处理不同格式的输入。
 */
export function normalizeLoadedTemplateCoursePackageIds(template = {}, coursePackages = null, fallbackId = 0) {
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

/**
 * 规范化 template source course id，避免后续业务处理不同格式的输入。
 */
export function normalizeTemplateSourceCourseId(value, fallback = null) {
  const source = value !== undefined ? value : fallback;
  const numeric = Number(source);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * 规范化 course template name，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTemplateName(payload = {}, existing = null) {
  const source =
    payload.courseName
    ?? existing?.courseName
    ?? payload.script?.metadata?.name
    ?? existing?.script?.metadata?.name
    ?? payload.name
    ?? existing?.name;
  return trimText(source);
}

/**
 * 规范化 course template payload，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTemplatePayload(payload = {}, existing = null, base = {}) {
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

/**
 * 规范化 template payload，避免后续业务处理不同格式的输入。
 */
export function normalizeTemplatePayload(payload = {}, existing = null) {
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

/**
 * 读取 course template package ids，并保持返回结构稳定。
 */
export function getCourseTemplatePackageIds(template = {}) {
  const packageIds = numberList(
    template.coursePackageIds !== undefined
      ? template.coursePackageIds
      : template.coursePackageId !== undefined
        ? [template.coursePackageId]
        : []
  );
  return packageIds.length ? packageIds : getTemplateFallbackCoursePackageIds(template);
}

/**
 * 封装 template allows user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function templateAllowsUser(template = {}, user = null) {
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

/**
 * 封装 assert can save template 的业务步骤，避免调用方依赖内部实现细节。
 */
export function assertCanSaveTemplate(template = {}, user = null) {
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

/**
 * 序列化 template，控制对外暴露字段。
 */
export function serializeTemplate(template) {
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

/**
 * 读取 templates by kind 列表，并按业务规则过滤或排序。
 */
export function listTemplatesByKind(kind, user = null) {
  return sortByNewest(
    state.templates.filter((item) => item.kind === kind && templateAllowsUser(item, user)),
    "updateTime"
  ).map(serializeTemplate);
}

/**
 * 封装 default hydrate seconds from course 的业务步骤，避免调用方依赖内部实现细节。
 */
export function defaultHydrateSecondsFromCourse(course) {
  const rawValue = course?.script?.metadata?.defaultHydrateSeconds ?? course?.metadata?.defaultHydrateSeconds;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * 封装 pick text field 的业务步骤，避免调用方依赖内部实现细节。
 */
export function pickTextField(source = {}, field) {
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

/**
 * 规范化 course rotation type，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseRotationType(value) {
  const text = trimText(value).toUpperCase();
  return ["REGION", "LANE", "SNAKE"].includes(text) ? text : "REGION";
}

/**
 * 封装 course station rule fields 的业务步骤，避免调用方依赖内部实现细节。
 */
export function courseStationRuleFields() {
  return ["set", "work", "rest", "switch", "port", "leader"];
}

/**
 * 封装 course station rule aliases 的业务步骤，避免调用方依赖内部实现细节。
 */
export function courseStationRuleAliases(field) {
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

/**
 * 判断是否满足 is plain object 条件，供调用方做分支处理。
 */
export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 封装 pick course station rule value 的业务步骤，避免调用方依赖内部实现细节。
 */
export function pickCourseStationRuleValue(source = {}, field) {
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

/**
 * 封装 collect course station rules 的业务步骤，避免调用方依赖内部实现细节。
 */
export function collectCourseStationRules(source = {}) {
  return courseStationRuleFields().reduce((rules, field) => {
    const value = pickCourseStationRuleValue(source, field);

    if (value !== null) {
      rules[field] = value;
    }
    return rules;
  }, {});
}

/**
 * 判断是否满足 has course station rule values 条件，供调用方做分支处理。
 */
export function hasCourseStationRuleValues(rules = {}) {
  return courseStationRuleFields().some((field) => Boolean(trimText(rules[field])));
}

/**
 * 封装 add unique course seconds 的业务步骤，避免调用方依赖内部实现细节。
 */
export function addUniqueCourseSeconds(values, value) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0 && !values.includes(seconds)) {
    values.push(seconds);
  }
}

/**
 * 封装 format course seconds list 的业务步骤，避免调用方依赖内部实现细节。
 */
export function formatCourseSecondsList(values = []) {
  return values.length ? values.map((seconds) => `${seconds}s`).join("/") : "";
}

/**
 * 封装 derive course switch rule 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveCourseSwitchRule(rotationType) {
  const normalized = normalizeCourseRotationType(rotationType);

  if (normalized === "LANE") {
    return "range";
  }

  if (normalized === "SNAKE") {
    return "follow the leader";
  }
  return "pod";
}

/**
 * 解析 course rule script，合并请求参数、上下文和默认值。
 */
export function resolveCourseRuleScript(source) {
  if (source?.training?.pods && source?.training?.videoGroups) {
    return source;
  }

  if (source?.script?.training?.pods && source?.script?.training?.videoGroups) {
    return source.script;
  }
  return null;
}

/**
 * 封装 derive course station rules 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveCourseStationRules(source = {}) {
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

/**
 * 规范化 course station rules，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseStationRules(...sources) {
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

/**
 * 封装 derive course switch rule from sources 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveCourseSwitchRuleFromSources(sources = []) {

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

/**
 * 规范化 course top level metadata，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseTopLevelMetadata(source = {}, stationRules = normalizeCourseStationRules(source)) {
  return {
    ...(isPlainObject(source?.metadata) ? clone(source.metadata) : {}),
    stationRules
  };
}

/**
 * 封装 derive course topic from type ids 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveCourseTopicFromTypeIds(typeIds = []) {
  const firstTypeId = numberList(typeIds)[0];
  if (!firstTypeId || !Array.isArray(state.lessonTypes)) {
    return "";
  }
  return trimText(state.lessonTypes.find((item) => Number(item.id) === firstTypeId)?.name);
}

/**
 * 封装 derive course metadata fields 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveCourseMetadataFields(source = {}, script = {}) {
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

/**
 * 封装 derive training panel 的业务步骤，避免调用方依赖内部实现细节。
 */
export function deriveTrainingPanel(source = {}, script) {
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

/**
 * 封装 coerce course script 的业务步骤，避免调用方依赖内部实现细节。
 */
export function coerceCourseScript(source = {}) {
  const script = source?.script
    ? cloneCourseScript(source.script)
    : convertCourseToScript(source, { actionLookup: state.actions });
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

/**
 * 同步 course station rules，让历史数据符合当前业务模型。
 */
export function syncCourseStationRules() {
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

/**
 * 封装 course summary from script 的业务步骤，避免调用方依赖内部实现细节。
 */
export function courseSummaryFromScript(script) {
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

/**
 * 判断是否满足 has waterfall playback items 条件，供调用方做分支处理。
 */
export function hasWaterfallPlaybackItems(section) {
  return Array.isArray(section?.items) && section.items.length > 0;
}

/**
 * 判断是否满足 has training playback pods 条件，供调用方做分支处理。
 */
export function hasTrainingPlaybackPods(script) {
  return Array.isArray(script?.training?.pods) && script.training.pods.length > 0;
}

/**
 * 估算 course playback duration ms，供课表和播放流程提前判断。
 */
export function estimateCoursePlaybackDurationMs(script) {
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

/**
 * 规范化 course payload，避免后续业务处理不同格式的输入。
 */
export function normalizeCoursePayload(payload = {}, existing = null) {
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

/**
 * 序列化 course，控制对外暴露字段。
 */
export function serializeCourse(course) {
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

/**
 * 序列化 course summary，控制对外暴露字段。
 */
export function serializeCourseSummary(course) {
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

/**
 * 封装 attach course basics 的业务步骤，避免调用方依赖内部实现细节。
 */
export function attachCourseBasics(schedule) {
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

/**
 * 判断是否满足 hash value 条件，供调用方做分支处理。
 */
export function hashValue(value) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

/**
 * 规范化 calendar date，避免后续业务处理不同格式的输入。
 */
export function normalizeCalendarDate(dateText, timeZone = "Asia/Shanghai") {
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

/**
 * 封装 calendar date start iso 的业务步骤，避免调用方依赖内部实现细节。
 */
export function calendarDateStartIso(dateText) {
  const normalized = trimText(dateText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }
  return new Date(`${normalized}T00:00:00.000+08:00`).toISOString();
}

/**
 * 规范化 schedule begin time payload，避免后续业务处理不同格式的输入。
 */
export function normalizeScheduleBeginTimePayload(payload = {}) {
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

/**
 * 封装 format calendar date 的业务步骤，避免调用方依赖内部实现细节。
 */
export function formatCalendarDate(dateValue, timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));
}

/**
 * 封装 add calendar days 的业务步骤，避免调用方依赖内部实现细节。
 */
export function addCalendarDays(dateText, days) {
  const base = new Date(`${dateText}T12:00:00.000+08:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatCalendarDate(base, "Asia/Shanghai");
}

/**
 * 读取 calendar week range，并保持返回结构稳定。
 */
export function getCalendarWeekRange(weekOffset = 0, timeZone = "Asia/Shanghai") {
  const today = formatCalendarDate(new Date(), timeZone);
  const anchor = new Date(`${today}T12:00:00.000+08:00`);
  const day = anchor.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  anchor.setUTCDate(anchor.getUTCDate() + delta + weekOffset * 7);
  const start = formatCalendarDate(anchor, timeZone);
  return { start, end: addCalendarDays(start, 7) };
}

/**
 * 封装 in calendar date range 的业务步骤，避免调用方依赖内部实现细节。
 */
export function inCalendarDateRange(dateValue, startDate, endDate, timeZone = "Asia/Shanghai") {
  const dateKey = formatCalendarDate(dateValue, timeZone);
  return dateKey >= startDate && dateKey < endDate;
}

/**
 * 读取 schedules by date 列表，并按业务规则过滤或排序。
 */
export function listSchedulesByDate(dateText, timeZone = "Asia/Shanghai") {
  const targetDate = normalizeCalendarDate(dateText, timeZone);

  return state.schedules
    .map(attachCourseBasics)
    .filter((item) => formatCalendarDate(item.beginTime, timeZone) === targetDate)
    .sort((left, right) => new Date(left.beginTime).getTime() - new Date(right.beginTime).getTime());
}

/**
 * 组装 action media map，把分散的输入合成稳定输出。
 */
export function buildActionMediaMap() {
  return new Map(state.actions.map((action) => [String(action.id), action?.media || null]));
}

/**
 * 解析 media url，合并请求参数、上下文和默认值。
 */
export function resolveMediaUrl(actionId, fallbackUrl = "") {
  const fallback = trimText(fallbackUrl);

  if (fallback) {
    return fallback;
  }

  return trimText(buildActionMediaMap().get(String(actionId))?.url);
}

/**
 * 解析 script media urls，合并请求参数、上下文和默认值。
 */
export function resolveScriptMediaUrls(script) {
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

/**
 * 封装 collect script resources 的业务步骤，避免调用方依赖内部实现细节。
 */
export function collectScriptResources(script) {
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

/**
 * 封装 in range 的业务步骤，避免调用方依赖内部实现细节。
 */
export function inRange(dateValue, from, to) {
  const target = new Date(dateValue).getTime();
  return target >= from.getTime() && target < to.getTime();
}

export function actionTypeAllowsUser(type = {}, user = null) {
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

/**
 * 封装 scoped record belongs to course package 的业务步骤，避免调用方依赖内部实现细节。
 */
export function scopedRecordBelongsToCoursePackage(record = {}, coursePackageId = 0) {
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

/**
 * 封装 action type matches course package scope 的业务步骤，避免调用方依赖内部实现细节。
 */
export function actionTypeMatchesCoursePackageScope(type = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(type, options?.coursePackageId);
}

/**
 * 封装 lesson type allows user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function lessonTypeAllowsUser(type = {}, user = null) {
  return actionTypeAllowsUser(type, user);
}

/**
 * 封装 lesson type matches course package scope 的业务步骤，避免调用方依赖内部实现细节。
 */
export function lessonTypeMatchesCoursePackageScope(type = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(type, options?.coursePackageId);
}

/**
 * 封装 action matches course package scope 的业务步骤，避免调用方依赖内部实现细节。
 */
export function actionMatchesCoursePackageScope(action = {}, options = {}) {
  return scopedRecordBelongsToCoursePackage(action, options?.coursePackageId);
}

/**
 * 封装 course type tags from type ids 的业务步骤，避免调用方依赖内部实现细节。
 */
export function courseTypeTagsFromTypeIds(typeIds = []) {
  const ids = new Set(numberList(typeIds));
  return normalizeCourseTags(
    (state.lessonTypes || [])
      .filter((type) => ids.has(Number(type.id)))
      .map((type) => type.name)
  );
}

/**
 * 封装 collect action ids from course script 的业务步骤，避免调用方依赖内部实现细节。
 */
export function collectActionIdsFromCourseScript(script = {}) {
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

/**
 * 同步 action course tags for course，让历史数据符合当前业务模型。
 */
export function syncActionCourseTagsForCourse(course = {}) {
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

/**
 * 同步 all action course tags from courses，让历史数据符合当前业务模型。
 */
export function syncAllActionCourseTagsFromCourses() {
  const changed = (state.courses || []).reduce((didChange, course) => syncActionCourseTagsForCourse(course) || didChange, false);

  if (changed) {
    persist();
  }
}

/**
 * 规范化 course identity text，避免后续业务处理不同格式的输入。
 */
export function normalizeCourseIdentityText(value) {
  return trimText(value).toLocaleLowerCase();
}

/**
 * 查找 tv screen for request，找不到时返回空值而不是抛错。
 */
export function findTvScreenForRequest(payload = {}, accountNamespace = "") {
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

/**
 * 解析 tv request account namespace，合并请求参数、上下文和默认值。
 */
export function resolveTvRequestAccountNamespace(accountNamespace = "", payload = {}) {
  const requestedNamespace = normalizeScreenAccountNamespace(accountNamespace);
  const matchedScreen = findTvScreenForRequest(payload, requestedNamespace);
  const boundNamespace = normalizeScreenAccountNamespace(matchedScreen?.accountNamespace);
  return boundNamespace || requestedNamespace;
}

/**
 * 装饰 tv device snapshot 的业务步骤，避免调用方依赖内部实现细节。
 */
export function decorateTvDeviceSnapshot(snapshot) {
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

/**
 * 封装 schedule has existing course 的业务步骤，避免调用方依赖内部实现细节。
 */
export function scheduleHasExistingCourse(schedule) {
  const courseId = Number(schedule?.courseId);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return false;
  }
  return state.courses.some((course) => Number(course.id) === courseId);
}

/**
 * 封装 schedule calendar date 的业务步骤，避免调用方依赖内部实现细节。
 */
export function scheduleCalendarDate(schedule) {
  return schedule?.beginTime ? formatCalendarDate(schedule.beginTime, "Asia/Shanghai") : trimText(schedule?.date);
}

/**
 * 读取 schedules in week 列表，并按业务规则过滤或排序。
 */
export function listSchedulesInWeek(coursePackageId, weekStart, weekEnd) {
  return state.schedules
    .filter((item) => scheduleMatchesCoursePackage(item, coursePackageId))
    .filter((item) => inCalendarDateRange(item.beginTime, weekStart, weekEnd));
}

/**
 * 读取 copyable schedules in week 列表，并按业务规则过滤或排序。
 */
export function listCopyableSchedulesInWeek(coursePackageId, weekStart, weekEnd) {
  return listSchedulesInWeek(coursePackageId, weekStart, weekEnd).filter(scheduleHasExistingCourse);
}

/**
 * 解析 schedule week start，把字符串转换成可靠的结构化值。
 */
export function parseScheduleWeekStart(value, fieldLabel) {
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

/**
 * 封装 calendar date diff days 的业务步骤，避免调用方依赖内部实现细节。
 */
export function calendarDateDiffDays(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00.000+08:00`);
  const to = new Date(`${toDate}T00:00:00.000+08:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 封装 target week conflict error 的业务步骤，避免调用方依赖内部实现细节。
 */
export function targetWeekConflictError() {
  const error = new Error("目标周已有排课。");
  error.statusCode = 409;
  return error;
}

/**
 * 读取 default course package id，并保持返回结构稳定。
 */
export function getDefaultCoursePackageId() {
  const packages = Array.isArray(state.coursePackages) ? state.coursePackages : [];
  return normalizeCoursePackageId(packages.find((item) => item.isDefault)?.id || packages[0]?.id || 1);
}

/**
 * 读取 course package by id internal，并保持返回结构稳定。
 */
export function getCoursePackageByIdInternal(coursePackageId) {
  const id = normalizeCoursePackageId(coursePackageId, 0);

  if (!id) {
    return null;
  }
  return (state.coursePackages || []).find((item) => normalizeCoursePackageId(item.id) === id) || null;
}

/**
 * 序列化 course package，控制对外暴露字段。
 */
export function serializeCoursePackage(item) {
  const record = normalizeCoursePackageRecord(item);
  return {
    ...record,
    courseCount: record.courseIds.length
  };
}

/**
 * 读取 course package course id set，并保持返回结构稳定。
 */
export function getCoursePackageCourseIdSet(coursePackageId = "") {
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

/**
 * 封装 course package allows course 的业务步骤，避免调用方依赖内部实现细节。
 */
export function coursePackageAllowsCourse(coursePackageId, courseId) {
  const allowedCourseIds = getCoursePackageCourseIdSet(coursePackageId);

  if (!allowedCourseIds) {
    return true;
  }
  return allowedCourseIds.has(Number(courseId));
}

/**
 * 读取 user visible course package id set，并保持返回结构稳定。
 */
export function getUserVisibleCoursePackageIdSet(user = null) {
  if (!user || isSuperAdminUser(user)) {
    return null;
  }
  return new Set(normalizeUserPackageIds(user.coursePackageIds));
}

/**
 * 读取 user visible course id set，并保持返回结构稳定。
 */
export function getUserVisibleCourseIdSet(user = null) {
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

/**
 * 封装 user identity text 的业务步骤，避免调用方依赖内部实现细节。
 */
export function userIdentityText(user = null) {
  return trimText(user?.username || user?.nickname || user?.accountNamespace);
}

/**
 * 封装 valid course package id set 的业务步骤，避免调用方依赖内部实现细节。
 */
export function validCoursePackageIdSet() {
  return new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id, 0)).filter(Boolean));
}

/**
 * 封装 sanitize course package ids 的业务步骤，避免调用方依赖内部实现细节。
 */
export function sanitizeCoursePackageIds(value) {
  const validIds = validCoursePackageIdSet();
  return [...new Set(numberList(value).filter((id) => validIds.has(id)))];
}

/**
 * 解析 write course package ids，合并请求参数、上下文和默认值。
 */
export function resolveWriteCoursePackageIds(user = null, requestedIds = [], existingIds = []) {
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

/**
 * 解析 write course package id，合并请求参数、上下文和默认值。
 */
export function resolveWriteCoursePackageId(user = null, requestedId = 0, existingId = 0) {
  return resolveWriteCoursePackageIds(user, [requestedId].filter(Boolean), [existingId].filter(Boolean))[0] || 0;
}

/**
 * 封装 prepare action owner payload 的业务步骤，避免调用方依赖内部实现细节。
 */
export function prepareActionOwnerPayload(payload = {}, existing = null, user = null) {
  const ownerUsername = userIdentityText(user) || trimText(existing?.ownerUsername || existing?.author);
  const coursePackageIds = resolveWriteCoursePackageIds(user, payload.coursePackageIds, existing?.coursePackageIds);
  return {
    ...payload,
    coursePackageIds,
    ownerUsername,
    author: ownerUsername || trimText(payload.author || existing?.author)
  };
}

/**
 * 封装 prepare course owner payload 的业务步骤，避免调用方依赖内部实现细节。
 */
export function prepareCourseOwnerPayload(payload = {}, existing = null, user = null) {
  const ownerUsername = userIdentityText(user) || trimText(existing?.ownerUsername || existing?.author);
  const creator = trimText(payload.creator) || trimText(existing?.creator) || ownerUsername;
  return {
    ...payload,
    creator,
    ownerUsername,
    author: ownerUsername || trimText(payload.author || existing?.author)
  };
}

/**
 * 封装 action allows user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function actionAllowsUser(action = {}, user = null) {
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

/**
 * 封装 course allows user 的业务步骤，避免调用方依赖内部实现细节。
 */
export function courseAllowsUser(course = {}, user = null) {
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

/**
 * 规范化 venue package ids，避免后续业务处理不同格式的输入。
 */
export function normalizeVenuePackageIds(value) {
  const ids = numberList(value);
  const validIds = new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id)));
  const filtered = ids.filter((id) => validIds.has(id));
  return filtered.length ? [...new Set(filtered)] : [getDefaultCoursePackageId()];
}

/**
 * 解析 venue active course package id，合并请求参数、上下文和默认值。
 */
export function resolveVenueActiveCoursePackageId(venue) {
  const boundIds = normalizeVenuePackageIds(venue?.coursePackageIds);
  const activeId = normalizeCoursePackageId(venue?.activeCoursePackageId, 0);
  return boundIds.includes(activeId) ? activeId : boundIds[0];
}

/**
 * 规范化 user package ids，避免后续业务处理不同格式的输入。
 */
export function normalizeUserPackageIds(value) {
  const ids = numberList(value);
  const validIds = new Set((state.coursePackages || []).map((item) => normalizeCoursePackageId(item.id)));
  return [...new Set(ids.filter((id) => validIds.has(id)))];
}

/**
 * 读取 active course package id for namespace，并保持返回结构稳定。
 */
export function getActiveCoursePackageIdForNamespace(accountNamespace = "") {
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

/**
 * 推断 course package id for course，从文件名或上下文补齐缺失信息。
 */
export function inferCoursePackageIdForCourse(courseId) {
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

/**
 * 封装 schedule matches course package 的业务步骤，避免调用方依赖内部实现细节。
 */
export function scheduleMatchesCoursePackage(schedule, coursePackageId) {
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

/**
 * 判断是否满足 is venue playback active 条件，供调用方做分支处理。
 */
export function isVenuePlaybackActive(venue) {
  const ns = normalizeAccountNamespace(venue?.accountNamespace);

  if (!ns) {
    return false;
  }
  return Boolean(getActivePlaybackSessionEntry(ns));
}

/**
 * 读取 course packages for user 列表，并按业务规则过滤或排序。
 */
export function listCoursePackagesForUser(user = null) {
  const visiblePackageIds = getUserVisibleCoursePackageIdSet(user);
  return sortByNewest(state.coursePackages || [], "updateTime")
    .map(serializeCoursePackage)
    .filter((item) => !visiblePackageIds || visiblePackageIds.has(Number(item.id)));
}
