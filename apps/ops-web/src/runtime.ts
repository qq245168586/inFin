const API_BASE_PATH = normalizeBasePath(import.meta.env.VITE_API_BASE_PATH ?? (import.meta.env.PROD ? "/infini" : ""));

function normalizeBasePath(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function resolveApiUrl(value: string): string {
  const raw = String(value || "").trim();
  if (raw === "/api" || raw.startsWith("/api/")) return `${API_BASE_PATH}${raw}`;
  return raw;
}
