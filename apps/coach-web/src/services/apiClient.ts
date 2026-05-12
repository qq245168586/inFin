export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string; msg?: string } | null;

  if (!response.ok) {
    const error = new Error(
      (payload as { message?: string; msg?: string } | null)?.message ||
        (payload as { msg?: string } | null)?.msg ||
        `请求失败 (${response.status})`
    ) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

export function authHeaders(tokenType: string, accessToken: string): Record<string, string> {
  return {
    Authorization: `${tokenType} ${accessToken}`
  };
}

