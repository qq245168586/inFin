export interface VenueListItem {
  id: string;
  name: string;
  accountNamespace: string;
}

export default function VenueListPanel({
  venues,
  activeVenueId,
  onSelectVenue
}: {
  venues: VenueListItem[];
  activeVenueId: string;
  onSelectVenue: (venueId: string) => void;
}) {
  return (
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
              onClick={() => onSelectVenue(venue.id)}
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
  );
}
