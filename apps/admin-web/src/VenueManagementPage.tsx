import { useEffect, useMemo, useRef, useState } from "react";

type NoticeFn = (message: string, tone?: "success" | "error") => void;

interface VenueRecord {
  id: string;
  name: string;
  accountNamespace: string;
  createTime: string;
  updateTime: string;
}

interface ConsoleUser {
  id: number;
  username: string;
  nickname: string;
  accountNamespace: string;
  role?: string;
  venueId?: string;
  allowedClients?: string[];
}

interface TvScreenSnapshot {
  screenNumber: number;
  orientation: "HORIZONTAL" | "VERTICAL";
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  updateState: string;
  updateTargetVersion: string;
  updateProgressPercent: number;
  updateMessage: string;
  cacheBytes: number;
  cacheFileCount: number;
  cacheUpdatedAt: string;
}

interface TvScreensPayload {
  generatedAt: string;
  screens: TvScreenSnapshot[];
  unboundDevices: TvScreenSnapshot[];
}

interface AppPackageRecord {
  id: number;
  platform: "tv" | "coach";
  version: string;
  label: string;
  filename: string;
  checksum: string;
  sizeBytes: number;
  notes: string;
  createTime: string;
  updateTime: string;
  downloadPath: string;
}

interface AppPackageListPayload {
  generatedAt: string;
  storageDirectory: string;
  packages: AppPackageRecord[];
}

interface TvInstallAppUpdateCommand {
  type: "install_app_update";
  source: "admin-web";
  deviceId: string;
  screenNumber: number;
  accountNamespace: string;
  venueId: string;
  packageId: number;
  platform: AppPackageRecord["platform"];
  version: string;
  label: string;
  filename: string;
  checksum: string;
  sizeBytes: number;
  downloadUrl: string;
  requestedAt: number;
}

const ACTIVE_VENUE_STORAGE_KEY = "infini.admin.activeVenueId";

function normalizeAccountNamespace(value: string): string {
  return String(value || "").trim().toLowerCase();
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "";
    if (text) {
      try {
        const parsed = JSON.parse(text);
        message = String(parsed?.message || parsed?.error || "").trim();
      } catch {
        message = "";
      }
    }
    throw new Error(message || text || `请求失败(${response.status})`);
  }
  return (await response.json()) as T;
}

async function publishAdminTvCommand(
  authHeader: string,
  accountNamespace: string,
  payload: TvInstallAppUpdateCommand
): Promise<{ topic: string; payload: TvInstallAppUpdateCommand }> {
  const response = await requestJson<{ data: { topic: string; payload: TvInstallAppUpdateCommand } }>("/api/admin/tv-control", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accountNamespace: normalizeAccountNamespace(accountNamespace),
      payload
    })
  });
  return response.data;
}

export default function VenueManagementPage({
  tokenType,
  accessToken,
  onNotice,
  onVenuesChange
}: {
  tokenType: string;
  accessToken: string;
  onNotice: NoticeFn;
  onVenuesChange?: (venues: VenueRecord[]) => void;
}) {
  const authHeader = useMemo(() => `${tokenType} ${accessToken}`, [tokenType, accessToken]);
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [activeVenueId, setActiveVenueId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_VENUE_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const activeVenue = venues.find((item) => item.id === activeVenueId) ?? null;
  const [venueUsers, setVenueUsers] = useState<ConsoleUser[]>([]);
  const [venueScreens, setVenueScreens] = useState<TvScreensPayload | null>(null);
  const [loading, setLoading] = useState("");
  const [allUsers, setAllUsers] = useState<ConsoleUser[]>([]);
  const [accountsQuery, setAccountsQuery] = useState("");
  const [tvPackages, setTvPackages] = useState<AppPackageRecord[]>([]);
  const [selectedTvPackageId, setSelectedTvPackageId] = useState("");
  const [installingDeviceId, setInstallingDeviceId] = useState("");

  const [createVenueOpen, setCreateVenueOpen] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");

  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  const [bindAccountOpen, setBindAccountOpen] = useState(false);
  const [bindQuery, setBindQuery] = useState("");
  const [bindCandidates, setBindCandidates] = useState<ConsoleUser[]>([]);
  const [bindSelectedUserId, setBindSelectedUserId] = useState<number | null>(null);
  const activeVenueIdRef = useRef<string>("");

  useEffect(() => {
    activeVenueIdRef.current = activeVenueId;
    try {
      if (activeVenueId) {
        localStorage.setItem(ACTIVE_VENUE_STORAGE_KEY, activeVenueId);
      } else {
        localStorage.removeItem(ACTIVE_VENUE_STORAGE_KEY);
      }
    } catch {
      // Some private browser modes can disable localStorage.
    }
  }, [activeVenueId]);

  async function loadTvPackages(showNotice = false) {
    try {
      const payload = await requestJson<{ data: AppPackageListPayload }>("/api/app-packages?platform=tv", {
        headers: { Authorization: authHeader }
      });
      const nextPackages = [...(payload.data?.packages || [])].sort(
        (a, b) => new Date(b.updateTime || b.createTime).getTime() - new Date(a.updateTime || a.createTime).getTime()
      );
      setTvPackages(nextPackages);
      if (nextPackages.length && !nextPackages.some((item) => String(item.id) === String(selectedTvPackageId))) {
        setSelectedTvPackageId(String(nextPackages[0].id));
      }
      if (showNotice) {
        onNotice("TV 版本列表已刷新。");
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载 TV 版本失败。", "error");
    }
  }

  useEffect(() => {
    void loadTvPackages(false);
  }, [authHeader]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading("正在加载场馆与账号...");
    Promise.all([
      requestJson<{ data: VenueRecord[] }>("/api/admin/venues", {
        headers: { Authorization: authHeader },
        signal: controller.signal
      }),
      requestJson<{ data: ConsoleUser[] }>("/api/admin/users", {
        headers: { Authorization: authHeader },
        signal: controller.signal
      })
    ])
      .then(([venuesPayload, usersPayload]) => {
        if (!alive) return;
        const nextVenues = venuesPayload.data || [];
        setVenues(nextVenues);
        onVenuesChange?.(nextVenues);
        setAllUsers(usersPayload.data || []);
        const savedVenueStillExists =
          activeVenueId && nextVenues.some((venue) => String(venue.id) === String(activeVenueId));
        if (!savedVenueStillExists && nextVenues.length) {
          setActiveVenueId(String(nextVenues[0].id));
        }
      })
      .catch((error) => {
        if (!alive) return;
        onNotice(error instanceof Error ? error.message : "加载场馆与账号失败。", "error");
      })
      .finally(() => setLoading(""));
    return () => {
      alive = false;
      controller.abort();
    };
  }, [authHeader]);

  const venueById = useMemo(() => {
    const map = new Map<string, VenueRecord>();
    for (const venue of venues) {
      map.set(String(venue.id), venue);
    }
    return map;
  }, [venues]);

  const filteredAccounts = useMemo(() => {
    const q = accountsQuery.trim();
    if (!q) return allUsers;
    return allUsers.filter((user) => String(user.username || "").includes(q));
  }, [accountsQuery, allUsers]);

  useEffect(() => {
    if (!activeVenueId) {
      setVenueUsers([]);
      setVenueScreens(null);
      return;
    }

    let alive = true;
    const venueId = activeVenueId;
    const controller = new AbortController();
    setLoading("正在加载场馆账号与设备...");
    Promise.all([
      requestJson<{ data: ConsoleUser[] }>(`/api/admin/venues/${encodeURIComponent(activeVenueId)}/users`, {
        headers: { Authorization: authHeader },
        signal: controller.signal
      }),
      requestJson<{ data: TvScreensPayload }>(`/api/admin/venues/${encodeURIComponent(activeVenueId)}/screens`, {
        headers: { Authorization: authHeader },
        signal: controller.signal
      })
    ])
      .then(([usersPayload, screensPayload]) => {
        if (!alive) return;
        setVenueUsers(usersPayload.data || []);
        setVenueScreens(screensPayload.data || null);
      })
      .catch((error) => {
        if (!alive) return;
        // Ignore stale 404 after the operator deleted / switched the venue.
        if (venueId !== activeVenueIdRef.current && String(error?.message || "").includes("场馆不存在")) {
          return;
        }
        onNotice(error instanceof Error ? error.message : "加载场馆数据失败。", "error");
      })
      .finally(() => setLoading(""));

    return () => {
      alive = false;
      controller.abort();
    };
  }, [activeVenueId, authHeader]);

  async function refreshAll() {
    setLoading("正在刷新...");
    try {
      const venueId = activeVenueId;
      const [venuesPayload, usersPayload] = await Promise.all([
        requestJson<{ data: VenueRecord[] }>("/api/admin/venues", {
          headers: { Authorization: authHeader }
        }),
        requestJson<{ data: ConsoleUser[] }>("/api/admin/users", {
          headers: { Authorization: authHeader }
        })
      ]);

      setVenues(venuesPayload.data || []);
      onVenuesChange?.(venuesPayload.data || []);
      setAllUsers(usersPayload.data || []);
      const nextVenues = venuesPayload.data || [];
      const savedVenueStillExists =
        activeVenueId && nextVenues.some((item) => String(item.id) === String(activeVenueId));
      if (!savedVenueStillExists && nextVenues.length) {
        setActiveVenueId(String(nextVenues[0].id));
      }
      if (venueId) {
        const [venueUsersPayload, screensPayload] = await Promise.all([
          requestJson<{ data: ConsoleUser[] }>(`/api/admin/venues/${encodeURIComponent(venueId)}/users`, {
            headers: { Authorization: authHeader }
          }),
          requestJson<{ data: TvScreensPayload }>(`/api/admin/venues/${encodeURIComponent(venueId)}/screens`, {
            headers: { Authorization: authHeader }
          })
        ]);
        setVenueUsers(venueUsersPayload.data || []);
        setVenueScreens(screensPayload.data || null);
      } else {
        setVenueUsers([]);
        setVenueScreens(null);
      }
      onNotice("已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "刷新失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleCreateVenue() {
    if (!newVenueName.trim()) {
      onNotice("请填写场馆名称。", "error");
      return;
    }
    setLoading("正在创建场馆...");
    try {
      const payload = await requestJson<{ data: VenueRecord }>("/api/admin/venues", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newVenueName.trim()
        })
      });
      setVenues((current) => {
        const next = [payload.data, ...current];
        onVenuesChange?.(next);
        return next;
      });
      setActiveVenueId(String(payload.data.id));
      setCreateVenueOpen(false);
      setNewVenueName("");
      onNotice("场馆已创建。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "创建场馆失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleCreateAccount() {
    if (!accountUsername.trim() || !accountPassword.trim()) {
      onNotice("请填写账号和密码。", "error");
      return;
    }
    setLoading("正在创建账号...");
    try {
      const payload = await requestJson<{ data: ConsoleUser }>("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: accountUsername.trim(),
          password: accountPassword.trim()
        })
      });
      setAllUsers((current) => [payload.data, ...current]);
      setCreateAccountOpen(false);
      setAccountUsername("");
      setAccountPassword("");
      onNotice("账号已创建。");
      if (activeVenueId) {
        setBindAccountOpen(true);
        setBindQuery(payload.data.username || "");
        setBindSelectedUserId(Number(payload.data.id));
        await loadBindCandidates(payload.data.username || "");
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "创建账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function loadBindCandidates(query: string) {
    try {
      const payload = await requestJson<{ data: ConsoleUser[] }>(
        `/api/admin/users?unbound=1&q=${encodeURIComponent(query || "")}`,
        { headers: { Authorization: authHeader } }
      );
      // Allow binding any unbound console user (including superadmin) to unblock initial setup.
      // Admin operators shouldn't need to understand role filtering here.
      setBindCandidates(payload.data || []);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载账号失败。", "error");
    }
  }

  async function handleBindAccount() {
    if (!activeVenueId) return;
    if (!bindSelectedUserId) {
      onNotice("请选择要绑定的账号。", "error");
      return;
    }
    setLoading("正在绑定账号...");
    try {
      await requestJson<{ data: ConsoleUser }>(`/api/admin/venues/${encodeURIComponent(activeVenueId)}/bind-user`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: bindSelectedUserId })
      });
      await refreshAll();
      setBindAccountOpen(false);
      setBindQuery("");
      setBindCandidates([]);
      setBindSelectedUserId(null);
      onNotice("账号已绑定。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "绑定账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleUnbindAccount(userId: number) {
    if (!confirm("确认解绑该账号吗？解绑后该账号将无法登录，除非重新绑定到某个场馆。")) {
      return;
    }
    setLoading("正在解绑账号...");
    try {
      await requestJson<{ data: ConsoleUser }>(`/api/admin/users/${encodeURIComponent(String(userId))}/unbind`, {
        method: "POST",
        headers: { Authorization: authHeader }
      });
      await refreshAll();
      onNotice("账号已解绑。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteVenue() {
    if (!activeVenueId || !activeVenue) return;
    if (!confirm(`确认删除场馆「${activeVenue.name}」吗？该操作会解绑该场馆下的账号与设备。`)) {
      return;
    }
    setLoading("正在删除场馆...");
    try {
      await requestJson<void>(`/api/admin/venues/${encodeURIComponent(activeVenueId)}`, {
        method: "DELETE",
        headers: { Authorization: authHeader }
      });
      setVenues((current) => {
        const next = current.filter((item) => item.id !== activeVenueId);
        onVenuesChange?.(next);
        return next;
      });
      setActiveVenueId("");
      setVenueUsers([]);
      setVenueScreens(null);
      onNotice("场馆已删除。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "删除场馆失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleInstallTvPackage(screen: TvScreenSnapshot) {
    const deviceId = String(screen.deviceId || "").trim();
    if (!activeVenueId || !activeVenue) return;
    if (!deviceId) {
      onNotice("该屏幕还没有绑定设备。", "error");
      return;
    }
    if (!selectedTvPackageId) {
      onNotice("请先选择一个 TV 版本。", "error");
      return;
    }
    if (!screen.online) {
      onNotice("屏幕当前离线，暂时无法更新。", "error");
      return;
    }
    if (String(screen.playbackState || "").toUpperCase() !== "IDLE") {
      onNotice("请先确保屏幕处于待机状态，再执行更新。", "error");
      return;
    }

    const selectedPackage = tvPackages.find((item) => String(item.id) === String(selectedTvPackageId)) || null;
    if (!selectedPackage) {
      onNotice("没有找到所选 TV 版本。", "error");
      return;
    }
    const accountNamespace = normalizeAccountNamespace(activeVenue.accountNamespace);
    if (
      !confirm(
        [
          "确定下发 TV 更新吗？",
          "",
          `场馆：${activeVenue.name}`,
          `namespace：${accountNamespace}`,
          `设备：${deviceId}`,
          `屏幕：${screen.screenNumber}`,
          `版本：${selectedPackage.version}`
        ].join("\n")
      )
    ) {
      return;
    }

    setInstallingDeviceId(deviceId);
    setLoading(`正在通知 ${deviceId} 安装 ${selectedPackage.version}...`);
    try {
      await publishAdminTvCommand(authHeader, accountNamespace, {
        type: "install_app_update",
        source: "admin-web",
        deviceId,
        screenNumber: Number(screen.screenNumber) || 0,
        accountNamespace,
        venueId: accountNamespace,
        packageId: selectedPackage.id,
        platform: selectedPackage.platform,
        version: selectedPackage.version,
        label: selectedPackage.label,
        filename: selectedPackage.filename,
        checksum: selectedPackage.checksum,
        sizeBytes: Number(selectedPackage.sizeBytes) || 0,
        downloadUrl: selectedPackage.downloadPath,
        requestedAt: Date.now()
      });
      await refreshAll();
      onNotice(`已通知 ${deviceId} 安装 ${selectedPackage.version}。`);
    } catch (error) {
      onNotice(error instanceof Error ? `更新指令下发失败：${error.message}` : "更新指令下发失败。", "error");
    } finally {
      setInstallingDeviceId("");
      setLoading("");
    }
  }

  const onlineCount = (venueScreens?.screens || []).filter((item) => item.online && item.deviceId).length;
  const boundCount = (venueScreens?.screens || []).filter((item) => item.deviceId).length;

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>场馆管理</h2>
          <p>创建场馆与账号，查看设备在线状态并执行版本更新。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={refreshAll}>
            刷新
          </button>
          <button type="button" className="ghost-button" onClick={() => setCreateAccountOpen(true)}>
            + 新建账号
          </button>
          <button type="button" className="primary-button" onClick={() => setCreateVenueOpen(true)}>
            + 新建场馆
          </button>
        </div>
      </div>

      <section className="venue-grid">
        <aside className="venue-panel venue-list">
          <div className="venue-panel-head">
            <strong>场馆</strong>
            <span className="venue-muted">{venues.length} 个</span>
          </div>
          <div className="venue-list-items">
            {venues.length ? (
              venues.map((venue) => (
                <button
                  key={venue.id}
                  type="button"
                  className={`venue-list-item ${activeVenueId === venue.id ? "is-active" : ""}`}
                  onClick={() => setActiveVenueId(venue.id)}
                >
                  <strong>{venue.name}</strong>
                  <span className="venue-list-sub">{venue.accountNamespace}</span>
                </button>
              ))
            ) : (
              <div className="venue-empty">还没有场馆，点击右上角“新建场馆”。</div>
            )}
          </div>
        </aside>

        <div className="venue-panel venue-detail">
          <div className="venue-panel-head">
            <div>
              <strong>{activeVenue ? activeVenue.name : "未选择场馆"}</strong>
              {activeVenue ? <span className="venue-muted">namespace: {activeVenue.accountNamespace}</span> : null}
            </div>
            {activeVenue ? (
              <div className="venue-badges">
                <span className="venue-badge">
                  设备 {boundCount}/{venueScreens?.screens?.length || 0}
                </span>
                <span className={`venue-badge ${onlineCount ? "is-online" : ""}`}>在线 {onlineCount}</span>
                <button type="button" className="danger-button" onClick={handleDeleteVenue}>
                  删除场馆
                </button>
              </div>
            ) : null}
          </div>

          {!activeVenue ? (
            <div className="venue-empty">请选择一个场馆。</div>
          ) : (
            <div className="venue-detail-body">
              <div className="venue-card">
                <div className="venue-card-head">
                  <strong>场馆账号</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={async () => {
                      setBindAccountOpen(true);
                      setBindQuery("");
                      setBindSelectedUserId(null);
                      await loadBindCandidates("");
                    }}
                  >
                    + 绑定账号
                  </button>
                </div>
                <div className="venue-users">
                  {venueUsers.length ? (
                    venueUsers.map((user) => (
                      <div key={user.id} className="venue-user">
                        <div>
                          <strong>{user.username}</strong>
                          <p className="venue-muted">角色 {user.role || "venue"}</p>
                        </div>
                        <div className="venue-user-actions">
                          <span className="venue-pill">coach</span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleUnbindAccount(Number(user.id))}
                          >
                            解绑
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="venue-empty">该场馆还没有账号。</div>
                  )}
                </div>
              </div>

              <div className="venue-card">
                <div className="venue-card-head">
                  <strong>设备状态</strong>
                  <div className="venue-card-actions">
                    <label className="venue-package-select">
                      <span>TV 版本</span>
                      <select
                        value={selectedTvPackageId}
                        onChange={(event) => setSelectedTvPackageId(event.target.value)}
                      >
                        {tvPackages.length ? null : <option value="">暂无可用版本</option>}
                        {tvPackages.map((appPackage) => (
                          <option key={appPackage.id} value={String(appPackage.id)}>
                            {appPackage.version} · {appPackage.label || appPackage.filename}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="ghost-button" onClick={() => void loadTvPackages(true)}>
                      刷新版本
                    </button>
                    <span className="venue-muted">{venueScreens?.generatedAt ? `更新于 ${venueScreens.generatedAt}` : ""}</span>
                  </div>
                </div>
                <div className="venue-screens">
                  {(venueScreens?.screens || []).map((screen) => (
                    <div key={screen.screenNumber} className="venue-screen">
                      <div className="venue-screen-top">
                        <strong>屏幕 {screen.screenNumber}</strong>
                        <div className="venue-screen-top-actions">
                          <button
                            type="button"
                            className="venue-screen-command"
                            disabled={
                              !screen.deviceId ||
                              !screen.online ||
                              !selectedTvPackageId ||
                              String(screen.playbackState || "").toUpperCase() !== "IDLE" ||
                              installingDeviceId === screen.deviceId
                            }
                            onClick={() => void handleInstallTvPackage(screen)}
                          >
                            {installingDeviceId === screen.deviceId ? "下发中" : "更新 TV"}
                          </button>
                          <span className={`venue-dot ${screen.online ? "is-on" : ""}`}>
                            {screen.online ? "在线" : "离线"}
                          </span>
                        </div>
                      </div>
                      <div className="venue-screen-meta">
                        <div>
                          <span className="venue-muted">设备</span>
                          <strong>{screen.deviceId || "--"}</strong>
                        </div>
                        <div>
                          <span className="venue-muted">版本</span>
                          <strong>{screen.appVersion || "--"}</strong>
                        </div>
                        <div>
                          <span className="venue-muted">状态</span>
                          <strong>{screen.playbackState || "IDLE"}</strong>
                        </div>
                      </div>
                      {screen.updateState && screen.updateState !== "IDLE" ? (
                        <div className="venue-screen-update">
                          <span className="venue-muted">
                            更新 {screen.updateState} {Math.round(screen.updateProgressPercent || 0)}%
                          </span>
                          <span className="venue-muted">{screen.updateMessage || ""}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="venue-grid">
        <div className="venue-panel venue-detail" style={{ gridColumn: "1 / -1" }}>
          <div className="venue-panel-head">
            <div>
              <strong>账号列表</strong>
              <span className="venue-muted">{filteredAccounts.length} 个</span>
            </div>
            <div className="venue-top-actions" style={{ gap: 10 }}>
              <input
                className="venue-search"
                value={accountsQuery}
                onChange={(e) => setAccountsQuery(e.target.value)}
                placeholder="搜索账号"
              />
            </div>
          </div>

          <div className="venue-detail-body">
            <div className="venue-card">
              <div className="venue-users">
                {filteredAccounts.length ? (
                  filteredAccounts.map((user) => {
                    const venueId = String(user.venueId || "").trim();
                    const venue = venueId ? venueById.get(venueId) : null;
                    const role = String(user.role || "").trim() || "venue";
                    const boundLabel = venue ? `${venue.name} (${venue.accountNamespace})` : "未绑定";
                    const isSuperadmin = role === "superadmin";
                    return (
                      <div key={user.id} className="venue-user">
                        <div>
                          <strong>{user.username}</strong>
                          <p className="venue-muted">
                            {isSuperadmin ? "管理员" : "场馆账号"} · {boundLabel}
                          </p>
                        </div>
                        <div className="venue-user-actions">
                          {venue ? <span className="venue-pill">已绑定</span> : <span className="venue-pill">未绑定</span>}
                          {!isSuperadmin && venue ? (
                            <button type="button" className="ghost-button" onClick={() => handleUnbindAccount(Number(user.id))}>
                              解绑
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="venue-empty">没有账号。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {createVenueOpen ? (
        <div className="venue-modal-mask" role="dialog" aria-modal="true">
          <div className="venue-modal">
            <div className="venue-modal-head">
              <strong>新建场馆</strong>
              <button type="button" className="ghost-button" onClick={() => setCreateVenueOpen(false)}>
                关闭
              </button>
            </div>
            <div className="venue-form">
              <label>
                <span>场馆名称</span>
                <input value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} placeholder="例如：A 场馆" />
              </label>
              <p className="venue-muted">命名空间将由系统自动生成，用于 MQTT 与数据隔离。</p>
              <div className="venue-form-actions">
                <button type="button" className="ghost-button" onClick={() => setCreateVenueOpen(false)}>
                  取消
                </button>
                <button type="button" className="primary-button" onClick={handleCreateVenue}>
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createAccountOpen ? (
        <div className="venue-modal-mask" role="dialog" aria-modal="true">
          <div className="venue-modal">
            <div className="venue-modal-head">
              <strong>新建账号</strong>
              <button type="button" className="ghost-button" onClick={() => setCreateAccountOpen(false)}>
                关闭
              </button>
            </div>
            <div className="venue-form">
              <label>
                <span>账号</span>
                <input
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  placeholder="手机号或自定义账号"
                />
              </label>
              <label>
                <span>密码</span>
                <input value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="密码" />
              </label>
              <p className="venue-muted">账号创建后，需要在场馆里绑定才能用于 Coach 端登录。</p>
              <div className="venue-form-actions">
                <button type="button" className="ghost-button" onClick={() => setCreateAccountOpen(false)}>
                  取消
                </button>
                <button type="button" className="primary-button" onClick={handleCreateAccount}>
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bindAccountOpen ? (
        <div className="venue-modal-mask" role="dialog" aria-modal="true">
          <div className="venue-modal">
            <div className="venue-modal-head">
              <strong>绑定账号到当前场馆</strong>
              <button type="button" className="ghost-button" onClick={() => setBindAccountOpen(false)}>
                关闭
              </button>
            </div>
            <div className="venue-form">
              <label>
                <span>搜索账号</span>
                <input
                  value={bindQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBindQuery(next);
                    setBindSelectedUserId(null);
                    loadBindCandidates(next);
                  }}
                  placeholder="输入账号关键词"
                />
              </label>
              <div className="venue-picker">
                {bindCandidates.length ? (
                  bindCandidates.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`venue-picker-item ${bindSelectedUserId === Number(user.id) ? "is-selected" : ""}`}
                      onClick={() => setBindSelectedUserId(Number(user.id))}
                    >
                      <strong>{user.username}</strong>
                      <span className="venue-muted">未绑定</span>
                    </button>
                  ))
                ) : (
                  <div className="venue-empty">没有可绑定的账号。你可以先点右上角“新建账号”。</div>
                )}
              </div>
              <div className="venue-form-actions">
                <button type="button" className="ghost-button" onClick={() => setBindAccountOpen(false)}>
                  取消
                </button>
                <button type="button" className="primary-button" onClick={handleBindAccount}>
                  绑定
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <div className="busy-mask">{loading}</div> : null}
    </div>
  );
}
