import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isBrowserClient, loginBrowserSession, logoutBrowserSession, resolveBrowserSession,
  type BrowserClient
} from "../../data/json-store/browser-session-store.js";
import { readJsonBody, sendJson } from "../../utils/http.js";

export function cookieName(client: BrowserClient) { return `infini-session-${client}`; }

/** Parse just the selected client's cookie, never infer identity from another client. */
export function browserCookie(request: IncomingMessage, client: BrowserClient) {
  return String(request.headers.cookie || "").split(";").map(s => s.trim())
    .find(s => s.startsWith(`${cookieName(client)}=`))?.slice(cookieName(client).length + 1) || "";
}

/** Cookies are same-origin only, including login CSRF; reverse proxy must preserve Host. */
export function sameOriginBrowserRequest(request: IncomingMessage) {
  if (request.headers["sec-fetch-site"] === "cross-site" || request.headers["sec-fetch-site"] === "same-site") return false;
  const source = request.headers.origin || request.headers.referer;
  if (!source || Array.isArray(source)) return false;
  try {
    const origin = new URL(source);
    const protocol = (request.socket as any).encrypted || request.headers["x-forwarded-proto"] === "https" ? "https:" : "http:";
    return origin.host === request.headers.host && origin.protocol === protocol;
  } catch { return false; }
}

/** Only loopback HTTP development may omit Secure. Production never uses JS-readable cookies. */
export function sessionCookie(request: IncomingMessage, client: BrowserClient, token: string, clear = false) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(request.headers.host || "");
  return `${cookieName(client)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 15 * 24 * 3600}${local && request.headers["x-forwarded-proto"] !== "https" ? "" : "; Secure"}`;
}

function fail(response: ServerResponse, status: number, code: string, message: string) {
  sendJson(response, status, { code, message });
}

/** All browser authentication runs before route handlers or writes; legacy/TV Bearer is untouched. */
export async function handleBrowserAuthentication(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
  const route = url.pathname.match(/^\/api\/browser-auth\/([^/]+)\/(login|refresh|logout)$/);
  const selected = request.headers["x-infini-client"] ||
    (url.pathname === "/api/ops/mqtt/stream" && request.method === "GET" ? url.searchParams.get("browserClient") : "");
  if (!route && !selected) return false;
  response.setHeader("Cache-Control", "no-store");
  const client = route?.[1] || selected;
  if (!isBrowserClient(client) || (route && (request.method !== "POST" || selected !== client))) {
    fail(response, 400, "INVALID_CLIENT", "Invalid browser client."); return true;
  }
  if (!sameOriginBrowserRequest(request)) {
    fail(response, 403, "CSRF_REJECTED", "Cross-origin session request rejected."); return true;
  }
  const token = browserCookie(request, client);
  if (route?.[2] === "login") {
    const body = await readJsonBody(request);
    const result = loginBrowserSession(client, body?.username, body?.password, token);
    if (!result || "denied" in result) {
      fail(response, 403, result ? "FORBIDDEN" : "INVALID_CREDENTIALS", result ? "当前账号不能登录这个端口。" : "用户名或密码错误。"); return true;
    }
    response.setHeader("Set-Cookie", sessionCookie(request, client, result.token));
    sendJson(response, 200, { data: result.data }); return true;
  }
  // Check public identity before refresh/logout as well, so a stale tab cannot revoke a new login.
  const resolved = resolveBrowserSession(client, token, false);
  const expected = String(request.headers["x-infini-session"] || "");
  const identity = "data" in resolved ? resolved : resolveBrowserSession(client, token, false, true);
  if (expected && "data" in identity && expected !== identity.data.access_token) {
    fail(response, 409, "SESSION_CHANGED", "Session changed; reload before retrying."); return true;
  }
  if (route?.[2] === "logout") {
    logoutBrowserSession(client, token);
    // Revocation is sufficient. A delayed deletion header could erase a newer login's cookie.
    sendJson(response, 200, { ok: true }); return true;
  }
  const result = route?.[2] === "refresh" ? resolveBrowserSession(client, token, true) : resolved;
  if ("error" in result) {
    fail(response, 401, result.error, "登录已失效，请重新登录。"); return true;
  }
  if (expected && expected !== result.data.access_token) {
    fail(response, 409, "SESSION_CHANGED", "Session changed; reload before retrying."); return true;
  }
  if (route) { sendJson(response, 200, { data: result.data }); return true; }
  request.headers.authorization = `Bearer ${result.accessToken}`;
  return false;
}
