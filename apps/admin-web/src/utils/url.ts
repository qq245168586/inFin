export function withCacheToken(url: string, token?: string | number | null): string {
  if (!url) {
    return "";
  }

  if (!token) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(token))}`;
}
