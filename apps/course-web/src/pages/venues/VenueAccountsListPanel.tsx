export interface AccountsListUser {
  id: number;
  username: string;
  role?: string;
  venueId?: string;
  coursePackageIds?: number[];
}

export interface AccountsListVenue {
  id: string;
  name: string;
  accountNamespace: string;
}

export default function VenueAccountsListPanel({
  filteredAccounts,
  accountsQuery,
  onAccountsQueryChange,
  venueById,
  coursePackages,
  onSetCoursePackages,
  onUnbind
}: {
  filteredAccounts: AccountsListUser[];
  accountsQuery: string;
  onAccountsQueryChange: (value: string) => void;
  venueById: Map<string, AccountsListVenue>;
  coursePackages: Array<{ id: number; name: string }>;
  onSetCoursePackages: (userId: number, coursePackageIds: number[]) => void;
  onUnbind: (userId: number) => void;
}) {
  return (
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
              onChange={(e) => onAccountsQueryChange(e.target.value)}
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
                  const coursePackageIds = (user.coursePackageIds || []).map(Number);
                  return (
                    <div key={user.id} className="venue-user">
                      <div>
                        <strong>{user.username}</strong>
                        <p className="venue-muted">{isSuperadmin ? "管理员" : "场馆账号"} · {boundLabel}</p>
                        <div className="account-package-row">
                          {isSuperadmin ? (
                            <span className="venue-pill">全部课程包</span>
                          ) : coursePackages.length ? (
                            coursePackages.map((pkg) => {
                              const selected = coursePackageIds.includes(Number(pkg.id));
                              return (
                                <button
                                  key={pkg.id}
                                  type="button"
                                  className={`account-package-chip ${selected ? "is-selected" : ""}`}
                                  onClick={() => {
                                    const next = selected
                                      ? coursePackageIds.filter((id) => id !== Number(pkg.id))
                                      : [...coursePackageIds, Number(pkg.id)];
                                    onSetCoursePackages(Number(user.id), next);
                                  }}
                                >
                                  {pkg.name}
                                </button>
                              );
                            })
                          ) : (
                            <span className="venue-muted">还没有课程包</span>
                          )}
                        </div>
                      </div>
                      <div className="venue-user-actions">
                        {venue ? <span className="venue-pill">已绑定</span> : <span className="venue-pill">未绑定</span>}
                        {!isSuperadmin && venue ? (
                          <button type="button" className="ghost-button" onClick={() => onUnbind(Number(user.id))}>
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
  );
}
