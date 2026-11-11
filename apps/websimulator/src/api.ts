import { browserSession } from "./browserSession";
import type { ActionRecord, CourseRecord, MetaPayload } from "./types.ts";
import { resolvePublicUrl } from "./runtime.ts";
import { reportDiagnostic } from "./diagnostics.ts";

export class RequestJsonError extends Error {
  status: number;
  contentType = "";

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

export function hasStoredAuthSession(): boolean {
  return Boolean(browserSession.read());
}
async function requestJsonInternal<T>(path: string, options: RequestInit = {}, _retry = true): Promise<T> {
  return browserSession.requestJson<T>(path, options);
}

/** Report only terminal API errors, after the existing auth refresh/retry completes. */
export async function requestJson<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  try { return await requestJsonInternal<T>(path, options, retry); }
  catch (error) {
    reportDiagnostic("API_ERROR", error instanceof Error && "status" in error ? `HTTP_${error.status}` : "NETWORK_ERROR", error,
      { endpoint: resolvePublicUrl(path).split(/[?#]/)[0], method: options.method || "GET", component: "api",
        stage: "course_request", httpStatus: error instanceof Error && "status" in error ? Number(error.status) : 0 });
    throw error;
  }
}

export async function requestBlobWithMeta(path: string, options: RequestInit = {}, retry = true): Promise<RequestBlobResult> {
  const response = await browserSession.fetch(path, options);

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const error = new RequestJsonError(response.status, message || `资源下载失败 (${response.status})`);
    error.contentType = response.headers.get("content-type") || "";
    throw error;
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
    const error = new Error("课程不存在，或当前账号没有权限查看。");
    reportDiagnostic("API_ERROR", "COURSE_UNAVAILABLE", error, { courseId, stage: "resolve_course", component: "api" });
    throw error;
  }
  return {
    course,
    actions: payload.actions || []
  };
}
