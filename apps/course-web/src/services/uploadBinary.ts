import type { MediaRecord } from "../models/media.ts";
import { browserSession } from "./browserSession";

export async function uploadBinary(kind: "image" | "video", file: File): Promise<MediaRecord> {
  const endpoint = kind === "image" ? "/api/upload/image" : "/api/upload/video";
  return (await browserSession.requestJson<{ data: MediaRecord }>(`${endpoint}?filename=${encodeURIComponent(file.name)}`, {
    method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file
  })).data;
}
