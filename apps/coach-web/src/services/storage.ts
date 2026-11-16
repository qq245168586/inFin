export function readStorageJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveStorageJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string) {
  window.localStorage.removeItem(key);
}

