import { refreshWithToken, type AuthSession } from "./api/auth.ts";
import { readStorageJson, removeStorageItem, saveStorageJson } from "../utils/storage.ts";

const AUTH_STORAGE_KEY = "infini-admin-auth";

function enrichSession(session: AuthSession): AuthSession {
  const issuedAt = Date.now();
  return {
    ...session,
    issued_at: issuedAt,
    expires_at: issuedAt + Math.max(0, Number(session.expires_in) || 0) * 1000
  };
}

export function readStoredAuthSession(): AuthSession | null {
  return readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
}

export function clearStoredAuthSession() {
  removeStorageItem(AUTH_STORAGE_KEY);
}

export function saveStoredAuthSession(session: AuthSession) {
  saveStorageJson(AUTH_STORAGE_KEY, session);
}

export function getStoredAuthHeader(): string {
  const session = readStoredAuthSession();
  if (!session?.access_token) return "";
  return `${session.token_type || "Bearer"} ${session.access_token}`;
}

export function withStoredAuthHeader(headers: HeadersInit = {}): HeadersInit {
  const mergedHeaders = { ...(headers as Record<string, string>) };
  if (!mergedHeaders.Authorization) {
    const storedAuthHeader = getStoredAuthHeader();
    if (storedAuthHeader) {
      mergedHeaders.Authorization = storedAuthHeader;
    }
  }
  return mergedHeaders;
}

export async function refreshStoredAuthHeader(): Promise<string> {
  const current = readStoredAuthSession();
  if (!current?.refresh_token) return "";

  const token = await refreshWithToken(current.refresh_token);
  const nextSession = enrichSession({ ...current, ...token });
  saveStoredAuthSession(nextSession);
  return `${nextSession.token_type || "Bearer"} ${nextSession.access_token}`;
}
