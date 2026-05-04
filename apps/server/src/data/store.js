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
const PLAYBACK_ACTIVE_STATES = new Set(["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED"]);
const PLAYBACK_TERMINAL_STATES = new Set(["ENDED", "TERMINATED"]);
const PLAYBACK_WARMUP_READY_SECONDS = 15;
const PLAYBACK_TRAINING_READY_SECONDS = 15;
const PLAYBACK_COOLDOWN_READY_SECONDS = 10;
const DEFAULT_ACCOUNT_NAMESPACE = "13689547720";
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

function normalizeVenueAccountNamespace(value) {
  return trimText(value).toLowerCase();
}

function normalizeVenueId(value) {
  return trimText(value);
}

function normalizeScheduleEntry(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  return {
    id: Number(raw.id) || 0,
    venueId: normalizeVenueId(raw.venueId),
    courseId: Number(raw.courseId) || 0,
    courseName: trimText(raw.courseName),
    version: trimText(raw.version),
    beginTime: trimText(raw.beginTime),
    duration: Number(raw.duration) || 0
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
        state.tvScreens = (state.tvScreens || []).map((screen) =>
          normalizeScreenAccountNamespace(screen.accountNamespace) === ns ? { ...screen, accountNamespace: "" } : screen
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

function attachLegacySchedulesToSingleVenue(source) {
  const venues = Array.isArray(source?.venues) ? source.venues : [];
  const schedules = Array.isArray(source?.schedules) ? source.schedules : [];

  if (venues.length !== 1 || schedules.length === 0) {
    return { state: source, changed: false };
  }

  const venueId = trimText(venues[0]?.id || "");
  if (!venueId) {
    return { state: source, changed: false };
  }

  let changed = false;
  const nextSchedules = schedules.map((schedule) => {
    const existingVenueId = normalizeVenueId(schedule?.venueId);
    if (existingVenueId) {
      return schedule;
    }
    changed = true;
    return { ...schedule, venueId };
  });

  if (!changed) {
    return { state: source, changed: false };
  }

  return {
    changed: true,
    state: {
      ...source,
      schedules: nextSchedules
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
    schedules: Array.isArray(parsed.schedules)
      ? parsed.schedules.map(normalizeScheduleEntry)
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
      ? parsed.venues.map((item) => ({
          ...item,
          id: trimText(item?.id) || String(item?.id || ""),
          name: trimText(item?.name),
          accountNamespace: normalizeAccountNamespace(item?.accountNamespace),
          createTime: trimText(item?.createTime),
          updateTime: trimText(item?.updateTime)
        }))
      : clone(defaultState.venues),
    users: Array.isArray(parsed.users)
      ? parsed.users.map((item) => ({
          ...item,
          accountNamespace: normalizeAccountNamespace(item?.accountNamespace || item?.username),
          environmentLabel:
            trimText(item?.environmentLabel)
            || environmentLabelForNamespace(item?.accountNamespace || item?.username),
          role: trimText(item?.role) || (SUPERADMIN_USERNAMES.has(trimText(item?.username)) ? "superadmin" : "venue"),
          venueId: trimText(item?.venueId) || ""
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
  const normalized = normalizeLoadedState(parsed);
  const stripped = stripSeedCourseExamples(normalized);
  const migrated = attachLegacySchedulesToSingleVenue(stripped.state);
  const changed = stripped.changed || migrated.changed;
  return {
    state: migrated.state,
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
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    gender: user.gender,
    accountNamespace: normalizeAccountNamespace(user.accountNamespace || user.username),
    environmentLabel: trimText(user.environmentLabel) || environmentLabelForNamespace(user.accountNamespace || user.username),
    role: trimText(user.role) || (SUPERADMIN_USERNAMES.has(trimText(user.username)) ? "superadmin" : "venue"),
    venueId: trimText(user.venueId) || "",
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
  const state = normalizePlaybackState(entry.state, serverStartAtMs > 0 ? "RUNNING" : "PREVIEW");
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
  const readySeconds =
    (hasWaterfallPlaybackItems(script.sections?.warmup) ? PLAYBACK_WARMUP_READY_SECONDS : 0)
    + (hasTrainingPlaybackPods(script) ? PLAYBACK_TRAINING_READY_SECONDS : 0)
    + (hasWaterfallPlaybackItems(script.sections?.cooldown) ? PLAYBACK_COOLDOWN_READY_SECONDS : 0);
  const totalSeconds = safeNumber(summary.totalSeconds) + readySeconds;
  return totalSeconds > 0 ? totalSeconds * 1000 : 0;
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

function listSchedulesByDate(dateText, timeZone = "Asia/Shanghai", venueId = "") {
  const targetDate = normalizeCalendarDate(dateText, timeZone);
  const venueFilterId = normalizeVenueId(venueId);

  return state.schedules
    .map(attachCourseBasics)
    .filter((item) => (venueFilterId ? normalizeVenueId(item.venueId) === venueFilterId : true))
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

export function getMetaPayload(venueId = "") {
  const venueFilterId = normalizeVenueId(venueId);
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
      currentWeek: listSchedulesByScope("CURRENTWEEK", venueFilterId),
      lastWeek: listSchedulesByScope("LASTWEEK", venueFilterId),
      history: listSchedulesByScope("HISTORY", venueFilterId)
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
    role: trimText(payload.role) || (SUPERADMIN_USERNAMES.has(username) ? "superadmin" : "venue"),
    venueId: trimText(payload.venueId) || "",
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
  const next = {
    id: String(nextId(state.venues || [])),
    name,
    accountNamespace,
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

  state.tvScreens = (state.tvScreens || []).map((screen) => {
    if (normalizeScreenAccountNamespace(screen.accountNamespace) !== venueNs) return screen;
    return { ...screen, accountNamespace: "" };
  });

  state.schedules = (state.schedules || []).filter((schedule) => normalizeVenueId(schedule.venueId) !== venueIdValue);
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
  existing.environmentLabel = existing.accountNamespace || trimText(existing.environmentLabel) || "";
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

export function listSchedulesByScope(scope = "CURRENTWEEK", venueId = "") {
  const monday = startOfWeek(new Date());
  const nextMonday = endOfWeek(new Date());
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  let list = state.schedules.map(attachCourseBasics);
  const venueFilterId = normalizeVenueId(venueId);

  if (venueFilterId) {
    list = list.filter((item) => normalizeVenueId(item.venueId) === venueFilterId);
  }

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

export function getTvDailyBundle(dateText, timeZone = "Asia/Shanghai", accountNamespace = "") {
  const date = normalizeCalendarDate(dateText, timeZone);
  const ns = trimText(accountNamespace);
  const venueId = ns ? trimText(getVenueByAccountNamespace(ns)?.id) : "";
  const schedules = listSchedulesByDate(date, timeZone, venueId)
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

export function getTvDailyChecksum(dateText, timeZone = "Asia/Shanghai", accountNamespace = "") {
  const bundle = getTvDailyBundle(dateText, timeZone, accountNamespace);
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

export function getCurrentPlaybackSession(accountNamespace = "") {
  return serializePlaybackSession(getActivePlaybackSessionEntry(accountNamespace));
}

export function getCurrentPlaybackSessionForTv(payload = {}) {
  const requestedAccountNamespace = normalizeScreenAccountNamespace(payload.accountNamespace);
  const requestedDeviceId = trimText(payload.deviceId);
  const requestedScreenNumber = Number(payload.screenNumber) || 0;
  const matchedScreen =
    (state.tvScreens || []).find((item) => {
      const sameDevice = requestedDeviceId && trimText(item.deviceId) === requestedDeviceId;
      const sameScreen =
        requestedScreenNumber >= 1
        && normalizeScreenAccountNamespace(item.accountNamespace) === requestedAccountNamespace
        && Number(item.screenNumber) === requestedScreenNumber;
      return sameDevice || sameScreen;
    }) || null;
  const accountNamespace =
    requestedAccountNamespace
    || normalizeScreenAccountNamespace(matchedScreen?.accountNamespace)
    || DEFAULT_ACCOUNT_NAMESPACE;
  return serializePlaybackSession(getActivePlaybackSessionEntry(accountNamespace));
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
    const startDelayMs = Math.max(3000, Math.min(30000, safeNumber(payload.startDelayMs, 5000)));
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
  const endedSessions = [];
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
    if (afterState === "ENDED" && (beforeState !== afterState || safeNumber(session.version) !== beforeVersion)) {
      endedSessions.push(serializePlaybackSession(session));
    }
  }

  return endedSessions;
}

export function bindTvScreen(payload = {}, accountNamespace = "") {
  return upsertTvScreen({
    ...payload,
    accountNamespace: normalizeScreenAccountNamespace(payload.accountNamespace ?? accountNamespace)
  });
}

export function heartbeatTvScreen(payload = {}, accountNamespace = "") {
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

  const existing = payload.id ? state.schedules.find((item) => item.id === Number(payload.id)) ?? null : null;
  const venueIdInput = normalizeVenueId(payload.venueId);
  const venueId = venueIdInput || normalizeVenueId(existing?.venueId);

  if ((state.venues || []).length && !venueId) {
    throw new Error("请选择场馆后再排课。");
  }
  if (venueId && !getVenueById(venueId)) {
    throw new Error("场馆不存在。");
  }

  const next = {
    id: payload.id ? Number(payload.id) : nextId(state.schedules),
    venueId,
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

export function copyLastWeekSchedules(venueId = "") {
  const monday = startOfWeek(new Date());
  const nextMonday = endOfWeek(new Date());
  const venueFilterId = normalizeVenueId(venueId);
  const lastWeek = listSchedulesByScope("LASTWEEK", venueFilterId);

  state.schedules = state.schedules.filter((item) => {
    const matchesVenue = venueFilterId ? normalizeVenueId(item.venueId) === venueFilterId : true;
    if (!matchesVenue) return true;
    return !inRange(item.beginTime, monday, nextMonday);
  });

  let nextScheduleId = nextId(state.schedules);

  const copied = lastWeek.map((item) => {
    const nextDate = new Date(item.beginTime);
    nextDate.setDate(nextDate.getDate() + 7);

    return {
      id: nextScheduleId++,
      venueId: normalizeVenueId(item.venueId),
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
