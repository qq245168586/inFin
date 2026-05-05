import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NoticeTone = "success" | "error";

interface LegacyEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
}

interface AuthTokenPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserProfile {
  id: number;
  username: string;
  nickname: string;
  accountNamespace: string;
  role?: string;
}

interface AuthSession extends AuthTokenPayload, UserProfile {}

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

interface OpsEvent {
  id: string;
  receivedAt: string;
  topic: string;
  direction: "in" | "out";
  deviceId: string;
  namespace: string;
  type: string;
  payload: unknown;
}

const AUTH_STORAGE_KEY = "infini-ops-web-auth";
const LEGACY_BASIC_AUTH = "Basic REDACTED_CONFIGURE_LOCALLY";

function readStorageJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveStorageJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageItem(key: string) {
  window.localStorage.removeItem(key);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string; msg?: string } | null;

  if (!response.ok) {
    throw new Error(
      (payload as { message?: string; msg?: string } | null)?.message
        || (payload as { msg?: string } | null)?.msg
        || `请求失败 (${response.status})`
    );
  }

  return payload as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败，请稍后重试。";
}

function isAuthExpiredMessage(message: string): boolean {
  return /登录已失效|重新登录|refresh token 已失效|用户名或密码错误/i.test(String(message || ""));
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export default function OpsWebApp() {
  const noticeTimerRef = useRef<number | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [busyText, setBusyText] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginUsername, setLoginUsername] = useState("13689547720");
  const [loginPassword, setLoginPassword] = useState("REDACTED_CONFIGURE_LOCALLY");

  const [namespace, setNamespace] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [topicContains, setTopicContains] = useState("");
  const [typeContains, setTypeContains] = useState("");
  const [limit, setLimit] = useState(200);

  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  const authHeader = useMemo(() => {
    if (!authSession) return "";
    return `${authSession.token_type} ${authSession.access_token}`;
  }, [authSession]);

  const pushNotice = useCallback((message: string, tone: NoticeTone = "success") => {
    setNotice({ message, tone });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const handleSessionExpired = useCallback((message = "登录已失效，请重新登录。") => {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    setEvents([]);
    setBusyText("");
    pushNotice(message, "error");
  }, [pushNotice]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedAuth = readStorageJson<AuthSession>(AUTH_STORAGE_KEY);
      if (!storedAuth?.refresh_token) {
        setAuthReady(true);
        return;
      }

      setBusyText("正在恢复登录...");

      try {
        const refreshResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/refresh", {
          method: "POST",
          headers: {
            Authorization: LEGACY_BASIC_AUTH
          },
          body: JSON.stringify({
            refresh_token: storedAuth.refresh_token,
            client: "ops-web"
          })
        });

        const profileResponse = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
          headers: {
            Authorization: `${refreshResponse.data.token_type} ${refreshResponse.data.access_token}`
          }
        });

        if (cancelled) {
          return;
        }

        const nextAuth = {
          ...refreshResponse.data,
          ...profileResponse.data
        };

        setAuthSession(nextAuth);
        setLoginUsername(nextAuth.username || "");
      } catch {
        if (!cancelled) {
          removeStorageItem(AUTH_STORAGE_KEY);
          setAuthSession(null);
        }
      } finally {
        if (!cancelled) {
          setBusyText("");
          setAuthReady(true);
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    setBusyText("正在登录...");
    try {
      const loginResponse = await requestJson<LegacyEnvelope<AuthTokenPayload>>("/api/app/login", {
        method: "POST",
        headers: {
          Authorization: LEGACY_BASIC_AUTH
        },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
          client: "ops-web"
        })
      });

      const profileResponse = await requestJson<LegacyEnvelope<UserProfile>>("/api/user/info", {
        headers: {
          Authorization: `${loginResponse.data.token_type} ${loginResponse.data.access_token}`
        }
      });

      const nextAuth = {
        ...loginResponse.data,
        ...profileResponse.data
      };

      saveStorageJson(AUTH_STORAGE_KEY, nextAuth);
      setAuthSession(nextAuth);
      pushNotice("登录成功。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  function handleLogout() {
    removeStorageItem(AUTH_STORAGE_KEY);
    setAuthSession(null);
    stopStream();
    setEvents([]);
    pushNotice("已退出登录。");
  }

  async function fetchRecentEvents() {
    if (!authSession) return;
    setBusyText("正在加载日志...");
    try {
      const params = new URLSearchParams();
      if (namespace.trim()) params.set("namespace", namespace.trim());
      if (deviceId.trim()) params.set("deviceId", deviceId.trim());
      if (topicContains.trim()) params.set("topic", topicContains.trim());
      if (typeContains.trim()) params.set("type", typeContains.trim());
      params.set("limit", String(Math.max(10, Math.min(limit || 200, 2000))));

      const payload = await requestJson<{ data: { items: OpsEvent[] } }>(`/api/ops/mqtt/events?${params.toString()}`, {
        headers: {
          Authorization: authHeader
        }
      });
      setEvents(payload.data.items || []);
      pushNotice("已加载。");
    } catch (error) {
      const message = getErrorMessage(error);
      if (isAuthExpiredMessage(message)) {
        handleSessionExpired(message);
        return;
      }
      pushNotice(message, "error");
    } finally {
      setBusyText("");
    }
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setStreaming(false);
  }

  function startStream() {
    if (!authSession) return;
    stopStream();
    setEvents([]);

    const params = new URLSearchParams();
    if (namespace.trim()) params.set("namespace", namespace.trim());
    if (deviceId.trim()) params.set("deviceId", deviceId.trim());
    if (topicContains.trim()) params.set("topic", topicContains.trim());
    if (typeContains.trim()) params.set("type", typeContains.trim());
    params.set("limit", String(Math.max(10, Math.min(limit || 200, 2000))));

    // NOTE: EventSource cannot send Authorization header. We pass access token as query for ops-only usage.
    params.set("accessToken", authSession.access_token);
    params.set("tokenType", authSession.token_type);

    const source = new EventSource(`/api/ops/mqtt/stream?${params.toString()}`);
    streamRef.current = source;
    setStreaming(true);

    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as OpsEvent;
        setEvents((current) => {
          const merged = [next, ...current];
          return merged.slice(0, Math.max(10, Math.min(limit || 200, 2000)));
        });
      } catch {
        // ignore
      }
    };

    source.onerror = () => {
      // Browser will retry automatically; keep the UI stable.
      setStreaming(true);
    };
  }

  useEffect(() => {
    return () => stopStream();
  }, []);

  if (!authReady) {
    return (
      <div className="ops-shell">
        <div className="ops-card">
          <div className="ops-topbar">
            <div className="ops-title">INFini Ops Console</div>
            <div className="ops-subtitle">正在加载...</div>
          </div>
          <div className="ops-body">
            <div className="ops-panel ops-mono">正在初始化会话...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="ops-shell">
        <div className="ops-card">
          <div className="ops-topbar">
            <div className="ops-title">Infini Ops Console</div>
            <div className="ops-subtitle">独立调试后台，用于查看 MQTT 指令与 TV 端事件流。</div>
          </div>
          <div className="ops-body">
            <div className="ops-panel">
              <div className="ops-row">
                <div className="ops-field">
                  <label>账号</label>
                  <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} inputMode="text" />
                </div>
                <div className="ops-field">
                  <label>密码</label>
                  <input
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    type={passwordVisible ? "text" : "password"}
                  />
                </div>
              </div>
              <div className="ops-actions">
                <button className="ops-btn primary" onClick={handleLogin} disabled={Boolean(busyText)}>
                  登录
                </button>
                <button className="ops-btn" onClick={() => setPasswordVisible((v) => !v)} disabled={Boolean(busyText)}>
                  {passwordVisible ? "隐藏密码" : "显示密码"}
                </button>
              </div>
              {busyText ? <div className="ops-subtitle" style={{ marginTop: 10 }}>{busyText}</div> : null}
            </div>
            {notice ? (
              <div className={`ops-panel ops-mono ${notice.tone === "error" ? "ops-pill err" : ""}`}>{notice.message}</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-shell">
      <div className="ops-card">
        <div className="ops-topbar">
          <div className="ops-title">Infini Ops Console</div>
          <div className="ops-subtitle">
            登录账号：{authSession.username}（{authSession.role || "unknown"}） | 仅用于排查 MQTT 指令下发与 TV 同步问题
          </div>
        </div>

        <div className="ops-body">
          <div className="ops-panel">
            <div className="ops-row">
              <div className="ops-field">
                <label>命名空间（namespace / 场馆）</label>
                <input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="例如：zhiyou 或 venue-xxxx" />
              </div>
              <div className="ops-field">
                <label>设备 ID</label>
                <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="例如：TV-ABCDEF12" />
              </div>
            </div>
            <div className="ops-row" style={{ marginTop: 10 }}>
              <div className="ops-field">
                <label>Topic 包含</label>
                <input value={topicContains} onChange={(e) => setTopicContains(e.target.value)} placeholder="例如：control 或 pairing" />
              </div>
              <div className="ops-field">
                <label>Type 包含</label>
                <input value={typeContains} onChange={(e) => setTypeContains(e.target.value)} placeholder="例如：start_course / ack / heartbeat" />
              </div>
            </div>
            <div className="ops-actions">
              <button className="ops-btn" onClick={fetchRecentEvents} disabled={Boolean(busyText)}>
                拉取最近日志
              </button>
              <button className="ops-btn primary" onClick={startStream} disabled={Boolean(busyText)}>
                开始实时流
              </button>
              <button className="ops-btn danger" onClick={stopStream}>
                停止实时流
              </button>
              <button className="ops-btn" onClick={() => setEvents([])}>
                清空
              </button>
              <button className="ops-btn" onClick={handleLogout}>
                退出
              </button>
              {busyText ? <span className="ops-subtitle">{busyText}</span> : null}
              {notice ? (
                <span className={notice.tone === "error" ? "ops-pill err" : "ops-pill ok"}>{notice.message}</span>
              ) : null}
              {streaming ? <span className="ops-pill ok">Streaming</span> : <span className="ops-pill">Stopped</span>}
            </div>
          </div>

          <div className="ops-panel">
            <table className="ops-table">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>时间</th>
                  <th style={{ width: 70 }}>方向</th>
                  <th style={{ width: 160 }}>设备</th>
                  <th style={{ width: 140 }}>Namespace</th>
                  <th style={{ width: 220 }}>Topic</th>
                  <th style={{ width: 160 }}>Type</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? (
                  events.map((item) => (
                    <tr key={item.id}>
                      <td className="ops-mono">{item.receivedAt}</td>
                      <td>{item.direction === "out" ? <span className="ops-pill ok">OUT</span> : <span className="ops-pill">IN</span>}</td>
                      <td className="ops-mono">{item.deviceId || "--"}</td>
                      <td className="ops-mono">{item.namespace || "--"}</td>
                      <td className="ops-mono">{item.topic}</td>
                      <td className="ops-mono">{item.type || "--"}</td>
                      <td className="ops-mono">{formatJson(item.payload)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="ops-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
                      暂无日志。你可以点击“拉取最近日志”或“开始实时流”。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

