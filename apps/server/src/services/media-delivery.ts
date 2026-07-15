import fs from "node:fs";
import path from "node:path";
import { sendEmpty, sendFile } from "../utils/http.js";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const DEFAULT_X_ACCEL_PREFIX = "";

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
}

function normalizeEtag(checksum: string, stats: fs.Stats): string {
  const normalizedChecksum = String(checksum || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (normalizedChecksum) {
    return `"sha256-${normalizedChecksum}"`;
  }
  return `"file-${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
}

function normalizeXAccelPrefix(prefix: string): string {
  const trimmed = String(prefix || DEFAULT_X_ACCEL_PREFIX).trim();
  if (!trimmed) {
    return "";
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag || value.replace(/^W\//, "") === etag);
}

function isNotModified(request: any, etag: string, stats: fs.Stats): boolean {
  const ifNoneMatch = firstHeaderValue(request.headers?.["if-none-match"]);
  if (ifNoneMatch) {
    return etagMatches(ifNoneMatch, etag);
  }

  const ifModifiedSince = firstHeaderValue(request.headers?.["if-modified-since"]);
  if (!ifModifiedSince) {
    return false;
  }
  const sinceMs = Date.parse(ifModifiedSince);
  if (!Number.isFinite(sinceMs)) {
    return false;
  }
  return Math.floor(stats.mtimeMs / 1000) <= Math.floor(sinceMs / 1000);
}

/**
 * 将 URL 中的媒体文件名约束在媒体根目录内，拒绝路径穿越和嵌套路径。
 */
export function resolveSafeMediaFile(mediaRoot: string, filename: string): string | null {
  const normalizedFilename = String(filename || "").trim();
  if (
    !normalizedFilename ||
    normalizedFilename.includes("\0") ||
    normalizedFilename.includes("/") ||
    normalizedFilename.includes("\\") ||
    path.basename(normalizedFilename) !== normalizedFilename
  ) {
    return null;
  }

  const resolvedRoot = path.resolve(mediaRoot);
  const resolvedFile = path.resolve(resolvedRoot, normalizedFilename);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolvedFile;
}

/**
 * 记录一次媒体响应决策。X-Accel 模式的实际字节和耗时由 Nginx media access log 记录。
 */
function logMediaDelivery(request: any, details: Record<string, unknown>) {
  const headers = request.headers || {};
  console.info(
    `[media-delivery] ${JSON.stringify({
      deviceId: firstHeaderValue(headers["x-infini-device-id"]) || "-",
      screenNumber: firstHeaderValue(headers["x-infini-screen-number"]) || "-",
      checksum: firstHeaderValue(headers["x-infini-media-checksum"]) || details.checksum || "-",
      appVersion: firstHeaderValue(headers["x-infini-app-version"]) || "-",
      intent: firstHeaderValue(headers["x-infini-media-intent"]) || "-",
      range: firstHeaderValue(headers.range) || "-",
      method: request.method || "GET",
      ...details
    })}`
  );
}

/**
 * 发送本地媒体文件：先处理缓存协商，再选择 Nginx X-Accel 或 Node Range 流。
 */
export function sendMediaFile(
  request: any,
  response: any,
  options: {
    filePath: string;
    filename: string;
    contentType: string;
    checksum?: string;
    xAccelPrefix?: string;
  }
) {
  const startedAt = Date.now();
  const stats = fs.statSync(options.filePath);
  const etag = normalizeEtag(options.checksum || "", stats);
  const commonHeaders = {
    "Cache-Control": IMMUTABLE_CACHE_CONTROL,
    ETag: etag,
    "Last-Modified": stats.mtime.toUTCString(),
    "Accept-Ranges": "bytes"
  };

  if (isNotModified(request, etag, stats)) {
    sendEmpty(response, 304, commonHeaders);
    logMediaDelivery(request, {
      filename: options.filename,
      checksum: options.checksum || "-",
      status: 304,
      bytes: 0,
      durationMs: Date.now() - startedAt,
      deliveryMode: "cache-validation"
    });
    return { statusCode: 304, deliveryMode: "cache-validation" };
  }

  const xAccelPrefix = normalizeXAccelPrefix(
    options.xAccelPrefix ?? process.env.INFINI_MEDIA_X_ACCEL_PREFIX ?? ""
  );
  if (xAccelPrefix) {
    sendEmpty(response, 200, {
      ...commonHeaders,
      "Content-Type": options.contentType,
      "Content-Length": stats.size,
      "X-Accel-Redirect": `${xAccelPrefix}${encodeURIComponent(options.filename)}`
    });
    logMediaDelivery(request, {
      filename: options.filename,
      checksum: options.checksum || "-",
      status: 200,
      bytes: stats.size,
      durationMs: Date.now() - startedAt,
      deliveryMode: "x-accel"
    });
    return { statusCode: 200, deliveryMode: "x-accel" };
  }

  sendFile(request, response, options.filePath, options.contentType, { headers: commonHeaders });
  logMediaDelivery(request, {
    filename: options.filename,
    checksum: options.checksum || "-",
    status: response.statusCode || 200,
    bytes: stats.size,
    durationMs: Date.now() - startedAt,
    deliveryMode: "node-stream"
  });
  return { statusCode: response.statusCode || 200, deliveryMode: "node-stream" };
}
