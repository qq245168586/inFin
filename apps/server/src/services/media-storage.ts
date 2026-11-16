import { createHmac } from "node:crypto";

/**
 * 修剪 text 文本，统一空值和边界字符处理。
 */
function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 修剪 slash 文本，统一空值和边界字符处理。
 */
function trimSlash(value) {
  return trimText(value).replace(/\/+$/g, "");
}

/**
 * 修剪 edge slash 文本，统一空值和边界字符处理。
 */
function trimEdgeSlash(value) {
  return trimText(value).replace(/^\/+|\/+$/g, "");
}

/**
 * 封装 encode object key 的业务步骤，避免调用方依赖内部实现细节。
 */
function encodeObjectKey(objectKey) {
  return objectKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * 读取 oss config，把底层数据转成调用方可直接使用的结构。
 */
function readOssConfig() {
  const accessKeyId = trimText(process.env.OSS_ACCESS_KEY_ID);
  const accessKeySecret = trimText(process.env.OSS_ACCESS_KEY_SECRET);
  const bucket = trimText(process.env.OSS_BUCKET);
  const endpointInput = trimText(process.env.OSS_ENDPOINT);

  if (!accessKeyId || !accessKeySecret || !bucket || !endpointInput) {
    return null;
  }

  const endpoint =
    endpointInput.startsWith("http://") || endpointInput.startsWith("https://")
      ? endpointInput
      : `https://${endpointInput}`;
  const endpointUrl = new URL(endpoint);
  const objectPrefix = trimEdgeSlash(process.env.OSS_OBJECT_PREFIX || "");
  const publicBaseUrl = trimSlash(process.env.OSS_PUBLIC_BASE_URL || `${endpointUrl.protocol}//${bucket}.${endpointUrl.host}`);
  const uploadBaseUrl = `${endpointUrl.protocol}//${bucket}.${endpointUrl.host}`;

  return {
    accessKeyId,
    accessKeySecret,
    bucket,
    objectPrefix,
    publicBaseUrl,
    uploadBaseUrl
  };
}

/**
 * 创建 authorization，并补齐运行时需要的默认配置。
 */
function createAuthorization(config, method, contentType, date, objectKey) {
  const resource = `/${config.bucket}/${objectKey}`;
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");
  return `OSS ${config.accessKeyId}:${signature}`;
}

/**
 * 读取 media storage mode，并保持返回结构稳定。
 */
export function getMediaStorageMode() {
  return readOssConfig() ? "oss" : "local";
}

/**
 * 组装 storage key，把分散的输入合成稳定输出。
 */
export function buildStorageKey(filename) {
  const config = readOssConfig();
  const cleanName = trimEdgeSlash(filename);

  if (!config?.objectPrefix) {
    return cleanName;
  }

  return `${config.objectPrefix}/${cleanName}`;
}

/**
 * 上传 buffer to oss，并返回后续业务可保存的资源信息。
 */
export async function uploadBufferToOss({ buffer, objectKey, mimeType }) {
  const config = readOssConfig();

  if (!config) {
    throw new Error("OSS 未配置。");
  }

  const contentType = trimText(mimeType) || "application/octet-stream";
  const requestDate = new Date().toUTCString();
  const uploadUrl = `${config.uploadBaseUrl}/${encodeObjectKey(objectKey)}`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: createAuthorization(config, "PUT", contentType, requestDate, objectKey),
      Date: requestDate,
      "Content-Type": contentType
    },
    body: buffer
  });

  if (!response.ok) {
    const message = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`OSS 上传失败 (${response.status})${message ? `: ${message}` : ""}`);
  }

  return {
    storage: "oss",
    url: `${config.publicBaseUrl}/${encodeObjectKey(objectKey)}`
  };
}
