import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";

const THUMBNAIL_DIR_NAME = "_action-thumbnails";
const THUMBNAIL_TIMEOUT_MS = 25 * 1000;

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function keyPart(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveLocalMediaPath(media: any, mediaRoot: string) {
  const filename = trimText(media?.filename);
  if (!filename) return "";

  const filePath = path.join(mediaRoot, filename);
  return fs.existsSync(filePath) ? filePath : "";
}

function resolveThumbnailSource(action: any, mediaRoot: string) {
  const media = action?.media || {};
  const localPath = resolveLocalMediaPath(media, mediaRoot);
  if (localPath) return localPath;

  const url = trimText(media.url);
  if (/^https?:\/\//i.test(url)) return url;

  return "";
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg 生成缩略图超时。"));
    }, THUMBNAIL_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg 生成缩略图失败 (${code})。`));
    });
  });
}

function createFfmpegThumbnailArgs(source: string, targetPath: string, seekTime: string) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    seekTime,
    "-i",
    source,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-2",
    "-q:v",
    "5",
    targetPath
  ];
}

async function createThumbnailFile(source: string, targetPath: string) {
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp.jpg`;

  try {
    await runFfmpeg(createFfmpegThumbnailArgs(source, temporaryPath, "00:00:00.400"));
  } catch (error) {
    await runFfmpeg(createFfmpegThumbnailArgs(source, temporaryPath, "00:00:00.000"));
  }

  if (!fs.existsSync(temporaryPath) || fs.statSync(temporaryPath).size <= 0) {
    throw new Error("生成缩略图结果为空。");
  }

  fs.renameSync(temporaryPath, targetPath);
}

export function buildActionThumbnailKey(action: any) {
  const media = action?.media || {};
  return hashText(
    [
      "action",
      keyPart(action?.id),
      keyPart(action?.updateTime),
      keyPart(media?.url),
      keyPart(media?.checksum),
      keyPart(media?.sizeBytes)
    ].join("|")
  );
}

export async function getOrCreateActionThumbnailFile(action: any, mediaRoot: string) {
  if (!action?.media?.url) {
    return null;
  }

  const source = resolveThumbnailSource(action, mediaRoot);
  if (!source) {
    return null;
  }

  const thumbnailDir = path.join(mediaRoot, THUMBNAIL_DIR_NAME);
  ensureDir(thumbnailDir);

  const thumbnailPath = path.join(thumbnailDir, `${buildActionThumbnailKey(action)}.jpg`);
  if (!fs.existsSync(thumbnailPath)) {
    await createThumbnailFile(source, thumbnailPath);
  }

  return thumbnailPath;
}
