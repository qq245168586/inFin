const resourceKeys = new Set(["url", "src", "mediaUrl", "videoUrl", "imageUrl", "thumbnailUrl", "downloadPath", "downloadUrl", "logoPreview"]);
const legacyHosts = new Set(["8.130.65.113", "api.infintraining.work", "course.infintraining.work", "admin.infintraining.work", "coach.infintraining.work", "download.infintraining.work"]);

/** Maps stored resource addresses at the transport boundary without changing DB records. */
export function publicResourceUrl(value: string, base = process.env.INFINI_PUBLIC_BASE_URL || ""): string {
  if (!base) return value;
  let resource = value;
  try {
    const target = new URL(base);
    if (/^https?:\/\//i.test(resource)) {
      const source = new URL(resource);
      if (!legacyHosts.has(source.hostname) && source.hostname !== target.hostname) return value;
      resource = source.pathname + source.search + source.hash;
    }
  } catch {
    return value;
  }
  if (!resource.startsWith("/api/") && !resource.startsWith("/media/")) return value;
  return base.replace(/\/+$/, "") + resource;
}

/** Applies URL mapping only to known resource fields, never free text or signed OSS URLs. */
export function publicResourceReplacer(key: string, value: unknown): unknown {
  return resourceKeys.has(key) && typeof value === "string" ? publicResourceUrl(value) : value;
}
