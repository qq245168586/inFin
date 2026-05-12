const ACTIVE_VENUE_STORAGE_KEY = "infini.admin.activeVenueId";

export function readActiveVenueId(): string {
  try {
    return localStorage.getItem(ACTIVE_VENUE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function persistActiveVenueId(value: string): void {
  try {
    if (value) {
      localStorage.setItem(ACTIVE_VENUE_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(ACTIVE_VENUE_STORAGE_KEY);
    }
  } catch {
    // Some private browser modes can disable localStorage.
  }
}
