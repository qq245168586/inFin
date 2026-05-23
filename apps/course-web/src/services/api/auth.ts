import { requestJson } from "../requestJson.ts";

interface LegacyEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
}

export interface AuthTokenPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  issued_at?: number;
  expires_at?: number;
}

export interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
}

export type AuthSession = AuthTokenPayload & Partial<UserProfile>;

const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

export async function loginWithPassword(username: string, password: string): Promise<AuthTokenPayload> {
  const response = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/login", {
    method: "POST",
    headers: {
      Authorization: LEGACY_BASIC_AUTH
    },
    body: JSON.stringify({
      username,
      password,
      grant_type: "password",
      client: "editor-web"
    })
  });
  return response.data;
}

export async function refreshWithToken(refreshToken: string): Promise<AuthTokenPayload> {
  const response = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/refresh", {
    method: "POST",
    headers: {
      Authorization: LEGACY_BASIC_AUTH
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client: "editor-web"
    })
  });
  return response.data;
}

export async function fetchProfile(tokenType: string, accessToken: string): Promise<Partial<UserProfile>> {
  const response = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
    headers: {
      Authorization: `${tokenType} ${accessToken}`
    }
  });
  return response.data || {};
}
