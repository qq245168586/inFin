const DB_NAME = "infini-course-video-thumbnails";
const DB_VERSION = 1;
const STORE_NAME = "thumbnails";

export const VIDEO_THUMBNAIL_CACHE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

export interface VideoThumbnailCacheRecord {
  key: string;
  blob: Blob;
  bytes: number;
  sourceUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface VideoThumbnailKeyInput {
  actionId?: string | number | null;
  mediaUrl?: string | null;
  updateTime?: string | number | null;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildVideoThumbnailCacheKey({ actionId, mediaUrl, updateTime }: VideoThumbnailKeyInput): string {
  const safeActionId = actionId === undefined || actionId === null || actionId === "" ? "unknown" : String(actionId);
  const safeUpdateTime = updateTime === undefined || updateTime === null || updateTime === "" ? "0" : String(updateTime);
  const safeMediaUrl = mediaUrl || "";
  return `action-video-thumbnail:${safeActionId}:${hashString(`${safeUpdateTime}|${safeMediaUrl}`)}`;
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openThumbnailDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
  });
}

export function selectVideoThumbnailKeysToDelete(
  records: Array<Pick<VideoThumbnailCacheRecord, "key" | "bytes" | "updatedAt">>,
  maxBytes = VIDEO_THUMBNAIL_CACHE_LIMIT_BYTES
): string[] {
  let totalBytes = records.reduce((total, record) => total + Math.max(Number(record.bytes) || 0, 0), 0);
  if (totalBytes <= maxBytes) {
    return [];
  }

  const keysToDelete: string[] = [];
  const oldestFirst = [...records].sort((left, right) => {
    const updatedDiff = Math.max(Number(left.updatedAt) || 0, 0) - Math.max(Number(right.updatedAt) || 0, 0);
    return updatedDiff || String(left.key).localeCompare(String(right.key));
  });

  for (const record of oldestFirst) {
    if (totalBytes <= maxBytes) {
      break;
    }
    keysToDelete.push(record.key);
    totalBytes -= Math.max(Number(record.bytes) || 0, 0);
  }
  return keysToDelete;
}

async function readAllThumbnailRecords(db: IDBDatabase): Promise<VideoThumbnailCacheRecord[]> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result || []) as VideoThumbnailCacheRecord[]);
    request.onerror = () => resolve([]);
  });
}

async function pruneVideoThumbnailCache(db: IDBDatabase, maxBytes = VIDEO_THUMBNAIL_CACHE_LIMIT_BYTES) {
  const records = await readAllThumbnailRecords(db);
  const keysToDelete = selectVideoThumbnailKeysToDelete(records, maxBytes);
  if (!keysToDelete.length) {
    return;
  }

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  for (const key of keysToDelete) {
    store.delete(key);
  }
  await waitForTransaction(transaction).catch(() => undefined);
}

export async function readCachedVideoThumbnail(key: string): Promise<Blob | null> {
  const db = await openThumbnailDb();
  if (!db || !key) {
    return null;
  }

  try {
    const record = await new Promise<VideoThumbnailCacheRecord | null>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as VideoThumbnailCacheRecord | undefined) || null);
      request.onerror = () => resolve(null);
    });

    if (!record?.blob) {
      return null;
    }

    const touchedRecord = { ...record, updatedAt: Date.now() };
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(touchedRecord);
    waitForTransaction(transaction).catch(() => undefined);
    return record.blob;
  } finally {
    db.close();
  }
}

export async function writeCachedVideoThumbnail(key: string, blob: Blob, sourceUrl: string): Promise<void> {
  const db = await openThumbnailDb();
  if (!db || !key || !blob) {
    return;
  }

  try {
    const now = Date.now();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      key,
      blob,
      bytes: blob.size,
      sourceUrl,
      createdAt: now,
      updatedAt: now
    } satisfies VideoThumbnailCacheRecord);
    await waitForTransaction(transaction);
    await pruneVideoThumbnailCache(db);
  } catch {
    // Thumbnail cache is a performance optimization only; failures should never block editing.
  } finally {
    db.close();
  }
}
