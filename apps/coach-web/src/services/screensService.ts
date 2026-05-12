import type { AuthSession } from "../models/common";
import type { AppPackageEnvelope, TvScreenMutationPayload, TvScreensPayload } from "../models/screens";
import { authHeaders, requestJson } from "./apiClient";

export function fetchScreens(authSession: AuthSession) {
  return requestJson<TvScreensPayload>("/api/tv/screens", {
    headers: authHeaders(authSession.token_type, authSession.access_token)
  });
}

export async function fetchTvPackages(authSession: AuthSession) {
  const response = await requestJson<AppPackageEnvelope>("/api/app-packages?platform=tv", {
    headers: authHeaders(authSession.token_type, authSession.access_token)
  });
  return response.data;
}

export function bindTvScreen(authSession: AuthSession, body: { deviceId: string; pairToken: string; screenNumber: number }) {
  return requestJson<TvScreenMutationPayload>("/api/tv/screens/pair-bind", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify(body)
  });
}

export function unbindTvScreen(authSession: AuthSession, deviceId: string) {
  return requestJson<TvScreenMutationPayload>("/api/tv/screens/unbind", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({ deviceId })
  });
}

export function clearTvCache(authSession: AuthSession, deviceId: string) {
  return requestJson<TvScreenMutationPayload>("/api/tv/screens/clear-cache", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({ deviceId })
  });
}

export function installTvPackage(authSession: AuthSession, deviceId: string, packageId: number) {
  return requestJson<TvScreenMutationPayload>("/api/tv/screens/install-package", {
    method: "POST",
    headers: authHeaders(authSession.token_type, authSession.access_token),
    body: JSON.stringify({ deviceId, packageId })
  });
}

