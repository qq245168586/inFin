const API_BASE_PATH = normalizeBasePath(import.meta.env.VITE_API_BASE_PATH ?? (import.meta.env.PROD ? "/infini" : ""));
const LEGACY_HOSTS = new Set(["8.130.65.113", "api.infintraining.work", "course.infintraining.work"]);

function normalizeBasePath(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function resolvePublicUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw === "/api" || raw.startsWith("/api/")) return `${API_BASE_PATH}${raw}`;
  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    if (!LEGACY_HOSTS.has(parsed.hostname) && parsed.hostname !== "114.215.185.184") return raw;
    if (!parsed.pathname.startsWith("/api/") && !parsed.pathname.startsWith("/media/")) return raw;
    return `${API_BASE_PATH}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw;
  }
}
