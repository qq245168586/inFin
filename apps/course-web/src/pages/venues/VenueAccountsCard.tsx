export interface VenueUserItem {
  id: number;
  username: string;
  role?: string;
}

export default function VenueAccountsCard({
  venueUsers,
  onOpenBind,
  onUnbind
}: {
  venueUsers: VenueUserItem[];
  onOpenBind: () => void;
  onUnbind: (userId: number) => void;
}) {
  return (
    <div className="venue-card">
      <div className="venue-card-head">
        <strong>场馆账号</strong>
        <button type="button" className="ghost-button" onClick={onOpenBind}>
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
                <button type="button" className="ghost-button" onClick={() => onUnbind(Number(user.id))}>
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
  );
}
