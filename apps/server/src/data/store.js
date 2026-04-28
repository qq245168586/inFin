import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloneCourseScript,
  createTrainingPanel,
  courseScriptUsesAction,
  legacyCourseToScript,
  summarizeCourseScript,
  validateCourseScript
} from "../../../../packages/shared/src/course-script.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyStorageRoot = path.resolve(__dirname, "../../storage");
const storageRoot = path.resolve(process.env.INFINI_DATA_ROOT || legacyStorageRoot);
const mediaRoot = path.join(storageRoot, "media");
const appPackageRoot = path.join(storageRoot, "app-packages");
const backupRoot = path.join(storageRoot, "backups");
const dbFile = path.join(storageRoot, "db.json");
const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 15 * 24 * 60 * 60;
const TV_SCREEN_COUNT = 5;
const TV_ONLINE_THRESHOLD_MS = 35 * 1000;
const DB_BACKUP_RETENTION = 120;
const DEFAULT_ACCOUNT_NAMESPACE = "13689547720";
const CONSOLE_ACCOUNT_PRESETS = [
  {
    username: "13689547720",
    password: "REDACTED_CONFIGURE_LOCALLY",
    nickname: "正式环境",
    accountNamespace: "13689547720",
    environmentLabel: "正式环境",
    allowedClients: ["coach-web", "editor-web"]
  },
  {
    username: "zhiyou",
    password: "REDACTED_CONFIGURE_LOCALLY",
    nickname: "测试环境",
    accountNamespace: "zhiyou",
    environmentLabel: "测试环境",
    allowedClients: ["coach-web", "editor-web"]
  }
];

ensureDir(storageRoot);
ensureDir(mediaRoot);
ensureDir(appPackageRoot);
ensureDir(backupRoot);
migrateLegacyStorageIfNeeded();

const defaultState = createDefaultState();
let state = loadState();
ensureConsoleAccountSeeds();

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

function numberList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAccountNamespace(value, fallback = DEFAULT_ACCOUNT_NAMESPACE) {
  const text = trimText(value).toLowerCase();
  return text || fallback;
}

function normalizeScreenAccountNamespace(value) {
  return trimText(value).toLowerCase();
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
  return matched?.environmentLabel || "自定义环境";
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
    actionTypes,
    lessonTypes,
    actions,
    courses,
    templates,
    schedules,
    tvScreens: [],
    users: [],
    authSessions: []
  };
}

function ensureConsoleAccountSeeds() {
  let changed = false;

  state.users = (state.users || []).map((user) => {
    const normalizedAccountNamespace = normalizeAccountNamespace(user.accountNamespace || user.username);
    const environmentLabel = trimText(user.environmentLabel) || environmentLabelForNamespace(normalizedAccountNamespace);
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
      const nextEnvironmentLabel = trimText(existing.environmentLabel) || preset.environmentLabel;
      const nextNickname = trimText(existing.nickname) || preset.nickname;
      const nextPasswordDigest = existing.passwordDigest || normalizePassword(preset.password);
      if (
        nextAccountNamespace !== trimText(existing.accountNamespace)
        || nextEnvironmentLabel !== trimText(existing.environmentLabel)
        || nextNickname !== trimText(existing.nickname)
        || nextPasswordDigest !== existing.passwordDigest
        || JSON.stringify(normalizeAllowedClients(existing.allowedClients)) !== JSON.stringify(normalizeAllowedClients(preset.allowedClients))
      ) {
        existing.accountNamespace = nextAccountNamespace;
        existing.environmentLabel = nextEnvironmentLabel;
        existing.nickname = nextNickname;
        existing.passwordDigest = nextPasswordDigest;
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
      allowedClients: normalizeAllowedClients(preset.allowedClients),
      createTime: nowIso(),
      lastLoginTime: null
    });
    changed = true;
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

function normalizeLoadedState(parsed) {
  return {
    media: Array.isArray(parsed.media) ? parsed.media : [],
    appPackages: Array.isArray(parsed.appPackages) ? parsed.appPackages : clone(defaultState.appPackages),
    actionTypes: Array.isArray(parsed.actionTypes) ? parsed.actionTypes : clone(defaultState.actionTypes),
    lessonTypes: Array.isArray(parsed.lessonTypes) ? parsed.lessonTypes : clone(defaultState.lessonTypes),
    actions: Array.isArray(parsed.actions) ? parsed.actions : clone(defaultState.actions),
    courses: Array.isArray(parsed.courses) ? parsed.courses : clone(defaultState.courses),
    templates: Array.isArray(parsed.templates) ? parsed.templates : clone(defaultState.templates),
    schedules: Array.isArray(parsed.schedules) ? parsed.schedules : clone(defaultState.schedules),
    tvScreens: Array.isArray(parsed.tvScreens)
      ? parsed.tvScreens.map((item) => ({
          ...item,
          accountNamespace: normalizeScreenAccountNamespace(item?.accountNamespace)
        }))
      : clone(defaultState.tvScreens),
    users: Array.isArray(parsed.users)
      ? parsed.users.map((item) => ({
          ...item,
          accountNamespace: normalizeAccountNamespace(item?.accountNamespace || item?.username),
          environmentLabel:
            trimText(item?.environmentLabel)
            || environmentLabelForNamespace(item?.accountNamespace || item?.username)
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
  const cleaned = stripSeedCourseExamples(normalizeLoadedState(parsed));
  return {
    state: cleaned.state,
    changed: cleaned.changed
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
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    gender: user.gender,
    accountNamespace: normalizeAccountNamespace(user.accountNamespace || user.username),
    environmentLabel: trimText(user.environmentLabel) || environmentLabelForNamespace(user.accountNamespace || user.username),
    allowedClients: normalizeAllowedClients(user.allowedClients)
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
  const tokenType = "Bearer";
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const session = {
    id: nextId(state.authSessions),
    userId,
    client: normalizeClientName(clientName),
    tokenType,
    accessToken,
    refreshToken,
    expiresAt: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS),
    refreshExpiresAt: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
    createTime: nowIso()
  };

  state.authSessions = state.authSessions.filter((item) => item.userId !== userId);
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
  return {
    id: existing?.id ?? nextId(state.actions),
    name: trimText(payload.name),
    typeIds: numberList(payload.typeIds),
    media: payload.media ?? existing?.media ?? null,
    createTime: existing?.createTime ?? timestamp,
    updateTime: timestamp
  };
}

function normalizeTvPlaybackState(value) {
  const stateText = trimText(value).toUpperCase();
  if (["IDLE", "SYNCING", "PREVIEW", "RUNNING", "PAUSED"].includes(stateText)) {
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

function buildTvScreenSnapshot(entry = null) {
  const lastSeenAt = trimText(entry?.lastSeenAt);
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  const online = lastSeenMs > 0 && Date.now() - lastSeenMs <= TV_ONLINE_THRESHOLD_MS;
  const screenNumber = Number(entry?.screenNumber) || 0;
  const accountNamespace = normalizeScreenAccountNamespace(entry?.accountNamespace);

  return {
    accountNamespace,
    screenNumber,
    orientation: screenNumber === 2 || screenNumber === 4 ? "HORIZONTAL" : "VERTICAL",
    deviceId: trimText(entry?.deviceId),
    mqttClientId: trimText(entry?.mqttClientId),
    appVersion: trimText(entry?.appVersion),
    platform: trimText(entry?.platform) || "tv-android",
    boundAt: trimText(entry?.boundAt),
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

function normalizeTvScreenPayload(payload = {}, existing = null, fallbackAccountNamespace = DEFAULT_ACCOUNT_NAMESPACE) {
  const now = nowIso();
  const nextPairToken = trimText(payload.pairToken) || trimText(existing?.pairToken);
  const nextScreenNumber = Number(payload.screenNumber) || Number(existing?.screenNumber) || 0;
  const payloadAccountNamespace = trimText(payload.accountNamespace).toLowerCase();
  const existingAccountNamespace = normalizeScreenAccountNamespace(existing?.accountNamespace);
  const nextAccountNamespace =
    nextScreenNumber >= 1
      ? (
        payloadAccountNamespace
        || existingAccountNamespace
        || normalizeScreenAccountNamespace(fallbackAccountNamespace)
      )
      : "";
  return {
    accountNamespace: nextAccountNamespace,
    screenNumber: nextScreenNumber,
    deviceId: trimText(payload.deviceId) || trimText(existing?.deviceId),
    mqttClientId: trimText(payload.mqttClientId) || trimText(existing?.mqttClientId),
    appVersion: trimText(payload.appVersion) || trimText(existing?.appVersion),
    platform: trimText(payload.platform) || trimText(existing?.platform) || "tv-android",
    boundAt: trimText(existing?.boundAt) || now,
    lastSeenAt: now,
    playbackState: normalizeTvPlaybackState(payload.playbackState || existing?.playbackState),
    activeScheduleId: trimText(payload.activeScheduleId) || trimText(existing?.activeScheduleId),
    previewMode:
      typeof payload.previewMode === "boolean" ? payload.previewMode : Boolean(existing?.previewMode),
    playbackSessionId: trimText(payload.playbackSessionId) || trimText(existing?.playbackSessionId),
    bundleChecksum: trimText(payload.bundleChecksum) || trimText(existing?.bundleChecksum),
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

  return {
    id: videoGroup.id || templateUid("template-group"),
    name: trimText(videoGroup.name) || (screenCount === 1 ? "单屏瀑布组" : "三屏视频组"),
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) => {
      const screenIndex = index + 1;
      const rawScreen = rawScreens.find((item) => Number(item.screenIndex) === screenIndex) || {};
      const rawCards = Array.isArray(rawScreen.videoCards) && rawScreen.videoCards.length ? rawScreen.videoCards : [{}];

      return {
        id: rawScreen.id || templateUid("template-group-screen"),
        screenIndex,
        stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
        layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
        videoCards: rawCards.map((card) => ({
          id: card.id || templateUid("template-video-card"),
          actionId: String(card.actionId || ""),
          actionName: resolveActionName(card.actionId, card.actionName),
          stationNumber: screenCount === 1 ? "" : trimText(card.stationNumber)
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

  if (![1, 3].includes(videoGroup.screenCount)) {
    issues.push("正式组模板只允许单屏或三屏。");
  }

  videoGroup.screens.forEach((screen) => {
    if (!screen.videoCards.length) {
      issues.push(`屏幕 ${screen.screenIndex} 至少需要一个动作卡片。`);
    }
    if (videoGroup.screenCount !== 1) {
      const stationCodes = screen.videoCards.map((card) => trimText(card.stationNumber));
      if (stationCodes.some((code) => !code)) {
        issues.push(`屏幕 ${screen.screenIndex} 的站点标签不能为空。`);
      }
      if (new Set(stationCodes).size !== stationCodes.length) {
        issues.push(`屏幕 ${screen.screenIndex} 的站点标签不能重复。`);
      }
    }
  });

  return issues;
}

function normalizeTemplatePayload(payload = {}, existing = null) {
  const kind = ["warmup", "cooldown", "training"].includes(payload.kind) ? payload.kind : existing?.kind;
  if (!kind) {
    throw new Error("模板类型无效。");
  }

  const timestamp = nowIso();
  const base = {
    id: existing?.id ?? nextId(state.templates),
    kind,
    name: trimText(payload.name),
    createTime: existing?.createTime ?? timestamp,
    updateTime: timestamp
  };

  const next =
    kind === "training"
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

function serializeTemplate(template) {
  return clone(template);
}

function listTemplatesByKind(kind) {
  return sortByNewest(
    state.templates.filter((item) => item.kind === kind),
    "updateTime"
  ).map(serializeTemplate);
}

function defaultHydrateSecondsFromCourse(course) {
  const rawValue = course?.script?.metadata?.defaultHydrateSeconds ?? course?.metadata?.defaultHydrateSeconds;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : 0;
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

  script.metadata = {
    ...script.metadata,
    name: trimText(source.name) || script.metadata?.name || "新课程",
    version: trimText(source.version) || script.metadata?.version || "v1.0.0",
    creator: trimText(source.creator) || script.metadata?.creator || "",
    defaultHydrateSeconds: defaultHydrateSecondsFromCourse(source),
    trainingPanel: deriveTrainingPanel(source, script)
  };

  return script;
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

function normalizeCoursePayload(payload = {}, existing = null) {
  const timestamp = nowIso();
  const script = coerceCourseScript({
    ...(existing || {}),
    ...payload
  });
  const issues = validateCourseScript(script);

  if (issues.length) {
    throw new Error(issues.join("\n"));
  }

  return {
    id: existing?.id ?? nextId(state.courses),
    name: trimText(payload.name) || script.metadata.name,
    creator: trimText(payload.creator) || script.metadata.creator,
    version: trimText(payload.version) || script.metadata.version,
    typeIds: numberList(payload.typeIds ?? existing?.typeIds),
    logoMedia: payload.logoMedia ?? existing?.logoMedia ?? null,
    script,
    summary: courseSummaryFromScript(script),
    updateTime: timestamp
  };
}

function serializeCourse(course) {
  const script = coerceCourseScript(course);
  return {
    ...course,
    name: trimText(course.name) || script.metadata.name,
    creator: trimText(course.creator) || script.metadata.creator,
    version: trimText(course.version) || script.metadata.version,
    typeIds: numberList(course.typeIds),
    logoMedia: course.logoMedia ?? null,
    script,
    summary: course.summary || courseSummaryFromScript(script)
  };
}

function attachCourseBasics(schedule) {
  const course = state.courses.find((item) => item.id === schedule.courseId);
  const serialized = course ? serializeCourse(course) : null;
  return {
    ...schedule,
    courseName: schedule.courseName || serialized?.name || "",
    version: schedule.version || serialized?.version || ""
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

function formatCalendarDate(dateValue, timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));
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
    courseName: schedule.courseName,
    version: schedule.version,
    beginTime: schedule.beginTime,
    duration: schedule.duration,
    course: {
      ...course,
      script: resolvedScript
    }
  };

  entry.contentChecksum = hashValue({
    schedule: {
      id: entry.id,
      courseId: entry.courseId,
      courseName: entry.courseName,
      version: entry.version,
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

export function getMetaPayload() {
  return {
    actionTypes: clone(state.actionTypes),
    lessonTypes: clone(state.lessonTypes),
    actions: sortByNewest(state.actions, "updateTime"),
    courses: sortByNewest(state.courses, "updateTime").map(serializeCourse),
    templates: {
      warmup: listTemplatesByKind("warmup"),
      cooldown: listTemplatesByKind("cooldown"),
      training: listTemplatesByKind("training")
    },
    schedules: {
      currentWeek: listSchedulesByScope("CURRENTWEEK"),
      lastWeek: listSchedulesByScope("LASTWEEK"),
      history: listSchedulesByScope("HISTORY")
    }
  };
}

export function listActionTypes() {
  return clone(state.actionTypes);
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
    accountNamespace: normalizeAccountNamespace(payload.accountNamespace || username),
    environmentLabel:
      trimText(payload.environmentLabel)
      || environmentLabelForNamespace(payload.accountNamespace || username),
    allowedClients: normalizeAllowedClients(payload.allowedClients),
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
  existing.allowedClients = normalizeAllowedClients(payload.allowedClients || existing.allowedClients);
  if (payload.password) {
    existing.passwordDigest = normalizePassword(payload.password);
  }
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

export function addActionType(name) {
  const next = { id: nextId(state.actionTypes), name: trimText(name) };
  state.actionTypes.push(next);
  persist();
  return next;
}

export function listLessonTypes() {
  return clone(state.lessonTypes);
}

export function addLessonType(name) {
  const next = { id: nextId(state.lessonTypes), name: trimText(name) };
  state.lessonTypes.push(next);
  persist();
  return next;
}

export function listActions() {
  return sortByNewest(state.actions, "updateTime");
}

export function getActionById(actionId) {
  return state.actions.find((item) => item.id === Number(actionId)) ?? null;
}

export function saveAction(payload) {
  const existing = payload.id ? getActionById(payload.id) : null;
  const next = normalizeActionPayload(payload, existing);
  const index = state.actions.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.actions[index] = next;
  } else {
    state.actions.push(next);
  }

  persist();
  return next;
}

export function deleteAction(actionId) {
  const numericId = Number(actionId);
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

export function listCourses() {
  return sortByNewest(state.courses, "updateTime").map(serializeCourse);
}

export function getCourseById(courseId) {
  const course = state.courses.find((item) => item.id === Number(courseId)) ?? null;
  return course ? serializeCourse(course) : null;
}

export function saveCourse(payload) {
  const existing = payload.id ? getCourseById(payload.id) : null;
  const next = normalizeCoursePayload(payload, existing);
  const index = state.courses.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.courses[index] = next;
  } else {
    state.courses.push(next);
  }

  persist();
  return next;
}

export function deleteCourse(courseId) {
  const numericId = Number(courseId);
  const usedBySchedule = state.schedules.some((item) => item.courseId === numericId);

  if (usedBySchedule) {
    return { ok: false, message: "课程已有排课，暂时不能删除。" };
  }

  state.courses = state.courses.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

export function listTemplates() {
  return {
    warmup: listTemplatesByKind("warmup"),
    cooldown: listTemplatesByKind("cooldown"),
    training: listTemplatesByKind("training")
  };
}

export function getTemplateById(templateId) {
  const template = state.templates.find((item) => item.id === Number(templateId)) ?? null;
  return template ? serializeTemplate(template) : null;
}

export function saveTemplate(payload) {
  const existing = payload.id ? getTemplateById(payload.id) : null;
  const next = normalizeTemplatePayload(payload, existing);
  const index = state.templates.findIndex((item) => item.id === next.id);

  if (index >= 0) {
    state.templates[index] = next;
  } else {
    state.templates.push(next);
  }

  persist();
  return serializeTemplate(next);
}

export function deleteTemplate(templateId) {
  const numericId = Number(templateId);
  state.templates = state.templates.filter((item) => item.id !== numericId);
  persist();
  return { ok: true };
}

export function listCourseOptions() {
  return sortByNewest(state.courses, "updateTime").map((course) => {
    const serialized = serializeCourse(course);
    return {
      id: serialized.id,
      name: serialized.name,
      version: serialized.version,
      creator: serialized.creator
    };
  });
}

export function listSchedulesByScope(scope = "CURRENTWEEK") {
  const monday = startOfWeek(new Date());
  const nextMonday = endOfWeek(new Date());
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  let list = state.schedules.map(attachCourseBasics);

  if (scope === "CURRENTWEEK") {
    list = list.filter((item) => inRange(item.beginTime, monday, nextMonday));
  } else if (scope === "LASTWEEK") {
    list = list.filter((item) => inRange(item.beginTime, lastMonday, monday));
  }

  return list.sort((left, right) => {
    const leftTime = new Date(left.beginTime).getTime();
    const rightTime = new Date(right.beginTime).getTime();
    return scope === "HISTORY" ? rightTime - leftTime : leftTime - rightTime;
  });
}

export function getTvDailyBundle(dateText, timeZone = "Asia/Shanghai") {
  const date = normalizeCalendarDate(dateText, timeZone);
  const schedules = listSchedulesByDate(date, timeZone)
    .map(buildTvScheduleEntry)
    .filter(Boolean);

  const resourceMap = new Map();
  for (const schedule of schedules) {
    for (const resource of schedule.resources || []) {
      resourceMap.set(resource.key, resource);
    }
  }

  const resources = [...resourceMap.values()].sort((left, right) => left.key.localeCompare(right.key));
  const checksum = hashValue({
    date,
    schedules: schedules.map((item) => ({
      id: item.id,
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
    checksum,
    generatedAt: nowIso(),
    scheduleCount: schedules.length,
    schedules,
    resources
  };
}

export function getTvDailyChecksum(dateText, timeZone = "Asia/Shanghai") {
  const bundle = getTvDailyBundle(dateText, timeZone);
  return {
    date: bundle.date,
    timeZone: bundle.timeZone,
    checksum: bundle.checksum,
    generatedAt: bundle.generatedAt,
    scheduleCount: bundle.scheduleCount,
    schedules: bundle.schedules.map((item) => ({
      id: item.id,
      courseId: item.courseId,
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

export function bindTvScreen(payload = {}, accountNamespace = "") {
  return upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
}

export function heartbeatTvScreen(payload = {}, accountNamespace = "") {
  return upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
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

  const nextEntry = {
    ...existing,
    accountNamespace: "",
    playbackState: "IDLE",
    activeScheduleId: "",
    previewMode: false,
    playbackSessionId: "",
    bundleChecksum: "",
    playbackElapsedMs: 0,
    pairToken: "",
    pairUpdatedAt: "",
    lastSeenAt: nowIso()
  };

  state.tvScreens = state.tvScreens.filter((item) => trimText(item.deviceId) !== trimText(existing.deviceId));
  state.tvScreens.push(nextEntry);
  persist();
  return buildTvScreenSnapshot(nextEntry);
}

export function listTvScreens() {
  const accountNamespace =
    arguments.length > 0 ? normalizeAccountNamespace(arguments[0]) : DEFAULT_ACCOUNT_NAMESPACE;
  const snapshots = new Map();
  for (const item of state.tvScreens || []) {
    const snapshot = buildTvScreenSnapshot(item);
    if (snapshot.deviceId) {
      const snapshotAccountNamespace = normalizeScreenAccountNamespace(snapshot.accountNamespace);

      if (!snapshotAccountNamespace) {
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
          cacheUpdatedAt: ""
        }
      );
    }),
    unboundDevices: []
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

export function saveSchedule(payload) {
  const courseId = Number(payload.courseId);
  const course = getCourseById(courseId);

  if (!course) {
    return null;
  }

  const next = {
    id: payload.id ? Number(payload.id) : nextId(state.schedules),
    courseId,
    courseName: course.name,
    version: trimText(payload.version) || course.version,
    beginTime: trimText(payload.beginTime),
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

export function copyLastWeekSchedules() {
  const monday = startOfWeek(new Date());
  const nextMonday = endOfWeek(new Date());
  const lastWeek = listSchedulesByScope("LASTWEEK");

  state.schedules = state.schedules.filter((item) => !inRange(item.beginTime, monday, nextMonday));

  let nextScheduleId = nextId(state.schedules);

  const copied = lastWeek.map((item) => {
    const nextDate = new Date(item.beginTime);
    nextDate.setDate(nextDate.getDate() + 7);

    return {
      id: nextScheduleId++,
      courseId: item.courseId,
      courseName: item.courseName,
      version: item.version,
      beginTime: nextDate.toISOString(),
      duration: item.duration
    };
  });

  state.schedules.push(...copied);
  persist();
  return copied.map(attachCourseBasics);
}
