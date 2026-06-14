import type { MediaRecord } from "../models/media.ts";
import { apiUrl } from "./apiBase.ts";

export async function uploadBinary(kind: "image" | "video", file: File): Promise<MediaRecord> {
  const endpoint = kind === "image" ? "/api/upload/image" : "/api/upload/video";
  const response = await fetch(apiUrl(`${endpoint}?filename=${encodeURIComponent(file.name)}`), {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });
  const payload = (await response.json().catch(() => null)) as { data?: MediaRecord; message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message || "上传失败");
  }

  return payload?.data as MediaRecord;
}
