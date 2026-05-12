import type { AuthSession, AuthTokenPayload, LegacyEnvelope, UserProfile } from "../models/common";
import { requestJson } from "./apiClient";

export const AUTH_STORAGE_KEY = "infini-coach-web-auth";
export const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

async function fetchProfile(tokenType: string, accessToken: string) {
  return requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
    headers: {
      Authorization: `${tokenType} ${accessToken}`
    }
  });
}

export async function loginCoach(username: string, password: string): Promise<AuthSession> {
  const loginResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/login", {
    method: "POST",
    headers: {
      Authorization: LEGACY_BASIC_AUTH
    },
    body: JSON.stringify({
      username,
      password,
      grant_type: "password",
      client: "coach-web"
    })
  });
  const profileResponse = await fetchProfile(loginResponse.data.token_type, loginResponse.data.access_token);
  return {
    ...loginResponse.data,
    ...profileResponse.data
  };
}

export async function refreshCoachSession(refreshToken: string): Promise<AuthSession> {
  const refreshResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/refresh", {
    method: "POST",
    headers: {
      Authorization: LEGACY_BASIC_AUTH
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client: "coach-web"
    })
  });
  const profileResponse = await fetchProfile(refreshResponse.data.token_type, refreshResponse.data.access_token);
  return {
    ...refreshResponse.data,
    ...profileResponse.data
  };
}

