import { requestBlobWithMeta } from "./api.ts";
import type { CourseRecord, VideoCard, WaterfallItem } from "./types.ts";

const MEDIA_CACHE_CONCURRENCY = 4;
const MIN_VIDEO_BYTES = 1024;
const OSS_SHANGHAI_HOST = "console-background.oss-cn-shanghai.aliyuncs.com";
const OSS_SHANGHAI_PROXY_PREFIX = "/simulator-media/oss-shanghai/";

export type MediaCacheMode = "blob" | "proxy-blob";
export type MediaCacheEvent = "start" | "success" | "fallback" | "failed";

export interface MediaCacheDiagnostic {
  event: MediaCacheEvent;
  mode: MediaCacheMode;
  index: number;
  total: number;
  name: string;
  url: string;
  origin: string;
  durationMs: number;
  bytes: number;
  speedKbps: number;
  httpStatus: number;
  error: string;
}

export interface MediaCacheProgress {
  status: "idle" | "checking" | "downloading" | "ready" | "failed";
  completed: number;
  total: number;
  currentName: string;
  error: string;
  diagnostics: MediaCacheDiagnostic[];
}

interface MediaResource {
  url: string;
  name: string;
}

interface CachedResource {
  sourceUrl: string;
  cachedUrl: string;
  objectUrl: string;
}

export interface CachedCourseMedia {
  course: CourseRecord;
  objectUrls: string[];
}

declare global {
  interface Window {
    __infiniSimulatorMediaLog?: MediaCacheDiagnostic[];
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nowMs(): number {
  return Math.round(performance.now());
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value, window.location.href);
  } catch {
    return null;
  }
}

function urlOrigin(value: string): string {
  return safeUrl(value)?.origin || "unknown";
}

function isCrossOriginUrl(value: string): boolean {
  const parsed = safeUrl(value);
  return Boolean(parsed && parsed.origin !== window.location.origin);
}

function resolveDownloadUrl(value: string): { mode: MediaCacheMode; url: string } {
  const parsed = safeUrl(value);
  if (parsed?.hostname === OSS_SHANGHAI_HOST) {
    const objectPath = parsed.pathname.replace(/^\/+/, "");
    return {
      mode: "proxy-blob",
      url: `${OSS_SHANGHAI_PROXY_PREFIX}${objectPath}${parsed.search}`
    };
  }
  return { mode: "blob", url: value };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "未知错误");
}

function abortError(): DOMException {
  return new DOMException("缓存已取消", "AbortError");
}

function createDiagnostic({
  bytes = 0,
  durationMs = 0,
  error = "",
  event,
  httpStatus = 0,
  index,
  mode,
  name,
  total,
  url
}: {
  bytes?: number;
  durationMs?: number;
  error?: string;
  event: MediaCacheEvent;
  httpStatus?: number;
  index: number;
  mode: MediaCacheMode;
  name: string;
  total: number;
  url: string;
}): MediaCacheDiagnostic {
  const seconds = durationMs > 0 ? durationMs / 1000 : 0;
  return {
    event,
    mode,
    index,
    total,
    name,
    url,
    origin: urlOrigin(url),
    durationMs,
    bytes,
    speedKbps: seconds > 0 && bytes > 0 ? Math.round((bytes / 1024 / seconds) * 10) / 10 : 0,
    httpStatus,
    error
  };
}

function pushResource(resources: MediaResource[], seen: Set<string>, mediaUrl: unknown, name: unknown) {
  const url = text(mediaUrl);
  if (!url || url.startsWith("blob:") || seen.has(url)) return;
  seen.add(url);
  resources.push({
    url,
    name: text(name) || "课程视频"
  });
}

function collectWaterfallResources(items: WaterfallItem[] | undefined, resources: MediaResource[], seen: Set<string>) {
  for (const item of items || []) {
    pushResource(resources, seen, item.mediaUrl, item.actionName);
  }
}

function collectTrainingResources(cards: VideoCard[] | undefined, resources: MediaResource[], seen: Set<string>) {
  for (const card of cards || []) {
    pushResource(resources, seen, card.mediaUrl, card.actionName || card.stationNumber);
  }
}

export function collectCourseMediaResources(course: CourseRecord | null): MediaResource[] {
  const resources: MediaResource[] = [];
  const seen = new Set<string>();
  collectWaterfallResources(course?.script?.sections?.warmup?.items, resources, seen);
  collectWaterfallResources(course?.script?.sections?.cooldown?.items, resources, seen);
  for (const group of course?.script?.training?.videoGroups || []) {
    for (const screen of group.screens || []) {
      collectTrainingResources(screen.videoCards, resources, seen);
    }
  }
  return resources;
}

function publishDiagnostics(diagnostics: MediaCacheDiagnostic[]) {
  window.__infiniSimulatorMediaLog = diagnostics.slice();
}

function writeConsoleLog(diagnostic: MediaCacheDiagnostic) {
  const method = diagnostic.event === "failed" ? "error" : diagnostic.event === "fallback" ? "warn" : "info";
  console[method]("[websimulator:media-cache]", diagnostic);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false;
  return Array.from(value).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

async function validateVideoBlob(resource: MediaResource, blob: Blob, contentType: string): Promise<void> {
  if (blob.size < MIN_VIDEO_BYTES) {
    throw new Error(`视频响应过小 (${blob.size} bytes)，可能返回了网页或错误内容`);
  }

  const normalizedType = contentType.toLowerCase();
  if (normalizedType.includes("text/html") || normalizedType.includes("application/json") || normalizedType.includes("text/plain")) {
    throw new Error(`视频响应类型异常 (${contentType || "unknown"})`);
  }

  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const path = safeUrl(resource.url)?.pathname.toLowerCase() || resource.url.toLowerCase();
  const isIsoMedia = hasAscii(header, 4, "ftyp");
  const isWebm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  if ((path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".m4v")) && !isIsoMedia) {
    throw new Error("视频文件头无效，可能返回了 Course 页面而不是媒体文件");
  }
  if (path.endsWith(".webm") && !isWebm) {
    throw new Error("WebM 文件头无效");
  }
}

function replaceWaterfallUrls(items: WaterfallItem[] | undefined, cache: Map<string, string>) {
  for (const item of items || []) {
    const cachedUrl = cache.get(text(item.mediaUrl));
    if (cachedUrl) item.mediaUrl = cachedUrl;
  }
}

function replaceTrainingUrls(cards: VideoCard[] | undefined, cache: Map<string, string>) {
  for (const card of cards || []) {
    const cachedUrl = cache.get(text(card.mediaUrl));
    if (cachedUrl) card.mediaUrl = cachedUrl;
  }
}

async function cacheOneResource({
  diagnostics,
  index,
  record,
  resource,
  signal,
  total
}: {
  diagnostics: MediaCacheDiagnostic[];
  index: number;
  record: (diagnostic: MediaCacheDiagnostic) => void;
  resource: MediaResource;
  signal?: AbortSignal;
  total: number;
}): Promise<CachedResource> {
  if (signal?.aborted) throw abortError();
  const startAt = nowMs();
  const download = resolveDownloadUrl(resource.url);

  record(createDiagnostic({ event: "start", index, mode: download.mode, name: resource.name, total, url: resource.url }));

  try {
    const result = await requestBlobWithMeta(download.url, { signal });
    await validateVideoBlob(resource, result.blob, result.contentType);

    const durationMs = Math.max(1, nowMs() - startAt);
    const objectUrl = URL.createObjectURL(result.blob);
    record(
      createDiagnostic({
        bytes: result.blob.size || result.contentLength,
        durationMs,
        event: "success",
        httpStatus: result.status,
        index,
        mode: download.mode,
        name: resource.name,
        total,
        url: resource.url
      })
    );
    return {
      sourceUrl: resource.url,
      cachedUrl: objectUrl,
      objectUrl
    };
  } catch (error) {
    const cause = errorMessage(error);
    const message = isCrossOriginUrl(resource.url) && download.mode === "blob"
      ? `跨域视频无法完整下载，请配置同源代理或 CORS：${cause}`
      : cause;
    record(
      createDiagnostic({
        durationMs: Math.max(1, nowMs() - startAt),
        error: message,
        event: "failed",
        index,
        mode: download.mode,
        name: resource.name,
        total,
        url: resource.url
      })
    );
    throw new Error(`${resource.name}: ${message}`);
  } finally {
    publishDiagnostics(diagnostics);
  }
}

export async function cacheCourseMedia(
  course: CourseRecord,
  {
    onProgress,
    signal
  }: {
    onProgress?: (progress: MediaCacheProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<CachedCourseMedia> {
  const resources = collectCourseMediaResources(course);
  const total = resources.length;
  const diagnostics: MediaCacheDiagnostic[] = [];
  let completed = 0;

  const emitProgress = (status: MediaCacheProgress["status"], currentName = "", error = "") => {
    onProgress?.({
      status,
      completed,
      total,
      currentName,
      error,
      diagnostics: diagnostics.slice()
    });
  };

  const record = (diagnostic: MediaCacheDiagnostic) => {
    diagnostics.push(diagnostic);
    publishDiagnostics(diagnostics);
    writeConsoleLog(diagnostic);
    emitProgress("downloading", diagnostic.name);
  };

  emitProgress("checking");

  if (total === 0) {
    emitProgress("ready");
    return { course, objectUrls: [] };
  }

  const cachedUrlBySource = new Map<string, string>();
  const objectUrls: string[] = [];
  const cachedResources: CachedResource[] = [];
  let nextIndex = 0;
  let firstError: unknown = null;

  const worker = async () => {
    while (!firstError) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= resources.length) return;
      const resource = resources[index];
      try {
        const cachedResource = await cacheOneResource({
          diagnostics,
          index: index + 1,
          record,
          resource,
          signal,
          total
        });
        cachedResources[index] = cachedResource;
        if (cachedResource.objectUrl) objectUrls.push(cachedResource.objectUrl);
        completed += 1;
        emitProgress("downloading", resource.name);
      } catch (error) {
        firstError = error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(MEDIA_CACHE_CONCURRENCY, total) }, () => worker()));

  if (firstError) {
    revokeCachedObjectUrls(objectUrls);
    const message = errorMessage(firstError);
    emitProgress("failed", "", message);
    throw firstError;
  }

  for (const cachedResource of cachedResources) {
    if (cachedResource) {
      cachedUrlBySource.set(cachedResource.sourceUrl, cachedResource.cachedUrl);
    }
  }

  const nextCourse = clone(course);
  replaceWaterfallUrls(nextCourse.script?.sections?.warmup?.items, cachedUrlBySource);
  replaceWaterfallUrls(nextCourse.script?.sections?.cooldown?.items, cachedUrlBySource);
  for (const group of nextCourse.script?.training?.videoGroups || []) {
    for (const screen of group.screens || []) {
      replaceTrainingUrls(screen.videoCards, cachedUrlBySource);
    }
  }

  completed = total;
  emitProgress("ready");
  return { course: nextCourse, objectUrls };
}

export function revokeCachedObjectUrls(urls: string[]) {
  for (const url of urls) {
    URL.revokeObjectURL(url);
  }
}
