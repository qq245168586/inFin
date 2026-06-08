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

interface CountItem {
  name: string;
  count: number;
}

interface TvScreenItem {
  screenNumber: number;
  deviceId: string;
  appVersion: string;
  online: boolean;
  playbackState: string;
  updateState: string;
  updateTargetVersion?: string;
  updateProgressPercent?: number;
  lastSeenAt: string;
  accountNamespace?: string;
}

interface OpsOverview {
  generatedAt: string;
  server: {
    dbSafety?: {
      usingExternalDataRoot?: boolean;
      backupCount?: number;
      latestBackupAt?: string;
      dbSizeBytes?: number;
    };
    mediaStorage?: unknown;
    tvControl?: unknown;
  };
  mqtt: {
    total: number;
    inbound: number;
    outbound: number;
    uniqueDevices: number;
    namespaces: string[];
    latestAt: string;
    topTypes: CountItem[];
    topTopics: CountItem[];
  };
  screens: {
    generatedAt: string;
    requiresNamespace: boolean;
    summary: {
      slots: number;
      bound: number;
      online: number;
      preview: number;
      running: number;
      updating: number;
      states: Record<string, number>;
      updates: Record<string, number>;
      versions: Record<string, number>;
    };
    items: TvScreenItem[];
  };
  appPackages: {
    tv: Array<{
      id: number;
      version: string;
      label?: string;
      updateTime?: string;
      notes?: string;
    }>;
  };
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

function formatDateTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatBytes(value?: number): string {
  if (!Number.isFinite(value)) return "--";
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildFilterParams({
  namespace,
  deviceId,
  topicContains,
  typeContains,
  date,
  limit
}: {
  namespace: string;
  deviceId: string;
  topicContains: string;
  typeContains: string;
  date: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (namespace.trim()) params.set("namespace", namespace.trim());
  if (deviceId.trim()) params.set("deviceId", deviceId.trim());
  if (topicContains.trim()) params.set("topic", topicContains.trim());
  if (typeContains.trim()) params.set("type", typeContains.trim());
  if (date.trim()) params.set("date", date.trim());
  if (limit) params.set("limit", String(Math.max(10, Math.min(limit || 200, 2000))));
  return params;
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
  const [date, setDate] = useState("");
  const [limit, setLimit] = useState(200);

  const [overview, setOverview] = useState<OpsOverview | null>(null);
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
    setOverview(null);
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
    setOverview(null);
    setEvents([]);
    pushNotice("已退出登录。");
  }

  async function fetchOverview({ silent = false } = {}) {
    if (!authSession) return;
    if (!silent) setBusyText("正在刷新总览...");
    try {
      const params = buildFilterParams({ namespace, deviceId, topicContains, typeContains, date });
      const payload = await requestJson<{ data: OpsOverview }>(`/api/ops/overview?${params.toString()}`, {
        headers: {
          Authorization: authHeader
        }
      });
      setOverview(payload.data || null);
      if (!silent) pushNotice("总览已刷新。");
    } catch (error) {
      const message = getErrorMessage(error);
      if (isAuthExpiredMessage(message)) {
        handleSessionExpired(message);
        return;
      }
      if (!silent) pushNotice(message, "error");
    } finally {
      if (!silent) setBusyText("");
    }
  }

  async function fetchRecentEvents() {
    if (!authSession) return;
    setBusyText("正在加载日志...");
    try {
      const params = buildFilterParams({ namespace, deviceId, topicContains, typeContains, date, limit });
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

    const params = buildFilterParams({ namespace, deviceId, topicContains, typeContains, date, limit });

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

  useEffect(() => {
    if (!authSession) return;
    void fetchOverview({ silent: true });
  }, [authSession?.access_token]);

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

  const screenSummary = overview?.screens.summary;
  const latestTvPackage = overview?.appPackages.tv?.[0] || null;
  const dbSafety = overview?.server.dbSafety;
  const mediaStorageText = overview?.server.mediaStorage ? formatJson(overview.server.mediaStorage) : "--";
  const tvControlText = overview?.server.tvControl ? formatJson(overview.server.tvControl) : "--";

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
            <div className="ops-section-title">查询条件</div>
            <div className="ops-row ops-row-four">
              <div className="ops-field">
                <label>命名空间（namespace / 场馆）</label>
                <input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="例如：zhiyou 或 venue-xxxx" />
              </div>
              <div className="ops-field">
                <label>设备 ID</label>
                <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="例如：TV-ABCDEF12" />
              </div>
              <div className="ops-field">
                <label>日期</label>
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
              </div>
              <div className="ops-field">
                <label>日志条数</label>
                <input
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 200)}
                  type="number"
                  min={10}
                  max={2000}
                />
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
              <button className="ops-btn primary" onClick={() => fetchOverview()} disabled={Boolean(busyText)}>
                刷新总览
              </button>
              <button className="ops-btn" onClick={fetchRecentEvents} disabled={Boolean(busyText)}>
                拉取最近日志
              </button>
              <button className="ops-btn" onClick={startStream} disabled={Boolean(busyText)}>
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

          <div className="ops-metric-grid">
            <div className="ops-metric-card">
              <div className="ops-metric-label">MQTT 日志</div>
              <div className="ops-metric-value">{overview?.mqtt.total ?? "--"}</div>
              <div className="ops-metric-sub">IN {overview?.mqtt.inbound ?? "--"} / OUT {overview?.mqtt.outbound ?? "--"}</div>
            </div>
            <div className="ops-metric-card">
              <div className="ops-metric-label">交互设备</div>
              <div className="ops-metric-value">{overview?.mqtt.uniqueDevices ?? "--"}</div>
              <div className="ops-metric-sub">最近：{formatDateTime(overview?.mqtt.latestAt)}</div>
            </div>
            <div className="ops-metric-card">
              <div className="ops-metric-label">TV 在线</div>
              <div className="ops-metric-value">{screenSummary ? `${screenSummary.online}/${screenSummary.bound}` : "--"}</div>
              <div className="ops-metric-sub">{overview?.screens.requiresNamespace ? "输入 namespace 后统计屏幕" : "已绑定屏幕在线数"}</div>
            </div>
            <div className="ops-metric-card">
              <div className="ops-metric-label">TV 状态</div>
              <div className="ops-metric-value">{screenSummary ? `${screenSummary.running} RUN` : "--"}</div>
              <div className="ops-metric-sub">PREVIEW {screenSummary?.preview ?? "--"} / 更新中 {screenSummary?.updating ?? "--"}</div>
            </div>
            <div className="ops-metric-card">
              <div className="ops-metric-label">最新 TV 包</div>
              <div className="ops-metric-value">{latestTvPackage?.version || "--"}</div>
              <div className="ops-metric-sub">{latestTvPackage?.label || latestTvPackage?.notes || "服务器发布包"}</div>
            </div>
            <div className="ops-metric-card">
              <div className="ops-metric-label">数据库</div>
              <div className="ops-metric-value">{formatBytes(dbSafety?.dbSizeBytes)}</div>
              <div className="ops-metric-sub">备份 {dbSafety?.backupCount ?? "--"} / {dbSafety?.usingExternalDataRoot ? "外部数据目录" : "本地数据目录"}</div>
            </div>
          </div>

          <div className="ops-dashboard-grid">
            <div className="ops-panel">
              <div className="ops-section-title">MQTT 类型分布</div>
              <div className="ops-chip-list">
                {(overview?.mqtt.topTypes || []).length ? (
                  overview?.mqtt.topTypes.map((item) => (
                    <span className="ops-chip" key={item.name}>
                      {item.name}<b>{item.count}</b>
                    </span>
                  ))
                ) : (
                  <span className="ops-subtitle">暂无统计，先刷新总览。</span>
                )}
              </div>
            </div>

            <div className="ops-panel">
              <div className="ops-section-title">运行配置</div>
              <div className="ops-kv">
                <span>Media</span>
                <code>{mediaStorageText}</code>
                <span>TV Control</span>
                <code>{tvControlText}</code>
              </div>
            </div>
          </div>

          <div className="ops-panel">
            <div className="ops-section-title">TV 屏幕</div>
            {overview?.screens.requiresNamespace ? (
              <div className="ops-subtitle">输入场馆 namespace 后刷新，可以查看该场馆 TV 在线、状态、版本和更新时间。</div>
            ) : overview?.screens.items.length ? (
              <div className="ops-screen-grid">
                {overview.screens.items.map((screen) => (
                  <div className="ops-screen-card" key={`${screen.screenNumber}-${screen.deviceId}`}>
                    <div className="ops-screen-head">
                      <strong>屏幕 {screen.screenNumber}</strong>
                      <span className={screen.online ? "ops-pill ok" : "ops-pill err"}>{screen.online ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                    <div className="ops-mono">{screen.deviceId}</div>
                    <div className="ops-screen-line">
                      <span>版本 {screen.appVersion || "--"}</span>
                      <span>{screen.playbackState || "IDLE"}</span>
                    </div>
                    <div className="ops-screen-line">
                      <span>{screen.updateState || "IDLE"}</span>
                      <span>{formatDateTime(screen.lastSeenAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ops-subtitle">该 namespace 暂无已绑定屏幕。</div>
            )}
          </div>

          <div className="ops-panel">
            <div className="ops-section-title">MQTT 交互日志</div>
            <div className="ops-table-wrap">
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
    </div>
  );
}
