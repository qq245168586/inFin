import type { MediaRecord } from "../models/media.ts";
import { resolvePublicUrl } from "../config/runtime.ts";
import { clearStoredAuthSession, refreshStoredAuthHeader, withStoredAuthHeader } from "./authSessionStorage.ts";

export async function uploadBinary(kind: "image" | "video", file: File): Promise<MediaRecord> {
  const endpoint = kind === "image" ? "/api/upload/image" : "/api/upload/video";
  const response = await uploadWithAuth(endpoint, file);
  const payload = (await response.json().catch(() => null)) as { data?: MediaRecord; message?: string } | null;

  if (!response.ok && response.status === 403 && String(payload?.message || "").includes("登录已失效")) {
    const refreshedAuthHeader = await refreshStoredAuthHeader().catch(() => "");
    if (refreshedAuthHeader) {
      const retryResponse = await uploadWithAuth(endpoint, file, refreshedAuthHeader);
      const retryPayload = (await retryResponse.json().catch(() => null)) as { data?: MediaRecord; message?: string } | null;
      if (!retryResponse.ok) {
        throw new Error(retryPayload?.message || "上传失败");
      }
      return retryPayload?.data as MediaRecord;
    }
    clearStoredAuthSession();
  }

  if (!response.ok) {
    throw new Error(payload?.message || "上传失败");
  }

  return payload?.data as MediaRecord;
}

function uploadWithAuth(endpoint: string, file: File, authHeader = "") {
  return fetch(resolvePublicUrl(`${endpoint}?filename=${encodeURIComponent(file.name)}`), {
    method: "POST",
    headers: withStoredAuthHeader({
      "Content-Type": file.type || "application/octet-stream",
      ...(authHeader ? { Authorization: authHeader } : {})
    }),
    body: file
  });
}
