import { requestJson } from "../../services/requestJson.ts";
import type {
  AppPackageListPayload,
  AppPackageRecord,
  ConsoleUser,
  CoursePackageRecord,
  TvInstallAppUpdateCommand,
  TvScreensPayload,
  VenueCoursePackagesPayload,
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

export async function fetchCoursePackages(authHeader: string, signal?: AbortSignal): Promise<CoursePackageRecord[]> {
  const payload = await requestJson<{ data: CoursePackageRecord[] }>("/api/admin/course-packages", {
    headers: { Authorization: authHeader },
    signal
  });
  return payload.data || [];
}

export async function saveCoursePackage(
  authHeader: string,
  packageDraft: Partial<CoursePackageRecord>
): Promise<CoursePackageRecord> {
  const endpoint = packageDraft.id
    ? `/api/admin/course-packages/${encodeURIComponent(String(packageDraft.id))}`
    : "/api/admin/course-packages";
  const payload = await requestJson<{ data: CoursePackageRecord }>(endpoint, {
    method: packageDraft.id ? "PATCH" : "POST",
    headers: { Authorization: authHeader },
    body: JSON.stringify(packageDraft)
  });
  return payload.data;
}

export async function deleteCoursePackage(authHeader: string, coursePackageId: number): Promise<void> {
  await requestJson<void>(`/api/admin/course-packages/${encodeURIComponent(String(coursePackageId))}`, {
    method: "DELETE",
    headers: { Authorization: authHeader }
  });
}

export async function fetchVenueCoursePackages(
  authHeader: string,
  venueId: string,
  signal?: AbortSignal
): Promise<VenueCoursePackagesPayload | null> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload }>(
    `/api/admin/venues/${encodeURIComponent(venueId)}/course-packages`,
    { headers: { Authorization: authHeader }, signal }
  );
  return payload.data || null;
}

export async function bindCoursePackageToVenue(
  authHeader: string,
  venueId: string,
  coursePackageId: number
): Promise<VenueCoursePackagesPayload> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload }>(
    `/api/admin/venues/${encodeURIComponent(venueId)}/course-packages`,
    {
      method: "POST",
      headers: { Authorization: authHeader },
      body: JSON.stringify({ coursePackageId })
    }
  );
  return payload.data;
}

export async function unbindCoursePackageFromVenue(
  authHeader: string,
  venueId: string,
  coursePackageId: number
): Promise<VenueCoursePackagesPayload> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload }>(
    `/api/admin/venues/${encodeURIComponent(venueId)}/course-packages/${encodeURIComponent(String(coursePackageId))}`,
    {
      method: "DELETE",
      headers: { Authorization: authHeader }
    }
  );
  return payload.data;
}

export async function setVenueActiveCoursePackage(
  authHeader: string,
  venueId: string,
  coursePackageId: number
): Promise<VenueCoursePackagesPayload> {
  const payload = await requestJson<{ data: VenueCoursePackagesPayload }>(
    `/api/admin/venues/${encodeURIComponent(venueId)}/active-course-package`,
    {
      method: "POST",
      headers: { Authorization: authHeader },
      body: JSON.stringify({ coursePackageId })
    }
  );
  return payload.data;
}

export async function setUserCoursePackages(authHeader: string, userId: number, coursePackageIds: number[]): Promise<ConsoleUser> {
  const payload = await requestJson<{ data: ConsoleUser }>(`/api/admin/users/${encodeURIComponent(String(userId))}/course-packages`, {
    method: "PUT",
    headers: { Authorization: authHeader },
    body: JSON.stringify({ coursePackageIds })
  });
  return payload.data;
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
