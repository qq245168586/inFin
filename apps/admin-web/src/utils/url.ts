import { resolvePublicUrl } from "../config/runtime.ts";

export function withCacheToken(url: string, token?: string | number | null): string {
  if (!url) {
    return "";
  }

  if (!token) {
    return resolvePublicUrl(url);
  }

  const resolvedUrl = resolvePublicUrl(url);
  return `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(token))}`;
}
