import { createHash, randomBytes } from "node:crypto";
import {
  state, persist, normalizePassword, userAllowsClient, publicUserInfo,
  cleanupExpiredSessions, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS
} from "./core.js";

export const BROWSER_CLIENTS = ["course-web", "admin-web", "coach-web", "ops-web"] as const;
export type BrowserClient = typeof BROWSER_CLIENTS[number];

/** Client identity is separate from the legacy account permission family. */
export function isBrowserClient(value: unknown): value is BrowserClient {
  return BROWSER_CLIENTS.includes(value as BrowserClient);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function allowed(user: any, client: BrowserClient) {
  if (!user || !userAllowsClient(user, client === "coach-web" ? client : "editor-web")) return false;
  if ((client === "admin-web" || client === "ops-web") && user.role !== "superadmin") return false;
  return user.role !== "venue" || Boolean(user.venueId);
}

/** Public identifiers are UI concurrency guards, never authentication credentials. */
function publicSession(session: any, user: any) {
  const { password, passwordPlain, passwordDigest, ...profile } = publicUserInfo(user) as Record<string, any>;
  return {
    ...profile, access_token: session.browserId, token_type: "Session", refresh_token: "cookie",
    issued_at: Date.now(), expires_at: Date.parse(session.expiresAt),
    expires_in: Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000))
  };
}

/** Create an independent browser session; replace only the cookie this browser already owns. */
export function loginBrowserSession(client: BrowserClient, username: string, password: string, previousToken = "") {
  cleanupExpiredSessions();
  const user = state.users.find((item: any) => item.username === String(username || "").trim());
  if (!user || user.passwordDigest !== normalizePassword(String(password || "").trim())) return null;
  if (!allowed(user, client)) return { denied: true };
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const session = {
    id: Math.max(0, ...state.authSessions.map((s: any) => Number(s.id) || 0)) + 1,
    kind: "browser", browserClient: client, client,
    browserId: randomBytes(16).toString("hex"), browserTokenHash: digest(token),
    userId: user.id, accessToken: randomBytes(32).toString("hex"), refreshToken: "",
    tokenType: "Bearer", createTime: new Date(now).toISOString(),
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString()
  };
  state.authSessions = state.authSessions.filter((s: any) =>
    !(s.kind === "browser" && s.browserClient === client && s.browserTokenHash === digest(previousToken)));
  state.authSessions.push(session);
  user.lastLoginTime = new Date(now).toISOString();
  persist();
  return { token, data: publicSession(session, user) };
}

/** Check revocation, absolute expiry, account access, and the shorter access lease. */
export function resolveBrowserSession(client: BrowserClient, token: string, refresh = false, inspect = false) {
  if (!token) return { error: "SESSION_EXPIRED" } as const;
  const session = state.authSessions.find((s: any) => s.kind === "browser" && s.browserClient === client && s.browserTokenHash === digest(token));
  if (!session || !(Date.parse(session.refreshExpiresAt) > Date.now())) return { error: "SESSION_EXPIRED" } as const;
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!allowed(user, client)) return { error: "SESSION_EXPIRED" } as const;
  if (refresh) {
    const expiresAt = Math.min(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000, Date.parse(session.refreshExpiresAt));
    // Concurrent refreshes are idempotent; avoid rewriting DB for a fresh lease.
    if (!(Date.parse(session.expiresAt) > Date.now()) || expiresAt - Date.parse(session.expiresAt) > 60_000) {
      session.expiresAt = new Date(expiresAt).toISOString();
      persist();
    }
  } else if (!inspect && !(Date.parse(session.expiresAt) > Date.now())) {
    return { error: "ACCESS_EXPIRED" } as const;
  }
  return { data: publicSession(session, user), accessToken: session.accessToken };
}

/** Logout revokes only the matching browser/client, including future refresh attempts. */
export function logoutBrowserSession(client: BrowserClient, token: string) {
  const before = state.authSessions.length;
  state.authSessions = state.authSessions.filter((s: any) =>
    !(s.kind === "browser" && s.browserClient === client && s.browserTokenHash === digest(token)));
  if (before !== state.authSessions.length) persist();
}
