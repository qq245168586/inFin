import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "./services/apiBase.ts";

type NoticeFn = (message: string, tone?: "success" | "error") => void;
type AccountRole = "venue" | "editor" | "superadmin";

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
  password?: string;
  nickname: string;
  accountNamespace: string;
  role?: string;
  venueId?: string;
  allowedClients?: string[];
  coursePackageIds?: number[];
}

interface CoursePackageRecord {
  id: number;
  name: string;
  courseIds?: number[];
}

interface AccountDraft {
  username: string;
  password: string;
}

const emptyDraft: AccountDraft = { username: "", password: "" };

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), { cache: "no-store", ...options });
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

function roleOf(user: ConsoleUser): AccountRole {
  const role = String(user.role || "").trim().toLowerCase();
  if (role === "superadmin") return "superadmin";
  if (role === "editor") return "editor";
  return "venue";
}

function matchesQuery(user: ConsoleUser, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [user.username, user.nickname, user.accountNamespace].some((value) =>
    String(value || "").toLowerCase().includes(q)
  );
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
  const [coursePackages, setCoursePackages] = useState<CoursePackageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [coachDraft, setCoachDraft] = useState<AccountDraft>(emptyDraft);
  const [editorDraft, setEditorDraft] = useState<AccountDraft>(emptyDraft);

  const venueById = useMemo(() => {
    const map = new Map<string, VenueRecord>();
    for (const venue of venues) {
      map.set(String(venue.id), venue);
    }
    return map;
  }, [venues]);

  const filteredUsers = useMemo(() => users.filter((user) => matchesQuery(user, query)), [users, query]);
  const adminUsers = filteredUsers.filter((user) => roleOf(user) === "superadmin");
  const coachUsers = filteredUsers.filter((user) => roleOf(user) === "venue");
  const editorUsers = filteredUsers.filter((user) => roleOf(user) === "editor");

  const packageById = useMemo(() => {
    const map = new Map<number, CoursePackageRecord>();
    for (const item of coursePackages) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [coursePackages]);

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
      }),
      requestJson<{ data: CoursePackageRecord[] }>("/api/admin/course-packages", {
        headers: { Authorization: authHeader },
        signal: controller.signal
      })
    ])
      .then(([venuesPayload, usersPayload, packagesPayload]) => {
        if (!alive) return;
        setVenues(venuesPayload.data || []);
        setUsers(usersPayload.data || []);
        setCoursePackages(packagesPayload.data || []);
      })
      .catch((error) => {
        if (!alive) return;
        onNotice(error instanceof Error ? error.message : "加载账号列表失败。", "error");
      })
      .finally(() => {
        if (alive) setLoading("");
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [authHeader, onNotice]);

  async function refresh(showNotice = true) {
    setLoading("正在刷新...");
    try {
      const [venuesPayload, usersPayload, packagesPayload] = await Promise.all([
        requestJson<{ data: VenueRecord[] }>("/api/admin/venues", {
          headers: { Authorization: authHeader }
        }),
        requestJson<{ data: ConsoleUser[] }>("/api/admin/users", {
          headers: { Authorization: authHeader }
        }),
        requestJson<{ data: CoursePackageRecord[] }>("/api/admin/course-packages", {
          headers: { Authorization: authHeader }
        })
      ]);
      setVenues(venuesPayload.data || []);
      setUsers(usersPayload.data || []);
      setCoursePackages(packagesPayload.data || []);
      if (showNotice) onNotice("已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "刷新失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function createAccount(role: "venue" | "editor") {
    const draft = role === "editor" ? editorDraft : coachDraft;
    const username = draft.username.trim();
    const password = draft.password.trim();
    if (!username || !password) {
      onNotice("请输入账号和密码。", "error");
      return;
    }
    setLoading(role === "editor" ? "正在创建编课账号..." : "正在创建 Coach 账号...");
    try {
      await requestJson<{ data: ConsoleUser }>("/api/admin/users", {
        method: "POST",
        headers: { Authorization: authHeader },
        body: JSON.stringify({ username, password, role })
      });
      if (role === "editor") {
        setEditorDraft(emptyDraft);
      } else {
        setCoachDraft(emptyDraft);
      }
      await refresh(false);
      onNotice(role === "editor" ? "编课账号已创建，请继续绑定课程包权限。" : "Coach 账号已创建，请到场馆里绑定。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "创建账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function unbindUser(userId: number) {
    if (!window.confirm("确认解绑该 Coach 账号吗？解绑后将无法登录 Coach 端，除非重新绑定到场馆。")) {
      return;
    }
    setLoading("正在解绑账号...");
    try {
      await requestJson<{ data: ConsoleUser }>(`/api/admin/users/${encodeURIComponent(String(userId))}/unbind`, {
        method: "POST",
        headers: { Authorization: authHeader }
      });
      await refresh(false);
      onNotice("账号已解绑。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function setEditorCoursePackages(user: ConsoleUser, coursePackageIds: number[]) {
    setLoading("正在更新编课权限...");
    try {
      const payload = await requestJson<{ data: ConsoleUser }>(
        `/api/admin/users/${encodeURIComponent(String(user.id))}/course-packages`,
        {
          method: "PUT",
          headers: { Authorization: authHeader },
          body: JSON.stringify({ coursePackageIds })
        }
      );
      setUsers((current) => current.map((item) => (Number(item.id) === Number(user.id) ? payload.data : item)));
      onNotice("编课权限已更新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "更新编课权限失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function updateAccountPassword(user: ConsoleUser) {
    if (roleOf(user) === "superadmin") return;
    const nextPassword = window.prompt(`请输入账号「${user.username}」的新密码`, "");
    if (nextPassword == null) return;
    if (!nextPassword.trim()) {
      onNotice("密码不能为空。", "error");
      return;
    }
    setLoading("正在修改密码...");
    try {
      const payload = await requestJson<{ data: ConsoleUser }>(
        `/api/admin/users/${encodeURIComponent(String(user.id))}`,
        {
          method: "PATCH",
          headers: { Authorization: authHeader },
          body: JSON.stringify({ password: nextPassword.trim() })
        }
      );
      setUsers((current) => current.map((item) => (Number(item.id) === Number(user.id) ? payload.data : item)));
      onNotice("密码已修改。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "修改密码失败。", "error");
    } finally {
      setLoading("");
    }
  }

  function toggleEditorPackage(user: ConsoleUser, coursePackageId: number) {
    const ids = new Set((user.coursePackageIds || []).map(Number));
    if (ids.has(coursePackageId)) {
      ids.delete(coursePackageId);
    } else {
      ids.add(coursePackageId);
    }
    void setEditorCoursePackages(user, [...ids]);
  }

  function renderDraftForm(role: "venue" | "editor") {
    const draft = role === "editor" ? editorDraft : coachDraft;
    const setDraft = role === "editor" ? setEditorDraft : setCoachDraft;
    return (
      <div className="venue-form-grid">
        <label className="field">
          <span>{role === "editor" ? "编课账号" : "Coach 账号"}</span>
          <input
            value={draft.username}
            onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
            placeholder="手机号或自定义账号"
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            value={draft.password}
            onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
            placeholder="设置登录密码"
          />
        </label>
        <div className="field action-field">
          <button type="button" className="primary-button" onClick={() => void createAccount(role)}>
            {role === "editor" ? "创建编课账号" : "创建 Coach 账号"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>账号管理</h2>
          <p>Coach 账号用于现场控屏；编课账号用于课程端，并按课程包授权。</p>
        </div>
        <div className="venue-top-actions">
          <input
            className="venue-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索账号"
          />
          <button type="button" className="ghost-button" onClick={() => void refresh()}>
            刷新
          </button>
        </div>
      </div>

      <section className="venue-grid account-management-grid">
        <div className="venue-panel venue-detail">
          <div className="venue-panel-head">
            <div>
              <strong>Coach 账号</strong>
              <span className="venue-muted">{coachUsers.length} 个，用于 Coach Web 登录和现场控屏</span>
            </div>
          </div>
          <div className="venue-detail-body">
            <div className="venue-card">
              <div className="venue-card-head">
                <div>
                  <strong>新建 Coach 账号</strong>
                  <p className="venue-muted">创建后需要在场馆管理里绑定到某个场馆。</p>
                </div>
              </div>
              {renderDraftForm("venue")}
            </div>

            <div className="venue-card">
              <div className="venue-users">
                {coachUsers.length ? (
                  coachUsers.map((user) => {
                    const venueId = String(user.venueId || "").trim();
                    const venue = venueId ? venueById.get(venueId) : null;
                    return (
                      <div key={user.id} className="venue-user">
                        <div>
                          <strong>{user.username}</strong>
                          <p className="venue-muted">Coach 端 · {venue ? `${venue.name} (${venue.accountNamespace})` : "未绑定场馆"}</p>
                          <div className="account-password-row">
                            <span>密码</span>
                            <code>{String(user.password || "").trim() || "未记录，请重置"}</code>
                          </div>
                        </div>
                        <div className="venue-user-actions">
                          {venue ? <span className="venue-pill">已绑定</span> : <span className="venue-pill">未绑定</span>}
                          <button type="button" className="ghost-button" onClick={() => void updateAccountPassword(user)}>
                            改密码
                          </button>
                          {venue ? (
                            <button type="button" className="ghost-button" onClick={() => void unbindUser(Number(user.id))}>
                              解绑
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="venue-empty">没有 Coach 账号。</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="venue-panel venue-detail">
          <div className="venue-panel-head">
            <div>
              <strong>编课账号</strong>
              <span className="venue-muted">{editorUsers.length} 个，只能编辑授权课程包</span>
            </div>
          </div>
          <div className="venue-detail-body">
            <div className="venue-card">
              <div className="venue-card-head">
                <div>
                  <strong>新建编课账号</strong>
                  <p className="venue-muted">创建后在下方勾选可维护的课程包。</p>
                </div>
              </div>
              {renderDraftForm("editor")}
            </div>

            <div className="venue-card">
              <div className="venue-users">
                {editorUsers.length ? (
                  editorUsers.map((user) => {
                    const selectedIds = new Set((user.coursePackageIds || []).map(Number));
                    const selectedNames = [...selectedIds]
                      .map((id) => packageById.get(id)?.name)
                      .filter(Boolean) as string[];
                    return (
                      <div key={user.id} className="venue-user account-user-row">
                        <div className="account-user-main">
                          <strong>{user.username}</strong>
                          <p className="venue-muted">课程端 · {selectedNames.length ? selectedNames.join(" / ") : "未授权课程包"}</p>
                          <div className="account-password-row">
                            <span>密码</span>
                            <code>{String(user.password || "").trim() || "未记录，请重置"}</code>
                          </div>
                          <div className="account-package-row">
                            {coursePackages.length ? (
                              coursePackages.map((pkg) => {
                                const selected = selectedIds.has(Number(pkg.id));
                                return (
                                  <button
                                    key={pkg.id}
                                    type="button"
                                    className={`account-package-chip ${selected ? "is-selected" : ""}`}
                                    onClick={() => toggleEditorPackage(user, Number(pkg.id))}
                                  >
                                    {selected ? "✓ " : ""}
                                    {pkg.name}
                                  </button>
                                );
                              })
                            ) : (
                              <span className="venue-muted">暂无课程包</span>
                            )}
                          </div>
                        </div>
                        <div className="venue-user-actions">
                          <span className="venue-pill">编课</span>
                          <button type="button" className="ghost-button" onClick={() => void updateAccountPassword(user)}>
                            改密码
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="venue-empty">没有编课账号。</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {adminUsers.length ? (
          <div className="venue-panel venue-detail" style={{ gridColumn: "1 / -1" }}>
            <div className="venue-panel-head">
              <div>
                <strong>超级管理员</strong>
                <span className="venue-muted">拥有全部课程包和场馆权限</span>
              </div>
            </div>
            <div className="venue-detail-body">
              <div className="venue-card">
                <div className="venue-users">
                  {adminUsers.map((user) => (
                    <div key={user.id} className="venue-user">
                      <div>
                        <strong>{user.username}</strong>
                        <p className="venue-muted">全部课程包 · 全部场馆</p>
                      </div>
                      <span className="venue-pill">管理员</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {loading ? <div className="busy-mask">{loading}</div> : null}
    </div>
  );
}
