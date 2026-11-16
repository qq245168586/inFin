import { resolvePublicUrl } from "../config/runtime.ts";

export function withCacheToken(url: string, token?: string | number | null): string {
  if (!url) {
    return "";
  }

  if (!token) {
    return resolvePublicUrl(url);
  }

  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes("signature=") ||
    lowerUrl.includes("ossaccesskeyid=") ||
    lowerUrl.includes("x-oss-") ||
    lowerUrl.includes("x-amz-signature=") ||
    lowerUrl.includes("x-amz-credential=")
  ) {
    return resolvePublicUrl(url);
  }

  const resolvedUrl = resolvePublicUrl(url);
  return `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(token))}`;
}
