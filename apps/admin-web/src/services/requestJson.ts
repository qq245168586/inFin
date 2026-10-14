import { resolvePublicUrl } from "../config/runtime.ts";

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolvePublicUrl(path), {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message || `请求失败 (${response.status})`;
    const shouldExpire =
      (response.status === 401 || response.status === 403) &&
      (String(message || "").includes("登录已失效") || String(message || "").includes("refresh token 已失效"));
    if (shouldExpire) {
      try {
        window.dispatchEvent(new CustomEvent("infini-auth-expired", { detail: { message } }));
      } catch {
        // Ignore dispatch failures.
      }
    }
    throw new Error(message);
  }

  return payload as T;
}
