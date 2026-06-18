import { clearStoredAuthSession, refreshStoredAuthHeader, withStoredAuthHeader } from "./authSessionStorage.ts";

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(path, options);
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok && shouldRefreshAuth(response.status, payload)) {
    const refreshedAuthHeader = await refreshStoredAuthHeader().catch(() => "");
    if (refreshedAuthHeader) {
      const retryResponse = await fetchWithAuth(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: refreshedAuthHeader
        }
      });
      const retryPayload = (await retryResponse.json().catch(() => null)) as T | { message?: string } | null;
      if (retryResponse.ok) {
        return retryPayload as T;
      }
      handleErrorResponse(retryResponse.status, retryPayload);
    } else {
      clearStoredAuthSession();
    }
  }

  if (!response.ok) {
    handleErrorResponse(response.status, payload);
  }

  return payload as T;
}

function fetchWithAuth(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: withStoredAuthHeader({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    })
  });
}

function shouldRefreshAuth(status: number, payload: { message?: string } | null) {
  const message = String(payload?.message || "");
  return (status === 401 || status === 403) && message.includes("登录已失效");
}

function handleErrorResponse(status: number, payload: { message?: string } | null): never {
  const message = payload?.message || `请求失败 (${status})`;
  const shouldExpire =
    (status === 401 || status === 403) &&
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
