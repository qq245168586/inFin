import { createHmac } from "node:crypto";

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimSlash(value) {
  return trimText(value).replace(/\/+$/g, "");
}

function trimEdgeSlash(value) {
  return trimText(value).replace(/^\/+|\/+$/g, "");
}

function encodeObjectKey(objectKey) {
  return objectKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

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

function createAuthorization(config, method, contentType, date, objectKey) {
  const resource = `/${config.bucket}/${objectKey}`;
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
  const signature = createHmac("sha1", config.accessKeySecret).update(stringToSign).digest("base64");
  return `OSS ${config.accessKeyId}:${signature}`;
}

export function getMediaStorageMode() {
  return readOssConfig() ? "oss" : "local";
}

export function buildStorageKey(filename) {
  const config = readOssConfig();
  const cleanName = trimEdgeSlash(filename);

  if (!config?.objectPrefix) {
    return cleanName;
  }

  return `${config.objectPrefix}/${cleanName}`;
}

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
