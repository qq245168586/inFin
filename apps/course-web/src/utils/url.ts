export function withCacheToken(url: string, token?: string | number | null): string {
  if (!url) {
    return "";
  }

  if (!token) {
    return url;
  }

  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes("signature=") ||
    lowerUrl.includes("ossaccesskeyid=") ||
    lowerUrl.includes("x-oss-") ||
    lowerUrl.includes("x-amz-signature=") ||
    lowerUrl.includes("x-amz-credential=")
  ) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(token))}`;
}
