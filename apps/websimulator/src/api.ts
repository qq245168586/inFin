import type { ActionRecord, CourseRecord, MetaPayload } from "./types.ts";

const AUTH_STORAGE_KEY = "infini-admin-auth";
const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

interface AuthSession {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  issued_at?: number;
  expires_at?: number;
}

interface LegacyEnvelope<T> {
  data: T;
  message?: string;
  msg?: string;
}

export class RequestJsonError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestJsonError";
    this.status = status;
  }
}

export interface RequestBlobResult {
  blob: Blob;
  status: number;
  contentLength: number;
  contentType: string;
  responseUrl: string;
}

function readStoredAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function saveStoredAuthSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function authHeaderFromSession(session: AuthSession | null): string {
  if (!session?.access_token) return "";
  return `${session.token_type || "Bearer"} ${session.access_token}`;
}

async function refreshStoredAuthHeader(): Promise<string> {
  const current = readStoredAuthSession();
  if (!current?.refresh_token) {
    throw new Error("请先在课程端登录。");
  }

  const response = await fetch("/api/app/refresh", {
    method: "POST",
    headers: {
      Authorization: LEGACY_BASIC_AUTH,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: current.refresh_token,
      client: "editor-web"
    })
  });
  const payload = (await response.json().catch(() => null)) as LegacyEnvelope<AuthSession> | null;
  if (!response.ok || !payload?.data?.access_token) {
    throw new RequestJsonError(response.status, payload?.message || payload?.msg || "登录已失效，请回到课程端重新登录。");
  }

  const issuedAt = Date.now();
  const nextSession = {
    ...current,
    ...payload.data,
    issued_at: issuedAt,
    expires_at: issuedAt + Math.max(0, Number(payload.data.expires_in) || 0) * 1000
  };
  saveStoredAuthSession(nextSession);
  return authHeaderFromSession(nextSession);
}

export function hasStoredAuthSession(): boolean {
  return Boolean(readStoredAuthSession()?.refresh_token || readStoredAuthSession()?.access_token);
}

export async function requestJson<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const session = readStoredAuthSession();
  const authHeader = authHeaderFromSession(session);
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string; msg?: string } | null;

  if (!response.ok && retry && (response.status === 401 || response.status === 403)) {
    const refreshedAuthHeader = await refreshStoredAuthHeader();
    return requestJson<T>(
      path,
      {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: refreshedAuthHeader
        }
      },
      false
    );
  }

  if (!response.ok) {
    const message = (payload as { message?: string; msg?: string } | null)?.message || (payload as { msg?: string } | null)?.msg || `请求失败 (${response.status})`;
    throw new RequestJsonError(response.status, message);
  }

  return payload as T;
}

export async function requestBlobWithMeta(path: string, options: RequestInit = {}, retry = true): Promise<RequestBlobResult> {
  const session = readStoredAuthSession();
  const authHeader = authHeaderFromSession(session);
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok && retry && (response.status === 401 || response.status === 403)) {
    const refreshedAuthHeader = await refreshStoredAuthHeader();
    return requestBlobWithMeta(
      path,
      {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: refreshedAuthHeader
        }
      },
      false
    );
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new RequestJsonError(response.status, message || `资源下载失败 (${response.status})`);
  }

  const blob = await response.blob();
  return {
    blob,
    status: response.status,
    contentLength: Number(response.headers.get("content-length")) || blob.size || 0,
    contentType: response.headers.get("content-type") || blob.type || "",
    responseUrl: response.url || path
  };
}

export async function requestBlob(path: string, options: RequestInit = {}, retry = true): Promise<Blob> {
  return (await requestBlobWithMeta(path, options, retry)).blob;
}

export async function fetchSimulatorCourse(courseId: number): Promise<{ course: CourseRecord; actions: ActionRecord[] }> {
  const params = new URLSearchParams({
    courseId: String(courseId),
    courseDetail: "full",
    includeSchedules: "0",
    includeTemplates: "0"
  });
  const payload = await requestJson<MetaPayload>(`/api/meta?${params.toString()}`);
  const course = (payload.courses || []).find((item) => Number(item.id) === Number(courseId));
  if (!course) {
    throw new Error("课程不存在，或当前账号没有权限查看。");
  }
  return {
    course,
    actions: payload.actions || []
  };
}
