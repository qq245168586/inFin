import { clearStoredAuthSession, refreshStoredAuthHeader, withStoredAuthHeader } from "./authSessionStorage.ts";

export async function fetchActionThumbnailBlob(actionId: number | string | null | undefined): Promise<Blob | null> {
  const normalizedActionId = String(actionId || "").trim();
  if (!normalizedActionId) {
    return null;
  }

  const endpoint = `/api/actions/${encodeURIComponent(normalizedActionId)}/thumbnail`;
  const response = await fetchThumbnailWithAuth(endpoint);
  if (response.ok) {
    return readThumbnailBlob(response);
  }

  if (response.status === 403) {
    const refreshedAuthHeader = await refreshStoredAuthHeader().catch(() => "");
    if (refreshedAuthHeader) {
      const retryResponse = await fetchThumbnailWithAuth(endpoint, refreshedAuthHeader);
      return retryResponse.ok ? readThumbnailBlob(retryResponse) : null;
    }
    clearStoredAuthSession();
  }

  return null;
}

function fetchThumbnailWithAuth(endpoint: string, authHeader = "") {
  return fetch(endpoint, {
    method: "GET",
    headers: withStoredAuthHeader({
      Accept: "image/jpeg",
      ...(authHeader ? { Authorization: authHeader } : {})
    })
  });
}

async function readThumbnailBlob(response: Response) {
  const blob = await response.blob().catch(() => null);
  return blob?.size ? blob : null;
}
