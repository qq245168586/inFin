import { browserSession } from "./browserSession";

export async function fetchActionThumbnailBlob(actionId: number | string | null | undefined): Promise<Blob | null> {
  if (!actionId) return null;
  const response = await browserSession.fetch(`/api/actions/${encodeURIComponent(String(actionId))}/thumbnail`, { headers: { Accept: "image/jpeg" } });
  if (!response.ok) return null;
  const blob = await response.blob();
  return blob.size ? blob : null;
}
