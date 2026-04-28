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
  copyLastWeekSchedules,
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
  getCourseById,
  getMediaRecord,
  getMediaRoot,
  getMetaPayload,
  getTemplateById,
  getTvDailyBundle,
  getTvDailyChecksum,
  getTvScheduleBundle,
  heartbeatTvScreen,
  listUsers,
  listActions,
  listActionTypes,
  listAppPackages,
  listCourses,
  listCourseOptions,
  listLessonTypes,
  listTemplates,
  listSchedulesByScope,
  listTvScreens,
  loginConsoleUser,
  refreshConsoleUser,
  registerUploadedAppPackage,
  rescanAppPackages,
  saveAction,
  saveCourse,
  saveTemplate,
  saveSchedule,
  unbindTvScreen
} from "./data/store.js";
import { buildStorageKey, getMediaStorageMode, uploadBufferToOss } from "./services/media-storage.js";
import { getTvControlConfig, publishTvControl } from "./services/tv-control.js";
import { readJsonBody, readRequestBuffer, sendFile, sendJson, sendNoContent } from "./utils/http.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3100);
const legacyBasicAuth = "Basic REDACTED_CONFIGURE_LOCALLY";

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

function guessMimeType(filename, fallback = "application/octet-stream") {
  return mimeByExtension[path.extname(filename).toLowerCase()] || fallback;
}

function badRequest(response, message) {
  sendJson(response, 400, { message });
}

function unauthorized(response, message = "登录已失效，请重新登录。") {
  sendJson(response, 403, {
    code: 403,
    message,
    msg: message
  });
}

function okLegacy(response, data) {
  sendJson(response, 200, {
    code: 200,
    data,
    message: "success",
    msg: "success"
  });
}

function hasLegacyBasicAuth(request) {
  return request.headers.authorization === legacyBasicAuth;
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function getAuthorizedConsoleUser(request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  return getUserByAccessToken(accessToken);
}

function requireAuthorizedConsoleUser(request, response) {
  const user = getAuthorizedConsoleUser(request);
  if (!user) {
    unauthorized(response);
    return null;
  }
  return user;
}

function resolveAccountNamespace(value, fallback = "13689547720") {
  const text = String(value || "").trim().toLowerCase();
  return text || fallback;
}

function resolveOptionalAccountNamespace(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidTvControlType(value) {
  return ["refresh_checksum", "preview_course", "start_course", "pause_course", "resume_course", "terminate_course"].includes(
    String(value || "")
  );
}

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

function resolveTvControlNamespace(targetScreen, accountNamespace) {
  if (!targetScreen?.deviceId) {
    return resolveAccountNamespace(accountNamespace);
  }
  if (String(targetScreen.accountNamespace || "").trim()) {
    return resolveAccountNamespace(accountNamespace);
  }
  return "__unbound__";
}

const server = http.createServer(async (request, response) => {
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

    if (request.method === "GET" && (url.pathname === "/api/meta" || url.pathname === "/api/editor/bootstrap")) {
      sendJson(response, 200, getMetaPayload());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/daily-bundle") {
      const date = url.searchParams.get("date") || "";
      const timeZone = url.searchParams.get("timeZone") || "Asia/Shanghai";
      sendJson(response, 200, getTvDailyBundle(date, timeZone));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tv/daily-checksum") {
      const date = url.searchParams.get("date") || "";
      const timeZone = url.searchParams.get("timeZone") || "Asia/Shanghai";
      sendJson(response, 200, getTvDailyChecksum(date, timeZone));
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
      sendJson(response, 200, listTvScreens(resolveAccountNamespace(user.accountNamespace, user.username)));
      return;
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

      const normalizedAccountNamespace = resolveAccountNamespace(user.accountNamespace, user.username);
      const normalizedPayload = {
        ...payload,
        type: String(payload.type),
        source: String(payload.source || "coach-web"),
        accountNamespace: normalizedAccountNamespace,
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
      if (!hasLegacyBasicAuth(request)) {
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
      if (!result) {
        unauthorized(response, "用户名或密码错误。");
        return;
      }

      okLegacy(response, result.token);
      return;
    }

    if (
      (request.method === "GET" || request.method === "POST") &&
      (url.pathname === "/app/refresh" || url.pathname === "/api/app/refresh")
    ) {
      if (!hasLegacyBasicAuth(request)) {
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

      okLegacy(response, result);
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

      okLegacy(response, user);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/user/list" || url.pathname === "/api/user/list")) {
      okLegacy(response, listUsers());
      return;
    }

    if (request.method === "POST" && (url.pathname === "/user/insert" || url.pathname === "/api/user/insert")) {
      const payload = await readJsonBody(request);

      try {
        okLegacy(response, createConsoleUser(payload));
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "创建用户失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/action-types") {
      sendJson(response, 200, { data: listActionTypes() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/action-types") {
      const payload = await readJsonBody(request);
      const name = payload?.name?.trim?.();

      if (!name) {
        badRequest(response, "动作分类名称不能为空。");
        return;
      }

      sendJson(response, 201, { data: addActionType(name) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/lesson-types") {
      sendJson(response, 200, { data: listLessonTypes() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/lesson-types") {
      const payload = await readJsonBody(request);
      const name = payload?.name?.trim?.();

      if (!name) {
        badRequest(response, "课程分类名称不能为空。");
        return;
      }

      sendJson(response, 201, { data: addLessonType(name) });
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

    if (request.method === "GET" && url.pathname === "/api/actions") {
      sendJson(response, 200, { data: listActions() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/actions") {
      const payload = await readJsonBody(request);

      if (!payload?.name?.trim?.()) {
        badRequest(response, "动作名称不能为空。");
        return;
      }

      sendJson(response, 201, { data: saveAction(payload) });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/actions/")) {
      const actionId = url.pathname.replace("/api/actions/", "");
      const action = getActionById(actionId);

      if (!action) {
        sendJson(response, 404, { message: "动作不存在。" });
        return;
      }

      sendJson(response, 200, { data: action });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/actions/")) {
      const actionId = url.pathname.replace("/api/actions/", "");
      const existing = getActionById(actionId);

      if (!existing) {
        sendJson(response, 404, { message: "动作不存在。" });
        return;
      }

      const payload = await readJsonBody(request);
      const next = saveAction({ ...payload, id: existing.id });
      sendJson(response, 200, { data: next });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/actions/")) {
      const actionId = url.pathname.replace("/api/actions/", "");
      const result = deleteAction(actionId);

      if (!result.ok) {
        sendJson(response, 409, result);
        return;
      }

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/courses/options") {
      sendJson(response, 200, { data: listCourseOptions() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/courses") {
      sendJson(response, 200, { data: listCourses() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/courses") {
      const payload = await readJsonBody(request);

      if (!payload?.name?.trim?.()) {
        badRequest(response, "课程名称不能为空。");
        return;
      }

      try {
        sendJson(response, 201, { data: saveCourse(payload) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "课程保存失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/courses/")) {
      const courseId = url.pathname.replace("/api/courses/", "");
      const course = getCourseById(courseId);

      if (!course) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      sendJson(response, 200, { data: course });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/courses/")) {
      const courseId = url.pathname.replace("/api/courses/", "");
      const existing = getCourseById(courseId);

      if (!existing) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      const payload = await readJsonBody(request);

      try {
        const next = saveCourse({ ...payload, id: existing.id });
        sendJson(response, 200, { data: next });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "课程保存失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/courses/")) {
      const courseId = url.pathname.replace("/api/courses/", "");
      const result = deleteCourse(courseId);

      if (!result.ok) {
        sendJson(response, 409, result);
        return;
      }

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/templates") {
      sendJson(response, 200, { data: listTemplates() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/templates") {
      const payload = await readJsonBody(request);

      try {
        sendJson(response, 201, { data: saveTemplate(payload) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "模板保存失败。");
      }
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/templates/")) {
      const templateId = url.pathname.replace("/api/templates/", "");
      const template = getTemplateById(templateId);

      if (!template) {
        sendJson(response, 404, { message: "模板不存在。" });
        return;
      }

      sendJson(response, 200, { data: template });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/templates/")) {
      const templateId = url.pathname.replace("/api/templates/", "");
      const existing = getTemplateById(templateId);

      if (!existing) {
        sendJson(response, 404, { message: "模板不存在。" });
        return;
      }

      const payload = await readJsonBody(request);

      try {
        sendJson(response, 200, { data: saveTemplate({ ...payload, id: existing.id }) });
      } catch (error) {
        badRequest(response, error instanceof Error ? error.message : "模板保存失败。");
      }
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/templates/")) {
      const templateId = url.pathname.replace("/api/templates/", "");
      sendJson(response, 200, deleteTemplate(templateId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/schedules") {
      const scope = url.searchParams.get("scope") || "CURRENTWEEK";
      sendJson(response, 200, { data: listSchedulesByScope(scope) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/schedules") {
      const payload = await readJsonBody(request);

      if (!payload?.courseId || !payload?.beginTime || !payload?.duration) {
        badRequest(response, "排课参数不完整。");
        return;
      }

      const schedule = saveSchedule(payload);

      if (!schedule) {
        sendJson(response, 404, { message: "课程不存在。" });
        return;
      }

      sendJson(response, 201, { data: schedule });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/schedules/copy-last-week") {
      sendJson(response, 200, { data: copyLastWeekSchedules() });
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
});

server.listen(port, host, () => {
  console.log(`Infini server listening on http://${host}:${port}`);
});
