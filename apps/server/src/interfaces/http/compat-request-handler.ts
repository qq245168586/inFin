// @ts-nocheck
import fs from "node:fs";
import http from "node:http";
import { createHash } from "node:crypto";
import path from "node:path";
import { URL } from "node:url";
import {
  addActionType,
  addLessonType,
  bindTvScreen,
  bindTvScreenByPairing,
  createAppPackageFilename,
  copyWeekSchedules,
  copyLastWeekSchedules,
  createPreviewPlaybackSession,
  endExpiredPlaybackSessions,
  createMediaFilename,
  createConsoleUser,
  createUploadedMedia,
  deleteAction,
  deleteCourse,
  deleteSchedule,
  deleteTemplate,
  getDatabaseStatus,
  getActionById,
  getAppPackageById,
  getAppPackageRoot,
  getUserByAccessToken,
  isSuperAdminUser,
  listCoursePackages,
  getCoursePackageById,
  saveCoursePackage,
  deleteCoursePackage,
  listVenueCoursePackages,
  bindCoursePackageToVenue,
  unbindCoursePackageFromVenue,
  setVenueActiveCoursePackage,
  setUserCoursePackages,
  listVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  listVenueUsers,
  createVenueUser,
  listAdminConsoleUsers,
  bindUserToVenue,
  unbindUserFromVenue,
  updateUser,
  getVenueById,
  getCourseById,
  getMediaRecord,
  getMediaRoot,
  getMetaPayload,
  getTemplateById,
  getActivePlaybackSession,
  getCurrentPlaybackSession,
  getCurrentPlaybackSessionForTv,
  getPlaybackSession,
  getTvDailyBundle,
  getTvDailyChecksum,
  getTvScheduleBundle,
  heartbeatTvScreen,
  listUsers,
  listActions,
  listActionTypes,
  listAppPackages,
  listCourses,
  listCourseSummaries,
  listCourseOptions,
  listLessonTypes,
  listTemplates,
  listSchedulesByScope,
  listSchedulesByWeekDate,
  listTvDevices,
  listTvScreens,
  loginConsoleUser,
  refreshConsoleUser,
  registerUploadedAppPackage,
  rescanAppPackages,
  saveAction,
  saveCourse,
  saveTemplate,
  saveSchedule,
  unbindTvScreen,
  updatePlaybackSessionState
} from "../../data/store.js";
import { buildStorageKey, getMediaStorageMode, uploadBufferToOss } from "../../services/media-storage.js";
import { getOrCreateActionThumbnailFile } from "../../services/media-thumbnails.js";
import { getTvControlConfig, publishTvControl, publishTvSessionEvent } from "../../services/tv-control.js";
import { readOpsEvents, startOpsMqttSubscriber, subscribeOpsEvents } from "../../services/mqtt-ops-log.js";
import { readJsonBody, readRequestBuffer, sendFile, sendJson, sendNoContent } from "../../utils/http.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3100);
const compatBasicAuth = "Basic REDACTED_CONFIGURE_LOCALLY";
const PLAYBACK_SESSION_SWEEP_INTERVAL_MS = 20 * 1000;

const mimeByExtension = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm"
};

/**
 * 封装 guess mime type 的业务步骤，避免调用方依赖内部实现细节。
 */
function guessMimeType(filename, fallback = "application/octet-stream") {
  return mimeByExtension[path.extname(filename).toLowerCase()] || fallback;
}

/**
 * 封装 bad request 的业务步骤，避免调用方依赖内部实现细节。
 */
function badRequest(response, message) {
  sendJson(response, 400, { message });
}

/**
 * 封装 unauthorized 的业务步骤，避免调用方依赖内部实现细节。
 */
function unauthorized(response, message = "登录已失效，请重新登录。") {
  sendJson(response, 403, {
    code: 403,
    message,
    msg: message
  });
}

/**
 * 封装 compat success 的业务步骤，避免调用方依赖内部实现细节。
 */
function sendCompatSuccess(response, data) {
  sendJson(response, 200, {
    code: 200,
    data,
    message: "success",
    msg: "success"
  });
}

/**
 * 判断是否满足 has compat basic auth 条件，供调用方做分支处理。
 */
function hasCompatBasicAuth(request) {
  return request.headers.authorization === compatBasicAuth;
}

/**
 * 解析可选布尔查询参数，未传时保持兼容默认值。
 */
function parseOptionalBooleanQuery(value, fallback = true) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  if (["0", "false", "no", "off"].includes(text)) return false;
  if (["1", "true", "yes", "on"].includes(text)) return true;
  return fallback;
}

/**
 * 读取 bearer token，并保持返回结构稳定。
 */
function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

/**
 * 读取 authorized console user，并保持返回结构稳定。
 */
function getAuthorizedConsoleUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return null;
  }

  return getUserByAccessToken(accessToken);
}

/**
 * 要求请求具备 authorized console user，失败时直接写入错误响应。
 */
function requireAuthorizedConsoleUser(request, response) {
  const user = getAuthorizedConsoleUser(request);

  if (!user) {
    unauthorized(response);
    return null;
  }
  return user;
}

/**
 * 要求请求具备 super admin，失败时直接写入错误响应。
 */
function requireSuperAdmin(request, response) {
  const user = requireAuthorizedConsoleUser(request, response);

  if (!user) {
    return null;
  }
  if (!isSuperAdminUser(user)) {
    unauthorized(response, "当前账号没有管理权限。");
    return null;
  }
  return user;
}

/**
 * 读取 authorized console user from query，并保持返回结构稳定。
 */
function getAuthorizedConsoleUserFromQuery(request, url) {
  const tokenType = String(url.searchParams.get("tokenType") || "").trim();
  const accessToken = String(url.searchParams.get("accessToken") || "").trim();
  if (!accessToken) return null;
  if (tokenType && tokenType.toLowerCase() !== "bearer") return null;
  return getUserByAccessToken(accessToken);
}

/**
 * 要求请求具备 super admin from header or query，失败时直接写入错误响应。
 */
function requireSuperAdminFromHeaderOrQuery(request, response, url) {
  const user = getAuthorizedConsoleUser(request) || getAuthorizedConsoleUserFromQuery(request, url);

  if (!user) {
    unauthorized(response);
    return null;
  }
  if (!isSuperAdminUser(user)) {
    unauthorized(response, "当前账号没有管理权限。");
    return null;
  }
  return user;
}

/**
 * 解析 account namespace，合并请求参数、上下文和默认值。
 */
function resolveAccountNamespace(value, fallback = "13689547720") {
  const text = String(value || "").trim().toLowerCase();
  return text || fallback;
}

/**
 * 解析 optional account namespace，合并请求参数、上下文和默认值。
 */
function resolveOptionalAccountNamespace(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * 解析 request account namespace，合并请求参数、上下文和默认值。
 */
function resolveRequestAccountNamespace(user, url) {
  const requestedVenueId = String(url?.searchParams?.get("venueId") || "").trim();
  const requestedVenueNamespace = requestedVenueId
    ? resolveOptionalAccountNamespace(getVenueById(requestedVenueId)?.accountNamespace || "")
    : "";
  const requestedAccountNamespace =
    requestedVenueNamespace || resolveOptionalAccountNamespace(url?.searchParams?.get("accountNamespace") || "");
  if (requestedAccountNamespace && isSuperAdminUser(user)) {
    return requestedAccountNamespace;
  }
  return resolveAccountNamespace(user?.accountNamespace, user?.username);
}

/**
 * 解析 playback request account namespace，合并请求参数、上下文和默认值。
 */
function resolvePlaybackRequestAccountNamespace(user, url, payload = {}) {
  const payloadVenueId = String(payload?.venueId || "").trim();
  const payloadVenueNamespace = payloadVenueId
    ? resolveOptionalAccountNamespace(getVenueById(payloadVenueId)?.accountNamespace || "")
    : "";
  const payloadAccountNamespace =
    payloadVenueNamespace || resolveOptionalAccountNamespace(payload?.accountNamespace || "");

  if (payloadAccountNamespace && isSuperAdminUser(user)) {
    return payloadAccountNamespace;
  }

  return resolveRequestAccountNamespace(user, url);
}

/**
 * 判断是否满足 is valid tv control type 条件，供调用方做分支处理。
 */
function isValidTvControlType(value) {
  return ["refresh_checksum", "preview_course", "start_course", "pause_course", "resume_course", "terminate_course"].includes(
    String(value || "")
  );
}

/**
 * 校验 tv control payload，返回前端可理解的错误信息。
 */
function validateTvControlPayload(payload) {
  const type = String(payload?.type || "");
  if (!isValidTvControlType(type)) {
    return "TV 控制指令类型无效。";
  }

  if (type === "refresh_checksum") {
    return "";
  }

  if (!String(payload?.scheduleId || "").trim()) {
    return "TV 控制指令缺少 scheduleId。";
  }

  if (!Number.isFinite(Number(payload?.courseId)) || Number(payload.courseId) <= 0) {
    return "TV 控制指令缺少有效的 courseId。";
  }

  if (!Number.isFinite(Number(payload?.scheduledStartAtMs)) || Number(payload.scheduledStartAtMs) <= 0) {
    return "TV 控制指令缺少有效的 scheduledStartAtMs。";
  }

  if (!String(payload?.playbackSessionId || "").trim()) {
    return "TV 控制指令缺少有效的 playbackSessionId。";
  }

  if (
    (type === "preview_course" || type === "start_course")
    && !String(payload?.bundleChecksum || "").trim()
  ) {
    return "TV 控制指令缺少有效的 bundleChecksum。";
  }

  if (type === "start_course" && (!Number.isFinite(Number(payload?.playbackStartAtMs)) || Number(payload.playbackStartAtMs) <= 0)) {
    return "开始课程指令缺少有效的 playbackStartAtMs。";
  }

  if (type === "pause_course" && (!Number.isFinite(Number(payload?.pausedAtMs)) || Number(payload.pausedAtMs) <= 0)) {
    return "暂停课程指令缺少有效的 pausedAtMs。";
  }

  if (type === "resume_course" && (!Number.isFinite(Number(payload?.resumedAtMs)) || Number(payload.resumedAtMs) <= 0)) {
    return "继续课程指令缺少有效的 resumedAtMs。";
  }

  return "";
}

/**
 * 要求请求具备 command id，失败时直接写入错误响应。
 */
function requireCommandId(payload) {
  const commandId = String(payload?.commandId || "").trim();

  if (!commandId) {
    return "";
  }
  return commandId;
}

/**
 * 组装 playback session control payload，把分散的输入合成稳定输出。
 */
function buildPlaybackSessionControlPayload(type, session, commandId, extra = {}) {
  const serverNowMs = Date.now();
  const accountNamespace = resolveOptionalAccountNamespace(session.accountNamespace);
  return {
    type,
    source: "coach-web",
    commandId,
    accountNamespace,
    venueId: accountNamespace,
    sessionId: session.id,
    playbackSessionId: session.id,
    sessionVersion: session.version,
    state: session.state,
    scheduleId: String(session.scheduleId || ""),
    courseId: Number(session.courseId),
    courseName: String(session.courseName || ""),
    scheduledStartAtMs: Number(session.scheduledStartAtMs) || 0,
    bundleChecksum: String(session.bundleChecksum || ""),
    timingMode: "server_session",
    serverStartAtMs: Number(session.serverStartAtMs) || 0,
    playbackStartAtMs: Number(session.serverStartAtMs) || 0,
    expectedDurationMs: Number(session.expectedDurationMs) || 0,
    expectedEndAtMs: Number(session.expectedEndAtMs) || 0,
    pausedAccumulatedMs: Number(session.pausedAccumulatedMs) || 0,
    pausedAtMs: Number(session.pausedAtMs) || 0,
    endedAtMs: Number(session.endedAtMs) || 0,
    terminatedAtMs: Number(session.terminatedAtMs) || 0,
    elapsedMs: Number(session.elapsedMs) || 0,
    serverNowMs,
    requestedAt: serverNowMs,
    ...extra
  };
}

/**
 * 发布 playback session control，优先走网关并在允许时回退直连。
 */
async function publishPlaybackSessionControl(response, accountNamespace, type, session, commandId, extra = {}) {
  const targetAccountNamespace = resolveOptionalAccountNamespace(session?.accountNamespace) || resolveOptionalAccountNamespace(accountNamespace);
  const result = {
    sessionEvent: null,
    compatControl: null,
    errors: []
  };

  try {
    result.sessionEvent = await publishTvSessionEvent(session, targetAccountNamespace);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "session MQTT 发布失败。");
  }

  try {
    result.compatControl = await publishTvControl(
      buildPlaybackSessionControlPayload(type, session, commandId, extra),
      targetAccountNamespace
    );
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "TV 控制 MQTT 发布失败。");
  }

  return result;
}

/**
 * 发布 auto ended playback session，优先走网关并在允许时回退直连。
 */
async function publishAutoEndedPlaybackSession(session) {
  const accountNamespace = resolveOptionalAccountNamespace(session?.accountNamespace);
  try {
    await publishTvSessionEvent(session, accountNamespace);
  } catch (error) {
    console.warn(
      "Failed to publish auto-ended playback session:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 启动 playback session sweeper，避免重复注册后台任务或监听器。
 */
function startPlaybackSessionSweeper() {
  const sweep = async () => {
    let endedSessions = [];
    try {
      endedSessions = endExpiredPlaybackSessions();
    } catch (error) {
      console.warn("Playback session sweep failed:", error instanceof Error ? error.message : String(error));
      return;
    }

    for (const session of endedSessions) {
      await publishAutoEndedPlaybackSession(session);
    }
  };

  setInterval(sweep, PLAYBACK_SESSION_SWEEP_INTERVAL_MS).unref?.();
  sweep();
}

/**
 * 校验 tv screen payload，返回前端可理解的错误信息。
 */
function validateTvScreenPayload(payload) {
  const screenNumber = Number(payload?.screenNumber);
  if (!Number.isFinite(screenNumber) || screenNumber < 1 || screenNumber > 5) {
    return "屏幕序号无效。";
  }

  if (!String(payload?.deviceId || "").trim()) {
    return "设备 ID 不能为空。";
  }

  return "";
}

/**
 * 校验 tv screen pairing payload，返回前端可理解的错误信息。
 */
function validateTvScreenPairingPayload(payload) {
  const screenNumber = Number(payload?.screenNumber);
  if (!Number.isFinite(screenNumber) || screenNumber < 1 || screenNumber > 5) {
    return "屏幕序号无效。";
  }

  if (!String(payload?.deviceId || "").trim()) {
    return "设备 ID 不能为空。";
  }

  return "";
}

/**
 * 校验 tv screen heartbeat payload，返回前端可理解的错误信息。
 */
function validateTvScreenHeartbeatPayload(payload) {
  const screenNumber = Number(payload?.screenNumber);
  if (!Number.isFinite(screenNumber) || screenNumber < 0 || screenNumber > 5) {
    return "屏幕序号无效。";
  }

  if (!String(payload?.deviceId || "").trim()) {
    return "设备 ID 不能为空。";
  }

  return "";
}

/**
 * 校验 tv screen unbind payload，返回前端可理解的错误信息。
 */
function validateTvScreenUnbindPayload(payload) {
  const deviceId = String(payload?.deviceId || "").trim();
  const screenNumber = Number(payload?.screenNumber);

  if (deviceId) {
    return "";
  }

  if (Number.isFinite(screenNumber) && screenNumber >= 1 && screenNumber <= 5) {
    return "";
  }

  return "解绑屏幕时必须提供 deviceId 或 screenNumber。";
}

/**
 * 校验 tv screen device payload，返回前端可理解的错误信息。
 */
function validateTvScreenDevicePayload(payload) {
  const deviceId = String(payload?.deviceId || "").trim();
  const screenNumber = Number(payload?.screenNumber);

  if (deviceId) {
    return "";
  }

  if (Number.isFinite(screenNumber) && screenNumber >= 1 && screenNumber <= 5) {
    return "";
  }

  return "请提供有效的设备 ID 或屏幕编号。";
}

/**
 * 校验 app package upload params，返回前端可理解的错误信息。
 */
function validateAppPackageUploadParams(url) {
  const platform = String(url.searchParams.get("platform") || "").trim().toLowerCase();
  const version = String(url.searchParams.get("version") || "").trim();
  if (!["tv", "coach"].includes(platform)) {
    return "安装包平台无效。";
  }

  if (!version) {
    return "安装包版本号不能为空。";
  }
  return "";
}

/**
 * 校验 venue payload，返回前端可理解的错误信息。
 */
function validateVenuePayload(payload) {
  const name = String(payload?.name || "").trim();

  if (!name) {
    return "场馆名称不能为空。";
  }
  return "";
}

/**
 * 校验 venue user payload，返回前端可理解的错误信息。
 */
function validateVenueUserPayload(payload) {
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "").trim();

  if (!username) {
    return "账号不能为空。";
  }

  if (!password) {
    return "密码不能为空。";
  }
  return "";
}

/**
 * 查找 target screen，找不到时返回空值而不是抛错。
 */
function findTargetScreen(payload, accountNamespace) {
  const screensPayload = listTvScreens(resolveAccountNamespace(accountNamespace));
  const candidates = [...screensPayload.screens, ...(screensPayload.unboundDevices || [])];
  return (
    candidates.find(
      (item) =>
        (String(payload?.deviceId || "").trim() && item.deviceId === String(payload.deviceId || "").trim()) ||
        (Number(payload?.screenNumber) > 0 && item.screenNumber === Number(payload.screenNumber))
    ) || null
  );
}

/**
 * 解析 tv control namespace，合并请求参数、上下文和默认值。
 */
function resolveTvControlNamespace(targetScreen, accountNamespace) {
  if (!targetScreen?.deviceId) {
    return resolveAccountNamespace(accountNamespace);
  }
  if (String(targetScreen.accountNamespace || "").trim()) {
    return resolveAccountNamespace(targetScreen.accountNamespace);
  }
  return "__unbound__";
}

/**
 * 判断是否满足 is tv app update in progress 条件，供调用方做分支处理。
 */
function isTvAppUpdateInProgress(updateState) {
  return ["DOWNLOADING", "DOWNLOADED", "INSTALLING", "INSTALLED"].includes(
    String(updateState || "").trim().toUpperCase()
  );
}

/**
 * 汇总 ops events，把明细数据压缩成看板指标。
 */
function summarizeOpsEvents(items = []) {
  const directionCounts = { in: 0, out: 0 };
  const typeCounts = {};
  const topicCounts = {};
  const devices = new Set();
  const namespaces = new Set();

  for (const item of items) {
    const direction = String(item?.direction || "").toLowerCase() === "out" ? "out" : "in";
    directionCounts[direction] += 1;

    const type = String(item?.type || "unknown").trim() || "unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const topic = String(item?.topic || "unknown").trim() || "unknown";
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    if (String(item?.deviceId || "").trim()) {
      devices.add(String(item.deviceId).trim());
    }
    if (String(item?.namespace || "").trim()) {
      namespaces.add(String(item.namespace).trim());
    }
  }

  const toTopList = (source) =>
    Object.entries(source)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

  return {
    total: items.length,
    inbound: directionCounts.in,
    outbound: directionCounts.out,
    uniqueDevices: devices.size,
    namespaces: Array.from(namespaces).sort(),
    latestAt: items[0]?.receivedAt || "",
    topTypes: toTopList(typeCounts),
    topTopics: toTopList(topicCounts)
  };
}

/**
 * 汇总 ops screens，把明细数据压缩成看板指标。
 */
function summarizeOpsScreens(items = []) {
  const boundScreens = items.filter((item) => String(item?.deviceId || "").trim());
  const stateCounts = {};
  const updateCounts = {};
  const versionCounts = {};

  for (const item of boundScreens) {
    const playbackState = String(item?.playbackState || "IDLE").toUpperCase();
    stateCounts[playbackState] = (stateCounts[playbackState] || 0) + 1;

    const updateState = String(item?.updateState || "IDLE").toUpperCase();
    updateCounts[updateState] = (updateCounts[updateState] || 0) + 1;

    const version = String(item?.appVersion || "unknown").trim() || "unknown";
    versionCounts[version] = (versionCounts[version] || 0) + 1;
  }

  return {
    slots: items.length,
    bound: boundScreens.length,
    online: boundScreens.filter((item) => item.online).length,
    preview: boundScreens.filter((item) => String(item?.playbackState || "").toUpperCase() === "PREVIEW").length,
    running: boundScreens.filter((item) => String(item?.playbackState || "").toUpperCase() === "RUNNING").length,
    updating: boundScreens.filter((item) => isTvAppUpdateInProgress(item?.updateState)).length,
    states: stateCounts,
    updates: updateCounts,
    versions: versionCounts
  };
}

/**
 * 封装 handle compat request 的业务步骤，避免调用方依赖内部实现细节。
 */
export async function handleCompatRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        service: "infini-platform-server",
        dbSafety: getDatabaseStatus(),
        mediaStorage: getMediaStorageMode(),
        tvControl: getTvControlConfig(),
        now: new Date().toISOString()
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ops/overview") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;

      const namespace = String(url.searchParams.get("namespace") || "").trim();
      const deviceId = String(url.searchParams.get("deviceId") || "").trim();
      const topic = String(url.searchParams.get("topic") || "").trim();
      const type = String(url.searchParams.get("type") || "").trim();
      const date = String(url.searchParams.get("date") || "").trim();
      const recentEvents = readOpsEvents({
        namespace,
        deviceId,
        topic,
        type,
        date,
        limit: "500"
      });
      const screenPayload = namespace
        ? listTvScreens(namespace)
        : { generatedAt: new Date().toISOString(), screens: [] };
      const tvPackages = listAppPackages("tv").slice(0, 8);

      sendJson(response, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          filters: { namespace, deviceId, topic, type, date },
          server: {
            dbSafety: getDatabaseStatus(),
            mediaStorage: getMediaStorageMode(),
            tvControl: getTvControlConfig()
          },
          mqtt: summarizeOpsEvents(recentEvents),
          screens: {
            generatedAt: screenPayload.generatedAt,
            requiresNamespace: !namespace,
            summary: summarizeOpsScreens(screenPayload.screens || []),
            items: (screenPayload.screens || []).filter((item) => String(item?.deviceId || "").trim())
          },
          appPackages: {
            tv: tvPackages
          }
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ops/mqtt/events") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const items = readOpsEvents({
        namespace: url.searchParams.get("namespace") || "",
        deviceId: url.searchParams.get("deviceId") || "",
        topic: url.searchParams.get("topic") || "",
        type: url.searchParams.get("type") || "",
        date: url.searchParams.get("date") || "",
        limit: url.searchParams.get("limit") || "200"
      });
      sendJson(response, 200, { data: { items } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ops/mqtt/stream") {
      const user = requireSuperAdminFromHeaderOrQuery(request, response, url);
      if (!user) return;

      const filter = {
        namespace: String(url.searchParams.get("namespace") || "").trim().toLowerCase(),
        deviceId: String(url.searchParams.get("deviceId") || "").trim().toUpperCase(),
        topic: String(url.searchParams.get("topic") || "").trim(),
        type: String(url.searchParams.get("type") || "").trim()
      };

      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*"
      });

      response.write(`event: ready\ndata: ${JSON.stringify({ ok: true, now: Date.now() })}\n\n`);

      const unsubscribe = subscribeOpsEvents((event) => {
        try {
          if (filter.namespace && String(event.namespace || "").toLowerCase() !== filter.namespace) return;
          if (filter.deviceId && String(event.deviceId || "").toUpperCase() !== filter.deviceId) return;
          if (filter.topic && !String(event.topic || "").includes(filter.topic)) return;
          if (filter.type && !String(event.type || "").includes(filter.type)) return;
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          // ignore write errors
        }
      });

      request.on("close", () => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      });
      return;
    }

    if (request.method === "GET" && (url.pathname === "/api/meta" || url.pathname === "/api/editor/bootstrap")) {
      // Auth is optional for backward compatibility. When present, package-scoped
      // editor accounts only receive the course packages they are allowed to edit.
      const user = getAuthorizedConsoleUser(request);
      const courseDetail = String(url.searchParams.get("courseDetail") || url.searchParams.get("detail") || "").trim();
      const includeFullCourses = ["full", "true", "1"].includes(courseDetail.toLowerCase());
      const includeSchedules = parseOptionalBooleanQuery(url.searchParams.get("includeSchedules"), true);
      const includeActions = parseOptionalBooleanQuery(url.searchParams.get("includeActions"), true);
      const includeTemplates = parseOptionalBooleanQuery(url.searchParams.get("includeTemplates"), true);
      const coursePackageId = url.searchParams.get("coursePackageId") || "";
      const courseId = url.searchParams.get("courseId") || "";
      sendJson(response, 200, getMetaPayload(user, {
        includeFullCourses,
        includeSchedules,
        includeActions,
        includeTemplates,
        coursePackageId,
        courseId
      }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/venues") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      sendJson(response, 200, { data: listVenues() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/course-packages") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      sendJson(response, 200, { data: listCoursePackages() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/course-packages") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 201, { data: saveCoursePackage(payload) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "保存课程包失败。");
      }
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/course-packages/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const packageId = url.pathname.replace("/api/admin/course-packages/", "");
      if (!packageId || packageId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const existing = getCoursePackageById(packageId);

      if (!existing) {
        sendJson(response, 404, { message: "课程包不存在。" });
        return;
      }
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: saveCoursePackage({ ...payload, id: existing.id }) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "保存课程包失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/course-packages/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const packageId = url.pathname.replace("/api/admin/course-packages/", "");
      if (!packageId || packageId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const result = deleteCoursePackage(packageId);

      if (!result.ok) {
        sendJson(response, 409, result);
        return;
      }
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/venues") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      const issue = validateVenuePayload(payload);

      if (issue) {
        badRequest(response, issue);
        return;
      }
      try {
        sendJson(response, 201, { data: createVenue(payload) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "创建场馆失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/course-packages")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/course-packages", "");
      const result = listVenueCoursePackages(venueId);

      if (!result) {
        sendJson(response, 404, { message: "场馆不存在。" });
        return;
      }
      sendJson(response, 200, { data: result });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/coach/course-packages") {
      const user = requireAuthorizedConsoleUser(request, response);
      if (!user) return;
      const requestedVenueId = String(url.searchParams.get("venueId") || "").trim();
      const venueId = isSuperAdminUser(user) && requestedVenueId ? requestedVenueId : String(user.venueId || "").trim();

      if (!venueId) {
        badRequest(response, "当前账号尚未绑定场馆。");
        return;
      }
      const result = listVenueCoursePackages(venueId);

      if (!result) {
        sendJson(response, 404, { message: "场馆不存在。" });
        return;
      }
      sendJson(response, 200, { data: result });
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/course-packages")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/course-packages", "");
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: bindCoursePackageToVenue(venueId, payload?.coursePackageId) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "绑定课程包失败。");
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/coach/active-course-package") {
      const user = requireAuthorizedConsoleUser(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      const venueId = String(user.venueId || payload?.venueId || "").trim();

      if (!venueId) {
        badRequest(response, "当前账号尚未绑定场馆。");
        return;
      }

      let result = null;
      try {
        result = setVenueActiveCoursePackage(venueId, payload?.coursePackageId);
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "切换课程包失败。");
        return;
      }

      const accountNamespace = resolveOptionalAccountNamespace(result?.accountNamespace || user.accountNamespace || user.username);
      try {
        await publishTvControl(
          {
            type: "refresh_checksum",
            source: "coach-web",
            commandId: String(payload?.commandId || "").trim(),
            reason: "course_package_changed",
            coursePackageId: result?.activeCoursePackageId,
            accountNamespace,
            venueId: accountNamespace,
            requestedAt: Date.now()
          },
          accountNamespace
        );
      } catch (error) {
        sendJson(response, 200, {
          data: result,
          warning: error instanceof Error ? `课程包已保存，但 MQTT 发布失败：${error.message}` : "课程包已保存，但 MQTT 发布失败。",
          message: "success",
          msg: "success"
        });
        return;
      }

      sendJson(response, 200, { data: result });
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/active-course-package")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/active-course-package", "");
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: setVenueActiveCoursePackage(venueId, payload?.coursePackageId) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "切换课程包失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.includes("/course-packages/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const [, tail = ""] = url.pathname.split("/api/admin/venues/");
      const [venueId, , packageId] = tail.split("/");
      try {
        sendJson(response, 200, { data: unbindCoursePackageFromVenue(venueId, packageId) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "解绑课程包失败。");
      }
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/venues/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "");
      if (!venueId || venueId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const payload = await readJsonBody(request);
      try {
        const updated = updateVenue(venueId, payload);

        if (!updated) {
          sendJson(response, 404, { message: "场馆不存在。" });
          return;
        }
        sendJson(response, 200, { data: updated });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "更新场馆失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/venues/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "");
      if (!venueId || venueId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const venue = getVenueById(venueId);
      const venueNamespace = resolveOptionalAccountNamespace(venue?.accountNamespace || "");
      const venueScreens = venueNamespace
        ? listTvScreens(venueNamespace).screens.filter((screen) => String(screen.deviceId || "").trim())
        : [];
      const result = deleteVenue(venueId);

      if (!result.ok) {
        badRequest(response, result.message || "删除场馆失败。");
        return;
      }

      for (const screen of venueScreens) {
        try {
          await publishTvControl(
            {
              type: "venue_deleted",
              source: "admin-web",
              deviceId: String(screen.deviceId || "").trim(),
              screenNumber: Number(screen.screenNumber) || 0,
              accountNamespace: venueNamespace,
              venueId: venueNamespace,
              requestedAt: Date.now()
            },
            venueNamespace
          );
        } catch {
          // Venue deletion must not fail because a TV is offline or MQTT is temporarily unavailable.
        }
      }
      sendNoContent(response);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/users")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/users", "");
      sendJson(response, 200, { data: listVenueUsers(venueId) });
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/users")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/users", "");
      const payload = await readJsonBody(request);
      const issue = validateVenueUserPayload(payload);

      if (issue) {
        badRequest(response, issue);
        return;
      }
      try {
        sendJson(response, 201, { data: createVenueUser(venueId, payload) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "创建账号失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/screens")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/screens", "");
      const venue = getVenueById(venueId);

      if (!venue) {
        sendJson(response, 404, { message: "场馆不存在。" });
        return;
      }
      sendJson(response, 200, { data: listTvScreens(resolveAccountNamespace(venue.accountNamespace)) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/tv-devices") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      sendJson(response, 200, {
        data: listTvDevices({
          venueId: url.searchParams.get("venueId") || "",
          onlineOnly: String(url.searchParams.get("online") || "").trim() === "1"
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/tv-devices/unbind") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      const deviceId = String(payload?.deviceId || "").trim();

      if (!deviceId) {
        badRequest(response, "缺少设备 ID。");
        return;
      }
      const devices = listTvDevices({}).devices || [];
      const currentDevice = devices.find((item) => String(item.deviceId || "").trim() === deviceId) || null;

      if (!currentDevice) {
        sendJson(response, 404, { message: "设备不存在。" });
        return;
      }
      const accountNamespace = resolveOptionalAccountNamespace(payload?.accountNamespace || currentDevice.accountNamespace || "");

      if (!accountNamespace) {
        badRequest(response, "设备当前未绑定场馆。");
        return;
      }
      const removed = unbindTvScreen(
        {
          deviceId,
          screenNumber: Number(currentDevice.screenNumber) || Number(payload?.screenNumber) || 0,
          accountNamespace
        },
        accountNamespace
      );
      try {
        await publishTvControl(
          {
            type: "unbind_screen",
            source: "admin-web",
            deviceId,
            screenNumber: Number(currentDevice.screenNumber) || 0,
            accountNamespace,
            venueId: accountNamespace,
            requestedAt: Date.now()
          },
          accountNamespace
        );
      } catch {
        // TV may be offline. The persisted unbound state still prevents it from being shown as assigned.
      }
      sendJson(response, 200, { data: removed });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/tv-devices/bind") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      const deviceId = String(payload?.deviceId || "").trim();
      const venueId = String(payload?.venueId || "").trim();
      const screenNumber = Number(payload?.screenNumber) || 0;
      const venue = getVenueById(venueId);

      if (!deviceId) {
        badRequest(response, "缺少设备 ID。");
        return;
      }

      if (!venue) {
        sendJson(response, 404, { message: "场馆不存在。" });
        return;
      }

      if (screenNumber < 1 || screenNumber > 5) {
        badRequest(response, "请选择 1-5 的屏幕编号。");
        return;
      }
      const targetNamespace = resolveAccountNamespace(venue.accountNamespace);
      const devices = listTvDevices({}).devices || [];
      const currentDevice = devices.find((item) => String(item.deviceId || "").trim() === deviceId) || null;
      const previousNamespace = resolveOptionalAccountNamespace(currentDevice?.accountNamespace || "");
      const bound =
        bindTvScreenByPairing(
          {
            deviceId,
            pairToken: String(payload?.pairToken || currentDevice?.pairToken || "").trim(),
            screenNumber
          },
          targetNamespace
        )
        || bindTvScreen(
          {
            deviceId,
            screenNumber,
            accountNamespace: targetNamespace,
            mqttClientId: currentDevice?.mqttClientId || "",
            appVersion: currentDevice?.appVersion || "",
            platform: currentDevice?.platform || "tv-android"
          },
          targetNamespace
        );

      if (!bound) {
        badRequest(response, "绑定设备失败。");
        return;
      }

      const assignPayload = {
        type: "assign_screen",
        source: "admin-web",
        deviceId,
        screenNumber,
        accountNamespace: targetNamespace,
        venueId: targetNamespace,
        requestedAt: Date.now()
      };
      const topics = new Set(["__unbound__", targetNamespace]);

      if (previousNamespace) {
        topics.add(previousNamespace);
      }

      for (const topicNamespace of topics) {
        try {
          await publishTvControl(assignPayload, topicNamespace);
        } catch {
          // Binding state is already persisted; the TV can catch up on its next heartbeat or manual refresh.
        }
      }
      sendJson(response, 200, { data: bound });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
      const unboundOnly = String(url.searchParams.get("unbound") || "").trim() === "1";
      const role = String(url.searchParams.get("role") || "").trim().toLowerCase();
      let users = listAdminConsoleUsers(query);

      if (role === "venue") {
        users = users.filter((item) => String(item.role || "").trim() === "venue");
      }

      if (role === "editor") {
        users = users.filter((item) => String(item.role || "").trim() === "editor");
      }

      if (unboundOnly) {
        users = users.filter((item) => !String(item.venueId || "").trim());
      }
      sendJson(response, 200, { data: users });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/users") {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const payload = await readJsonBody(request);
      const issue = validateVenueUserPayload(payload);

      if (issue) {
        badRequest(response, issue);
        return;
      }
      const requestedRole = String(payload.role || "venue").trim().toLowerCase();
      const role = requestedRole === "editor" ? "editor" : "venue";
      try {
        sendJson(response, 201, {
          data: createConsoleUser({
            username: String(payload.username || "").trim(),
            password: String(payload.password || "").trim(),
            nickname: String(payload.nickname || "").trim(),
            role,
            venueId: "",
            coursePackageIds: role === "editor" ? payload.coursePackageIds || [] : [],
            allowedClients: role === "editor" ? ["editor-web"] : ["coach-web"]
          })
        });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "创建账号失败。");
      }
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/venues/") && url.pathname.endsWith("/bind-user")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const venueId = url.pathname.replace("/api/admin/venues/", "").replace("/bind-user", "");
      if (!venueId || venueId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const payload = await readJsonBody(request);
      const userId = Number(payload?.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        badRequest(response, "请提供有效的 userId。");
        return;
      }
      try {
        sendJson(response, 200, { data: bindUserToVenue(userId, venueId) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "绑定账号失败。");
      }
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/unbind")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const userId = url.pathname.replace("/api/admin/users/", "").replace("/unbind", "");
      if (!userId || userId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      try {
        sendJson(response, 200, { data: unbindUserFromVenue(userId) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "解绑账号失败。");
      }
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/course-packages")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const userId = url.pathname.replace("/api/admin/users/", "").replace("/course-packages", "");
      if (!userId || userId.includes("/")) {
        sendJson(response, 404, { message: "Route not found." });
        return;
      }
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: setUserCoursePackages(userId, payload?.coursePackageIds || []) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "更新账号课程包权限失败。");
      }
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
      const user = requireSuperAdmin(request, response);
      if (!user) return;
      const userId = url.pathname.replace("/api/admin/users/", "");
      const payload = await readJsonBody(request);
      const updated = updateUser(userId, payload);

      if (!updated) {
        sendJson(response, 404, { message: "账号不存在。" });
        return;
      }
      sendJson(response, 200, { data: updated });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/daily-bundle") {
      const date = url.searchParams.get("date") || "";
      const timeZone = url.searchParams.get("timeZone") || "Asia/Shanghai";
      const accountNamespace = url.searchParams.get("accountNamespace") || "";
      sendJson(response, 200, getTvDailyBundle(date, timeZone, accountNamespace, {
        deviceId: url.searchParams.get("deviceId") || "",
        screenNumber: url.searchParams.get("screenNumber") || ""
      }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/daily-checksum") {
      const date = url.searchParams.get("date") || "";
      const timeZone = url.searchParams.get("timeZone") || "Asia/Shanghai";
      const accountNamespace = url.searchParams.get("accountNamespace") || "";
      sendJson(response, 200, getTvDailyChecksum(date, timeZone, accountNamespace, {
        deviceId: url.searchParams.get("deviceId") || "",
        screenNumber: url.searchParams.get("screenNumber") || ""
      }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/schedule-bundle") {
      const scheduleId = url.searchParams.get("scheduleId") || "";
      const payload = getTvScheduleBundle(scheduleId);

      if (!payload) {
        sendJson(response, 404, {
          message: "未找到对应的课程排课。"
        });
        return;
      }
      sendJson(response, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/screens") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      sendJson(response, 200, listTvScreens(resolveRequestAccountNamespace(user, url)));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/playback-sessions/current") {
      const user = getAuthorizedConsoleUser(request);
      const accountNamespace = user
        ? resolveRequestAccountNamespace(user, url)
        : resolveOptionalAccountNamespace(url.searchParams.get("accountNamespace") || "");
      const tvScope = {
        deviceId: url.searchParams.get("deviceId") || "",
        screenNumber: url.searchParams.get("screenNumber") || "",
        accountNamespace
      };
      const hasTvScope = Boolean(tvScope.deviceId || tvScope.screenNumber);
      const session = user && !hasTvScope
        ? getActivePlaybackSession(accountNamespace)
        : getCurrentPlaybackSessionForTv(tvScope);
      const serverNowMs = Date.now();
      sendJson(response, 200, {
        ok: true,
        serverNowMs,
        session,
        data: session
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/course-plan/show") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const commandId = requireCommandId(payload);

      if (!commandId) {
        badRequest(response, "commandId 不能为空。");
        return;
      }

      const courseId = Number(payload?.courseId);
      if (!Number.isFinite(courseId) || courseId <= 0) {
        badRequest(response, "请提供有效的 courseId。");
        return;
      }

      const course = getCourseById(courseId);

      if (!course) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      const accountNamespace = resolvePlaybackRequestAccountNamespace(user, url, payload);
      const coursePlan = course?.script?.plan || { sections: [] };
      const controlPayload = {
        type: "show_course_plan",
        source: "coach-web",
        commandId,
        scheduleId: String(payload?.scheduleId || ""),
        courseId,
        courseName: String(payload?.courseName || course.name || course?.script?.metadata?.name || ""),
        playbackSessionId: String(payload?.playbackSessionId || ""),
        accountNamespace,
        venueId: accountNamespace,
        coursePlan,
        requestedAt: Date.now()
      };

      try {
        const result = await publishTvControl(controlPayload, accountNamespace);
        sendJson(response, 200, {
          ok: true,
          data: result
        });
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/playback-sessions/preview") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const commandId = requireCommandId(payload);

      if (!commandId) {
        badRequest(response, "commandId 不能为空。");
        return;
      }

      const accountNamespace = resolvePlaybackRequestAccountNamespace(user, url, payload);
      let session;
      try {
        session = createPreviewPlaybackSession(
          {
            ...payload,
            createdBy: user.username
          },
          accountNamespace
        );
      } catch (error) {
        sendJson(response, error?.code === "ACTIVE_PLAYBACK_SESSION" ? 409 : 400, {
          message: error instanceof Error ? error.message : "创建预览 session 失败。"
        });
        return;
      }

      const publishResult = await publishPlaybackSessionControl(
        response,
        accountNamespace,
        "preview_course",
        session,
        commandId
      );

      if (!publishResult) {
        return;
      }
      sendJson(response, 200, {
        ok: true,
        serverNowMs: Date.now(),
        session,
        data: session,
        mqtt: publishResult
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/playback-sessions/start-from-schedule") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const commandId = requireCommandId(payload);

      if (!commandId) {
        badRequest(response, "commandId 不能为空。");
        return;
      }

      const accountNamespace = resolvePlaybackRequestAccountNamespace(user, url, payload);
      const targetScheduleId = String(payload?.scheduleId || "").trim();
      let session = getActivePlaybackSession(accountNamespace);

      if (session && targetScheduleId && String(session.scheduleId || "") !== targetScheduleId) {
        sendJson(response, 409, { message: "当前已有未结束课程，请先终止当前课程。" });
        return;
      }

      try {
        if (!session) {
          session = createPreviewPlaybackSession(
            {
              ...payload,
              commandId: `${commandId}:ensure-preview`,
              createdBy: user.username
            },
            accountNamespace
          );
        }
        session = updatePlaybackSessionState(session.id, "start", payload, accountNamespace);
      } catch (error) {
        sendJson(response, error?.code === "ACTIVE_PLAYBACK_SESSION" ? 409 : 400, {
          message: error instanceof Error ? error.message : "开始课程失败。"
        });
        return;
      }

      if (!session) {
        sendJson(response, 404, { message: "playback session 不存在。" });
        return;
      }

      const publishResult = await publishPlaybackSessionControl(
        response,
        accountNamespace,
        "start_course",
        session,
        commandId,
        { startDelayMs: Number(session.startDelayMs) || 0 }
      );

      if (!publishResult) {
        return;
      }
      sendJson(response, 200, {
        ok: true,
        serverNowMs: Date.now(),
        session,
        data: session,
        mqtt: publishResult
      });
      return;
    }

    if (url.pathname.startsWith("/api/tv/playback-sessions/")) {
      const match = url.pathname.match(/^\/api\/tv\/playback-sessions\/([^/]+)(?:\/([^/]+))?$/);

      if (match) {
        const user = requireAuthorizedConsoleUser(request, response);

        if (!user) {
          return;
        }
        const sessionId = decodeURIComponent(match[1]);
        const action = String(match[2] || "").trim();

        if (request.method === "GET" && !action) {
          const accountNamespace = resolveRequestAccountNamespace(user, url);
          const session = getPlaybackSession(sessionId, accountNamespace);

          if (!session) {
            sendJson(response, 404, { message: "playback session 不存在。" });
            return;
          }
          sendJson(response, 200, {
            ok: true,
            serverNowMs: Date.now(),
            session,
            data: session
          });
          return;
        }

        if (request.method === "POST" && ["start", "pause", "resume", "end", "terminate"].includes(action)) {
          const payload = await readJsonBody(request);
          const commandId = requireCommandId(payload);

          if (!commandId) {
            badRequest(response, "commandId 不能为空。");
            return;
          }
          const accountNamespace = resolvePlaybackRequestAccountNamespace(user, url, payload);

          let session;
          try {
            session = updatePlaybackSessionState(sessionId, action, payload, accountNamespace);
          } catch (error) {
            badRequest(response, error instanceof Error ? error.message : "更新 playback session 失败。");
            return;
          }

          if (!session) {
            sendJson(response, 404, { message: "playback session 不存在。" });
            return;
          }

          const typeByAction = {
            start: "start_course",
            pause: "pause_course",
            resume: "resume_course",

            end: "terminate_course",
            terminate: "terminate_course"
          };
          const publishResult = await publishPlaybackSessionControl(
            response,
            accountNamespace,
            typeByAction[action],
            session,
            commandId,
            action === "pause"
              ? { pausedAtMs: session.pausedAtMs }
              : action === "resume"
                ? { resumedAtMs: Date.now() }
                : action === "start"
                  ? { startDelayMs: Number(session.startDelayMs) || 0 }
                  : {}
          );

          if (!publishResult) {
            return;
          }

          sendJson(response, 200, {
            ok: true,
            serverNowMs: Date.now(),
            session,
            data: session,
            mqtt: publishResult
          });
          return;
        }
      }
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/bind") {
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const data = bindTvScreen(payload, resolveOptionalAccountNamespace(payload?.accountNamespace));
      sendJson(response, 200, { ok: true, data });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/heartbeat") {
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenHeartbeatPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const data = heartbeatTvScreen(payload, resolveOptionalAccountNamespace(payload?.accountNamespace));
      sendJson(response, 200, { ok: true, data });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/pair-bind") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenPairingPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const accountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      const data = bindTvScreenByPairing(payload, accountNamespace);

      if (!data) {
        sendJson(response, 404, {
          message: "绑定失败，请确认设备 ID 与屏幕编号有效。"
        });
        return;
      }

      try {
        await publishTvControl(
          {
            type: "assign_screen",
            source: "coach-web",
            deviceId: String(payload.deviceId || "").trim(),
            screenNumber: Number(payload.screenNumber),
            accountNamespace,
            venueId: accountNamespace,
            requestedAt: Date.now()
          },
          "__unbound__"
        );
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
        return;
      }

      sendJson(response, 200, { ok: true, data });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/unbind") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenUnbindPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const accountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      const currentScreen =
        listTvScreens(accountNamespace).screens.find(
          (item) =>
            (String(payload?.deviceId || "").trim() && item.deviceId === String(payload.deviceId || "").trim()) ||
            (Number(payload?.screenNumber) > 0 && item.screenNumber === Number(payload.screenNumber))
        ) || null;

      if (!currentScreen?.deviceId) {
        sendJson(response, 404, {
          message: "没有找到可解绑的屏幕。"
        });
        return;
      }

      try {
        await publishTvControl({
          type: "unbind_screen",
          source: "coach-web",
          deviceId: currentScreen.deviceId,
          screenNumber: currentScreen.screenNumber,
          accountNamespace,
          venueId: accountNamespace,
          requestedAt: Date.now()
        }, accountNamespace);
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
        return;
      }

      const data = unbindTvScreen(payload, accountNamespace);
      sendJson(response, 200, { ok: true, data });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/reassign") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const accountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      try {
        await publishTvControl({
          type: "assign_screen",
          source: "coach-web",
          deviceId: String(payload.deviceId || "").trim(),
          screenNumber: Number(payload.screenNumber),
          accountNamespace,
          venueId: accountNamespace,
          requestedAt: Date.now()
        }, resolveTvControlNamespace(findTargetScreen(payload, accountNamespace), accountNamespace));
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
        return;
      }

      const data = bindTvScreen(payload, accountNamespace);

      if (!data) {
        sendJson(response, 404, {
          message: "没有找到可切换的屏幕。"
        });
        return;
      }

      sendJson(response, 200, { ok: true, data });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/clear-cache") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenDevicePayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const accountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      const screensPayload = listTvScreens(accountNamespace);
      const candidates = [...screensPayload.screens, ...(screensPayload.unboundDevices || [])];
      const currentScreen =
        candidates.find(
          (item) =>
            (String(payload?.deviceId || "").trim() && item.deviceId === String(payload.deviceId || "").trim()) ||
            (Number(payload?.screenNumber) > 0 && item.screenNumber === Number(payload.screenNumber))
        ) || null;

      if (!currentScreen?.deviceId) {
        sendJson(response, 404, {
          message: "没有找到可清缓存的屏幕设备。"
        });
        return;
      }

      if (!currentScreen.online) {
        sendJson(response, 409, {
          message: "屏幕当前离线，暂时无法执行清缓存。"
        });
        return;
      }

      if (String(currentScreen.playbackState || "").toUpperCase() !== "IDLE") {
        sendJson(response, 409, {
          message: "请先确保屏幕处于待机状态，再执行清缓存。"
        });
        return;
      }

      try {
        const result = await publishTvControl({
          type: "clear_cache",
          source: "coach-web",
          deviceId: currentScreen.deviceId,
          screenNumber: Number(currentScreen.screenNumber) || 0,
          accountNamespace,
          venueId: accountNamespace,
          requestedAt: Date.now()
        }, accountNamespace);
        sendJson(response, 200, {
          ok: true,
          data: result
        });
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/screens/install-package") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvScreenDevicePayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const packageId = Number(payload?.packageId);
      if (!Number.isFinite(packageId) || packageId <= 0) {
        badRequest(response, "请提供有效的安装包版本。");
        return;
      }

      const accountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      const currentScreen = findTargetScreen(payload, accountNamespace);

      if (!currentScreen?.deviceId) {
        sendJson(response, 404, {
          message: "没有找到可升级的屏幕设备。"
        });
        return;
      }

      if (!currentScreen.online) {
        sendJson(response, 409, {
          message: "屏幕当前离线，暂时无法执行更新。"
        });
        return;
      }

      if (String(currentScreen.playbackState || "").toUpperCase() !== "IDLE") {
        sendJson(response, 409, {
          message: "请先确保屏幕处于待机状态，再执行更新。"
        });
        return;
      }

      const appPackage = getAppPackageById(packageId);

      if (!appPackage) {
        sendJson(response, 404, {
          message: "没有找到对应的安装包版本。"
        });
        return;
      }

      if (appPackage.platform !== "tv") {
        sendJson(response, 409, {
          message: "当前只支持给 TV 端下发 TV 安装包。"
        });
        return;
      }

      try {
        const result = await publishTvControl({
          type: "install_app_update",
          source: "coach-web",
          deviceId: currentScreen.deviceId,
          screenNumber: Number(currentScreen.screenNumber) || 0,
          accountNamespace,
          venueId: accountNamespace,
          packageId: appPackage.id,
          platform: appPackage.platform,
          version: appPackage.version,
          label: appPackage.label,
          filename: appPackage.filename,
          checksum: appPackage.checksum,
          sizeBytes: Number(appPackage.sizeBytes) || 0,
          downloadUrl: appPackage.downloadPath,
          requestedAt: Date.now()
        }, accountNamespace);
        sendJson(response, 200, {
          ok: true,
          data: {
            ...result,
            package: appPackage
          }
        });
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/tv-control") {
      const user = requireSuperAdmin(request, response);

      if (!user) {
        return;
      }

      const body = await readJsonBody(request);
      const accountNamespace = resolveOptionalAccountNamespace(
        body?.accountNamespace || body?.payload?.accountNamespace || body?.payload?.venueId || ""
      );
      const payload = body?.payload && typeof body.payload === "object" ? body.payload : null;
      const type = String(payload?.type || "").trim();

      if (!accountNamespace) {
        badRequest(response, "缺少有效的场馆 namespace。");
        return;
      }

      if (!payload || !type) {
        badRequest(response, "缺少有效的 TV 指令 payload。");
        return;
      }

      const normalizedPayload = {
        ...payload,
        type,
        source: String(payload.source || "admin-web"),
        accountNamespace,
        venueId: String(payload.venueId || accountNamespace),
        requestedAt: Number(payload.requestedAt) || Date.now()
      };

      try {
        const result = await publishTvControl(normalizedPayload, accountNamespace);
        sendJson(response, 200, {
          ok: true,
          data: result
        });
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tv/control") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const validationMessage = validateTvControlPayload(payload);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const userVenue = user?.venueId ? getVenueById(user.venueId) : null;
      const normalizedAccountNamespace = resolveAccountNamespace(
        userVenue?.accountNamespace || user.accountNamespace,
        user.username
      );
      const normalizedPayload = {
        ...payload,
        type: String(payload.type),
        source: String(payload.source || "coach-web"),
        accountNamespace: normalizedAccountNamespace,
        venueId: normalizedAccountNamespace,
        playbackSessionId: String(payload.playbackSessionId || "").trim(),
        bundleChecksum: String(payload.bundleChecksum || "").trim(),
        requestedAt: Number(payload.requestedAt) || Date.now()
      };

      try {
        const result = await publishTvControl(
          normalizedPayload,
          normalizedAccountNamespace
        );
        sendJson(response, 200, {
          ok: true,
          data: result
        });
      } catch (error) {
        sendJson(response, 502, {
          message: error instanceof Error ? `MQTT 发布失败：${error.message}` : "MQTT 发布失败。"
        });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/app-packages") {
      const platform = url.searchParams.get("platform") || "";
      sendJson(response, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          storageDirectory: getAppPackageRoot(),
          packages: listAppPackages(platform)
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/app-packages/scan") {
      sendJson(response, 200, {
        data: {
          generatedAt: new Date().toISOString(),
          storageDirectory: getAppPackageRoot(),
          packages: rescanAppPackages()
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/app-packages/upload") {
      const validationMessage = validateAppPackageUploadParams(url);

      if (validationMessage) {
        badRequest(response, validationMessage);
        return;
      }

      const originalName = url.searchParams.get("filename") || "app-release.apk";
      const platform = String(url.searchParams.get("platform") || "tv");
      const version = String(url.searchParams.get("version") || "");
      const label = String(url.searchParams.get("label") || "");
      const notes = String(url.searchParams.get("notes") || "");
      const buffer = await readRequestBuffer(request);
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const sizeBytes = buffer.length;
      const storedName = createAppPackageFilename(platform, version, originalName);
      const filePath = path.join(getAppPackageRoot(), storedName);
      fs.writeFileSync(filePath, buffer);
      const appPackage = registerUploadedAppPackage({
        platform,
        version,

        label,
        notes,
        originalName,
        filename: storedName,
        checksum,
        sizeBytes,
        source: "upload"
      });

      sendJson(response, 201, { data: appPackage });
      return;
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/api/app-packages/files/")) {
      const filename = decodeURIComponent(url.pathname.replace("/api/app-packages/files/", ""));
      const filePath = path.join(getAppPackageRoot(), filename);
      if (!fs.existsSync(filePath)) {
        sendJson(response, 404, { message: "安装包不存在。" });
        return;
      }

      sendFile(request, response, filePath, "application/vnd.android.package-archive");
      return;
    }

    if (request.method === "POST" && (url.pathname === "/app/login" || url.pathname === "/api/app/login")) {
      if (!hasCompatBasicAuth(request)) {
        unauthorized(response, "客户端凭证无效。");
        return;
      }

      const payload = await readJsonBody(request);
      const clientName = String(payload?.client || payload?.clientType || payload?.client_type || "editor-web");
      const result = loginConsoleUser(payload?.username, payload?.password, clientName);

      if (result?.error === "CLIENT_NOT_ALLOWED") {
        unauthorized(response, "当前账号不能登录这个端口。");
        return;
      }

      if (result?.error === "VENUE_NOT_BOUND") {
        unauthorized(response, "该账号尚未绑定场馆，请先在场馆管理中完成绑定。");
        return;
      }

      if (!result) {
        unauthorized(response, "用户名或密码错误。");
        return;
      }

      sendCompatSuccess(response, result.token);
      return;
    }

    if (
      (request.method === "GET" || request.method === "POST") &&
      (url.pathname === "/app/refresh" || url.pathname === "/api/app/refresh")
    ) {
      if (!hasCompatBasicAuth(request)) {
        unauthorized(response, "客户端凭证无效。");
        return;
      }

      const payload = request.method === "POST" ? await readJsonBody(request) : null;
      const refreshToken =
        payload?.refresh_token || payload?.refreshToken || url.searchParams.get("refresh_token") || "";
      const clientName = String(payload?.client || payload?.clientType || payload?.client_type || "editor-web");
      const result = refreshConsoleUser(refreshToken, clientName);

      if (result?.error === "CLIENT_NOT_ALLOWED") {
        unauthorized(response, "当前账号不能登录这个端口。");
        return;
      }

      if (!result) {
        unauthorized(response, "refresh token 已失效。");
        return;
      }

      sendCompatSuccess(response, result);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/user/info" || url.pathname === "/api/user/info")) {
      const accessToken = getBearerToken(request);

      if (!accessToken) {
        unauthorized(response);
        return;
      }

      const user = getUserByAccessToken(accessToken);

      if (!user) {
        unauthorized(response);
        return;
      }

      sendCompatSuccess(response, user);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/user/list" || url.pathname === "/api/user/list")) {
      sendCompatSuccess(response, listUsers());
      return;
    }

    if (request.method === "POST" && (url.pathname === "/user/insert" || url.pathname === "/api/user/insert")) {
      const payload = await readJsonBody(request);

      try {
        sendCompatSuccess(response, createConsoleUser(payload));
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "创建用户失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/action-types") {
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, { data: listActionTypes(user, { coursePackageId: url.searchParams.get("coursePackageId") || "" }) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/action-types") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const name = payload?.name?.trim?.();

      if (!name) {
        badRequest(response, "动作分类名称不能为空。");
        return;
      }

      try {
        sendJson(response, 201, { data: addActionType(payload, user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "保存动作分类失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/lesson-types") {
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, { data: listLessonTypes(user, { coursePackageId: url.searchParams.get("coursePackageId") || "" }) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/lesson-types") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      const name = payload?.name?.trim?.();

      if (!name) {
        badRequest(response, "课程分类名称不能为空。");
        return;
      }

      sendJson(response, 201, { data: addLessonType(payload, user) });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/api/upload/video" || url.pathname === "/api/upload/image")) {
      const originalName = url.searchParams.get("filename") || "asset.bin";
      const mimeType = request.headers["content-type"] || guessMimeType(originalName);
      const kind = url.pathname.endsWith("/video") ? "video" : "image";
      const buffer = await readRequestBuffer(request);
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const sizeBytes = buffer.length;
      const storedName = createMediaFilename(originalName);
      let media;

      if (getMediaStorageMode() === "oss") {
        const objectKey = buildStorageKey(storedName);
        const upload = await uploadBufferToOss({
          buffer,
          objectKey,
          mimeType
        });

        media = createUploadedMedia({
          originalName,
          mimeType,
          kind,
          filename: objectKey,
          storage: upload.storage,
          url: upload.url,
          checksum,
          sizeBytes
        });
      } else {
        const filePath = path.join(getMediaRoot(), storedName);
        fs.writeFileSync(filePath, buffer);
        media = createUploadedMedia({
          originalName,
          mimeType,
          kind,
          filename: storedName,
          checksum,
          sizeBytes
        });
      }

      sendJson(response, 201, { data: media });
      return;
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/api/media/")) {
      const filename = decodeURIComponent(url.pathname.replace("/api/media/", ""));
      const media = getMediaRecord(filename);
      const filePath = path.join(getMediaRoot(), filename);

      if (!media || !fs.existsSync(filePath)) {
        sendJson(response, 404, { message: "媒体文件不存在。" });
        return;
      }

      sendFile(request, response, filePath, media.type || guessMimeType(filename));
      return;
    }

    const actionThumbnailMatch = /^\/api\/actions\/(\d+)\/thumbnail$/.exec(url.pathname);
    if ((request.method === "GET" || request.method === "HEAD") && actionThumbnailMatch) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }

      const actionId = Number(actionThumbnailMatch[1]);
      const action = listActions(user).find((item) => Number(item.id) === actionId) || null;
      if (!action?.media?.url) {
        sendJson(response, 404, { message: "动作视频不存在。" });
        return;
      }

      try {
        const thumbnailFile = await getOrCreateActionThumbnailFile(action, getMediaRoot());
        if (!thumbnailFile || !fs.existsSync(thumbnailFile)) {
          sendJson(response, 404, { message: "动作缩略图不可用。" });
          return;
        }
        sendFile(request, response, thumbnailFile, "image/jpeg");
      } catch (error) {
        console.warn("[media-thumbnail] failed", error instanceof Error ? error.message : error);
        sendJson(response, 503, { message: "动作缩略图生成失败。" });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/actions") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      sendJson(response, 200, { data: listActions(user, { coursePackageId: url.searchParams.get("coursePackageId") || "" }) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/actions") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);

      if (!payload?.name?.trim?.()) {
        badRequest(response, "动作名称不能为空。");
        return;
      }

      try {
        sendJson(response, 201, { data: saveAction(payload, user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "动作保存失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/actions/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const actionId = url.pathname.replace("/api/actions/", "");
      const action = getActionById(actionId);

      if (!action || !listActions(user).some((item) => Number(item.id) === Number(action.id))) {
        sendJson(response, 404, { message: "动作不存在。" });
        return;
      }

      sendJson(response, 200, { data: action });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/actions/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const actionId = url.pathname.replace("/api/actions/", "");
      const existing = getActionById(actionId);

      if (!existing) {
        sendJson(response, 404, { message: "动作不存在。" });
        return;
      }

      const payload = await readJsonBody(request);
      try {
        const next = saveAction({ ...payload, id: existing.id }, user);
        sendJson(response, 200, { data: next });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "动作保存失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/actions/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const actionId = url.pathname.replace("/api/actions/", "");
      const result = deleteAction(actionId, user);

      if (!result.ok) {
        sendJson(response, 409, result);
        return;
      }

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/courses/options") {
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, { data: listCourseOptions(url.searchParams.get("coursePackageId") || "", user) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/courses") {
      const user = getAuthorizedConsoleUser(request);
      const courseDetail = String(url.searchParams.get("detail") || "").trim().toLowerCase();
      const includeFullCourses = ["full", "true", "1"].includes(courseDetail);
      sendJson(response, 200, {
        data: includeFullCourses ? listCourses(user) : listCourseSummaries(user),
        meta: {
          detail: includeFullCourses ? "full" : "summary"
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/courses") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);

      if (!payload?.name?.trim?.()) {
        badRequest(response, "课程名称不能为空。");
        return;
      }

      try {
        sendJson(response, 201, { data: saveCourse(payload, user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "课程保存失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/courses/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const courseId = url.pathname.replace("/api/courses/", "");
      const course = getCourseById(courseId);

      if (!course || !listCourseSummaries(user).some((item) => Number(item.id) === Number(course.id))) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      sendJson(response, 200, { data: course });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/courses/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const courseId = url.pathname.replace("/api/courses/", "");
      const existing = getCourseById(courseId);

      if (!existing) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      const payload = await readJsonBody(request);

      try {
        const next = saveCourse({ ...payload, id: existing.id }, user);
        sendJson(response, 200, { data: next });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "课程保存失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/courses/")) {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const courseId = url.pathname.replace("/api/courses/", "");
      const result = deleteCourse(courseId, user);

      if (!result.ok) {
        sendJson(response, 409, result);
        return;
      }

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/templates") {
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, { data: listTemplates(user) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/templates") {
      const user = getAuthorizedConsoleUser(request);
      const payload = await readJsonBody(request);

      try {
        sendJson(response, 201, { data: saveTemplate(payload, user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "模板保存失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/templates/")) {
      const user = getAuthorizedConsoleUser(request);
      const templateId = url.pathname.replace("/api/templates/", "");
      const template = getTemplateById(templateId, user);

      if (!template) {
        sendJson(response, 404, { message: "模板不存在。" });
        return;
      }

      sendJson(response, 200, { data: template });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/templates/")) {
      const user = getAuthorizedConsoleUser(request);
      const templateId = url.pathname.replace("/api/templates/", "");
      const existing = getTemplateById(templateId, user);

      if (!existing) {
        sendJson(response, 404, { message: "模板不存在。" });
        return;
      }

      const payload = await readJsonBody(request);

      try {
        sendJson(response, 200, { data: saveTemplate({ ...payload, id: existing.id }, user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "模板保存失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/templates/")) {
      const user = getAuthorizedConsoleUser(request);
      const templateId = url.pathname.replace("/api/templates/", "");
      const result = deleteTemplate(templateId, user);

      if (!result.ok) {
        sendJson(response, 404, result);
        return;
      }

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/schedules") {
      const scope = url.searchParams.get("scope") || "CURRENTWEEK";
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, {
        data: listSchedulesByScope(scope, {
          coursePackageId: url.searchParams.get("coursePackageId") || "",
          user
        })
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/schedules/week") {
      const user = getAuthorizedConsoleUser(request);
      sendJson(response, 200, {
        data: listSchedulesByWeekDate(url.searchParams.get("date") || "", {
          coursePackageId: url.searchParams.get("coursePackageId") || "",
          user
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/schedules") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);

      if (!payload?.courseId || (!payload?.date && !payload?.beginTime)) {
        badRequest(response, "排课参数不完整。");
        return;
      }

      let schedule = null;
      try {
        schedule = saveSchedule(payload, user);
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "排课保存失败。");
        return;
      }

      if (!schedule) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      sendJson(response, 201, { data: schedule });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/schedules/copy-last-week") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: copyLastWeekSchedules(payload?.coursePackageId || "", user) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "复制上周排课失败。");
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/schedules/copy-week") {
      const user = requireAuthorizedConsoleUser(request, response);

      if (!user) {
        return;
      }
      const payload = await readJsonBody(request);
      try {
        sendJson(response, 200, { data: copyWeekSchedules(payload, user) });
      } catch (error) {
        const statusCode = Number(error?.statusCode) || 400;

        if (statusCode === 409) {
          sendJson(response, 409, { message: error instanceof Error ? error.message : "目标周已有排课。" });
          return;
        }
        badRequest(response, error instanceof Error ? error.message : "复制周排课失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/schedules/")) {
      const scheduleId = url.pathname.replace("/api/schedules/", "");
      sendJson(response, 200, deleteSchedule(scheduleId));
      return;
    }

    sendJson(response, 404, { message: "Route not found." });
  } catch (error) {
    sendJson(response, 500, {
      message: "Unexpected server error.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

let compatRequestServicesStarted = false;

/**
 * 启动 compat request services，避免重复注册后台任务或监听器。
 */
export function startCompatRequestServices() {
  if (compatRequestServicesStarted) {
    return;
  }
  compatRequestServicesStarted = true;
  startOpsMqttSubscriber();
  startPlaybackSessionSweeper();
}
