import { requestJson } from "../../services/requestJson.ts";
import type {
  AppPackageListPayload,
  AppPackageRecord,
  ConsoleUser,
  TvInstallAppUpdateCommand,
  TvScreensPayload,
  VenueRecord
} from "./types.ts";

function normalizeAccountNamespace(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export async function fetchVenues(authHeader: string, signal?: AbortSignal): Promise<VenueRecord[]> {
  const payload = await requestJson<{ data: VenueRecord[] }>("/api/admin/venues", {
    headers: { Authorization: authHeader },
    signal
  });
  return payload.data || [];
}

export async function fetchAllUsers(authHeader: string, signal?: AbortSignal): Promise<ConsoleUser[]> {
  const payload = await requestJson<{ data: ConsoleUser[] }>("/api/admin/users", {
    headers: { Authorization: authHeader },
    signal
  });
  return payload.data || [];
}

export async function fetchVenueUsers(authHeader: string, venueId: string, signal?: AbortSignal): Promise<ConsoleUser[]> {
  const payload = await requestJson<{ data: ConsoleUser[] }>(`/api/admin/venues/${encodeURIComponent(venueId)}/users`, {
    headers: { Authorization: authHeader },
    signal
  });
  return payload.data || [];
}

export async function fetchVenueScreens(
  authHeader: string,
  venueId: string,
  signal?: AbortSignal
): Promise<TvScreensPayload | null> {
  const payload = await requestJson<{ data: TvScreensPayload }>(`/api/admin/venues/${encodeURIComponent(venueId)}/screens`, {
    headers: { Authorization: authHeader },
    signal
  });
  return payload.data || null;
}

export async function fetchTvPackages(authHeader: string): Promise<AppPackageRecord[]> {
  const payload = await requestJson<{ data: AppPackageListPayload }>("/api/app-packages?platform=tv", {
    headers: { Authorization: authHeader }
  });
  return payload.data?.packages || [];
}

export async function createVenue(authHeader: string, name: string): Promise<VenueRecord> {
  const payload = await requestJson<{ data: VenueRecord }>("/api/admin/venues", {
    method: "POST",
    headers: { Authorization: authHeader },
    body: JSON.stringify({ name })
  });
  return payload.data;
}

export async function createConsoleUser(
  authHeader: string,
  username: string,
  password: string
): Promise<ConsoleUser> {
  const payload = await requestJson<{ data: ConsoleUser }>("/api/admin/users", {
    method: "POST",
    headers: { Authorization: authHeader },
    body: JSON.stringify({ username, password })
  });
  return payload.data;
}

export async function fetchUnboundUsers(authHeader: string, query: string): Promise<ConsoleUser[]> {
  const payload = await requestJson<{ data: ConsoleUser[] }>(
    `/api/admin/users?unbound=1&q=${encodeURIComponent(query || "")}`,
    { headers: { Authorization: authHeader } }
  );
  return payload.data || [];
}

export async function bindUserToVenue(authHeader: string, venueId: string, userId: number): Promise<void> {
  await requestJson<{ data: ConsoleUser }>(`/api/admin/venues/${encodeURIComponent(venueId)}/bind-user`, {
    method: "POST",
    headers: { Authorization: authHeader },
    body: JSON.stringify({ userId })
  });
}

export async function unbindUser(authHeader: string, userId: number): Promise<void> {
  await requestJson<{ data: ConsoleUser }>(`/api/admin/users/${encodeURIComponent(String(userId))}/unbind`, {
    method: "POST",
    headers: { Authorization: authHeader }
  });
}

export async function deleteVenue(authHeader: string, venueId: string): Promise<void> {
  await requestJson<void>(`/api/admin/venues/${encodeURIComponent(venueId)}`, {
    method: "DELETE",
    headers: { Authorization: authHeader }
  });
}

export async function publishAdminTvCommand(
  authHeader: string,
  accountNamespace: string,
  payload: TvInstallAppUpdateCommand
): Promise<{ topic: string; payload: TvInstallAppUpdateCommand }> {
  const response = await requestJson<{ data: { topic: string; payload: TvInstallAppUpdateCommand } }>("/api/admin/tv-control", {
    method: "POST",
    headers: { Authorization: authHeader },
    body: JSON.stringify({
      accountNamespace: normalizeAccountNamespace(accountNamespace),
      payload
    })
  });
  return response.data;
}
