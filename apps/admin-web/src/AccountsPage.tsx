import { useEffect, useMemo, useState } from "react";

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

export default function AccountsPage({
  tokenType,
  accessToken,
  onNotice
}: {
  tokenType: string;
  accessToken: string;
  onNotice: NoticeFn;
}) {
  const authHeader = useMemo(() => `${tokenType} ${accessToken}`, [tokenType, accessToken]);
  const [loading, setLoading] = useState("");
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [users, setUsers] = useState<ConsoleUser[]>([]);
  const [query, setQuery] = useState("");

  const venueById = useMemo(() => {
    const map = new Map<string, VenueRecord>();
    for (const venue of venues) {
      map.set(String(venue.id), venue);
    }
    return map;
  }, [venues]);

  const filteredUsers = useMemo(() => {
    const q = query.trim();
    if (!q) return users;
    return users.filter((user) => String(user.username || "").includes(q));
  }, [users, query]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading("正在加载账号列表...");
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
        setVenues(venuesPayload.data || []);
        setUsers(usersPayload.data || []);
      })
      .catch((error) => {
        if (!alive) return;
        onNotice(error instanceof Error ? error.message : "加载账号列表失败。", "error");
      })
      .finally(() => setLoading(""));

    return () => {
      alive = false;
      controller.abort();
    };
  }, [authHeader, onNotice]);

  async function refresh() {
    setLoading("正在刷新...");
    try {
      const [venuesPayload, usersPayload] = await Promise.all([
        requestJson<{ data: VenueRecord[] }>("/api/admin/venues", {
          headers: { Authorization: authHeader }
        }),
        requestJson<{ data: ConsoleUser[] }>("/api/admin/users", {
          headers: { Authorization: authHeader }
        })
      ]);
      setVenues(venuesPayload.data || []);
      setUsers(usersPayload.data || []);
      onNotice("已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "刷新失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function unbindUser(userId: number) {
    if (!window.confirm("确认解绑该账号吗？解绑后将变为未绑定状态。")) {
      return;
    }
    setLoading("正在解绑账号...");
    try {
      await requestJson<{ data: ConsoleUser }>(`/api/admin/users/${encodeURIComponent(String(userId))}/unbind`, {
        method: "POST",
        headers: { Authorization: authHeader }
      });
      await refresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑失败。", "error");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>账号列表</h2>
          <p>查看账号当前绑定的场馆，或是否处于未绑定状态。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={refresh}>
            刷新
          </button>
        </div>
      </div>

      <section className="venue-grid">
        <div className="venue-panel venue-detail" style={{ gridColumn: "1 / -1" }}>
          <div className="venue-panel-head">
            <div>
              <strong>所有账号</strong>
              <span className="venue-muted">{filteredUsers.length} 个</span>
            </div>
            <div className="venue-top-actions" style={{ gap: 10 }}>
              <input
                className="venue-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索账号"
              />
            </div>
          </div>

          <div className="venue-detail-body">
            <div className="venue-card">
              <div className="venue-users">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => {
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
                            <button type="button" className="ghost-button" onClick={() => unbindUser(Number(user.id))}>
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

      {loading ? <div className="busy-mask">{loading}</div> : null}
    </div>
  );
}

