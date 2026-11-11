export interface BrowserSession {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  issued_at?: number;
  [key: string]: any;
}

export class BrowserRequestError extends Error {
  constructor(public status: number, message: string, public code = "", public payload?: unknown) {
    super(message);
    this.name = "BrowserRequestError";
  }
}

export function isSessionExpired(error: unknown) {
  return error instanceof BrowserRequestError && error.status === 401 && error.code === "SESSION_EXPIRED";
}

/** Framework-independent cookie auth shared by all web apps; no credentials in JS storage. */
export function createBrowserSessionClient(client: string, storageKey: string, resolve: (path: string) => string, legacyStorageKey?: string) {
  let refreshing: Promise<BrowserSession> | null = null;
  const eventName = `infini-session:${client}`;
  const revisionKey = `${storageKey}:revision`;

  function read(): BrowserSession | null {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      return value?.token_type === "Session" ? value : null;
    } catch { return null; }
  }
  function revision() { return window.localStorage.getItem(revisionKey) || ""; }
  function publish(session: BrowserSession | null) {
    window.localStorage.setItem(revisionKey, `${Date.now()}-${Math.random()}`);
    if (session) window.localStorage.setItem(storageKey, JSON.stringify(session));
    else window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(eventName));
  }
  function subscribe(listener: (session: BrowserSession | null) => void) {
    const local = () => listener(read());
    const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) local(); };
    window.addEventListener(eventName, local);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(eventName, local); window.removeEventListener("storage", storage); };
  }
  async function body(response: Response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new BrowserRequestError(response.status, payload?.message || payload?.msg || `Request failed (${response.status})`, String(payload?.code || ""), payload);
    return payload;
  }
  function headers(options: RequestInit, session: BrowserSession | null) {
    const result = new Headers(options.headers);
    result.delete("Authorization");
    result.set("X-Infini-Client", client);
    if (session) result.set("X-Infini-Session", session.access_token);
    return result;
  }
  async function raw(path: string, options: RequestInit = {}, session = read()) {
    const target = resolve(path);
    const url = new URL(target, window.location.href);
    if (url.origin !== window.location.origin || !/(^|\/)api\//.test(url.pathname)) {
      // Never send cookies, auth headers or identity to OSS/external resources.
      const clean = new Headers(options.headers);
      clean.delete("Authorization"); clean.delete("X-Infini-Client"); clean.delete("X-Infini-Session");
      return fetch(target, { ...options, headers: clean, credentials: "omit" });
    }
    return fetch(target, { ...options, headers: headers(options, session), credentials: "same-origin" });
  }
  async function auth(action: string, payload = {}, session = read()) {
    const result = await body(await raw(`/api/browser-auth/${client}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000)
    }, session));
    if (action !== "logout" && (!result?.data?.access_token || result.data.token_type !== "Session")) {
      throw new BrowserRequestError(502, "Invalid session response; try again later.", "INVALID_RESPONSE");
    }
    return result;
  }
  function refresh(): Promise<BrowserSession> {
    if (!refreshing) {
      const before = revision();
      const previous = read();
      refreshing = (async () => {
        try {
          const { data } = await auth("refresh", {}, previous);
          // A logout or another login must win over an older in-flight response.
          if (revision() !== before) {
            const current = read();
            if (current && current.access_token === data.access_token) return current;
            throw new BrowserRequestError(409, "Session changed; reload before retrying.", "SESSION_CHANGED");
          }
          publish(data);
          return data as BrowserSession;
        } catch (error) {
          if (isSessionExpired(error) && revision() === before) publish(null);
          throw error;
        }
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  async function restore() {
    if (legacyStorageKey) window.localStorage.removeItem(legacyStorageKey);
    // Discard legacy tokens on upgrade; the new cookie must be established by a fresh login.
    if (!read() && window.localStorage.getItem(storageKey)) window.localStorage.removeItem(storageKey);
    try { return await refresh(); }
    catch (error) {
      if (isSessionExpired(error)) return null;
      const cached = read();
      if (cached) return cached; // UI can remain open through network/service interruptions.
      throw error;
    }
  }
  async function login(username: string, password: string) {
    const { data } = await auth("login", { username, password }, null);
    publish(data);
    return data as BrowserSession;
  }
  async function logout() {
    const previous = read();
    await auth("logout", {}, previous); // Do not claim success while the server session is still valid.
    if (read()?.access_token === previous?.access_token) publish(null);
  }
  async function fetchAuthenticated(path: string, options: RequestInit = {}) {
    const previous = read();
    const before = revision();
    const supplied = new Headers(options.headers).get("Authorization") || "";
    if (supplied.startsWith("Session ") && supplied.slice(8) !== previous?.access_token) {
      throw new BrowserRequestError(409, "Session changed; reload before retrying.", "SESSION_CHANGED");
    }
    let response = await raw(path, options, previous);
    if (revision() !== before && read()?.access_token !== previous?.access_token) {
      throw new BrowserRequestError(409, "Session changed; reload before retrying.", "SESSION_CHANGED");
    }
    if (response.status !== 401) return response;
    const payload = await response.clone().json().catch(() => null);
    if (payload?.code === "ACCESS_EXPIRED") {
      const current = await refresh();
      if (previous && current.access_token !== previous.access_token) {
        throw new BrowserRequestError(409, "Session changed; reload before retrying.", "SESSION_CHANGED");
      }
      // Only explicit pre-handler auth failure is retried. Never retry network/5xx writes.
      response = await raw(path, options, current);
    }
    if (response.status === 401) {
      const final = await response.clone().json().catch(() => null);
      if (final?.code === "SESSION_EXPIRED") {
        if (read()?.access_token !== previous?.access_token) {
          throw new BrowserRequestError(409, "Session changed; reload before retrying.", "SESSION_CHANGED");
        }
        publish(null);
      }
    }
    return response;
  }
  async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const requestHeaders = new Headers(options.headers);
    if (options.body && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
    return body(await fetchAuthenticated(path, { ...options, headers: requestHeaders }));
  }
  return { read, subscribe, refresh, restore, login, logout, fetch: fetchAuthenticated, requestJson };
}
